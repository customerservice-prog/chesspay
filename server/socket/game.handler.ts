import type { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { verifyAccessToken } from '../../lib/auth/jwt'
import { logger } from '../../lib/logger'
import { processMove, getGameWithPlayers, markGameStarted, forfeitByDisconnect } from '../services/game.service'
import { lockWagerEscrow, settleGamePayout, refundGame } from '../services/wallet.service'
import type { MoveInput } from '../../lib/chess/engine'

// Track disconnect timers in memory (would move to Redis for multi-instance)
const disconnectTimers = new Map<string, NodeJS.Timeout>()

// Track which users are in which games
const userGameMap = new Map<string, string>() // userId -> gameId

export function initSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 10000,
  })

  // ── Auth middleware ─────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      return next(new Error('Authentication required'))
    }
    try {
      const payload = verifyAccessToken(token)
      socket.data.userId = payload.sub
      socket.data.username = payload.username
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const { userId, username } = socket.data as { userId: string; username: string }
    logger.info({ userId, username, socketId: socket.id }, 'Socket connected')

    // ── Join game room ────────────────────────────────────────────
    socket.on('game:join', async (gameId: string) => {
      try {
        const game = await getGameWithPlayers(gameId)

        // Verify this user is a player in this game
        const isPlayer = game.whiteUserId === userId || game.blackUserId === userId
        if (!isPlayer) {
          socket.emit('error', { code: 'FORBIDDEN', message: 'You are not a player in this game' })
          return
        }

        await socket.join(`game:${gameId}`)
        userGameMap.set(userId, gameId)

        // Cancel any pending disconnect timer for this player
        const timerKey = `${gameId}:${userId}`
        const existingTimer = disconnectTimers.get(timerKey)
        if (existingTimer) {
          clearTimeout(existingTimer)
          disconnectTimers.delete(timerKey)
          logger.info({ gameId, userId }, 'Reconnect within window — disconnect timer cancelled')
          io.to(`game:${gameId}`).emit('game:player_reconnected', { userId, username })
        }

        // Check if both players are now connected → start the game
        const room = io.sockets.adapter.rooms.get(`game:${gameId}`)
        const connectedCount = room?.size ?? 0

        if (game.status === 'WAITING' && connectedCount >= 2) {
          // Lock escrow if wager game
          const wagerAmount = parseFloat(game.wagerAmount as string)
          if (wagerAmount > 0) {
            try {
              await lockWagerEscrow(gameId, game.whiteUserId, game.blackUserId, wagerAmount)
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Escrow failed'
              io.to(`game:${gameId}`).emit('game:error', { code: 'ESCROW_FAILED', message })
              return
            }
          }
          await markGameStarted(gameId)
          io.to(`game:${gameId}`).emit('game:started', {
            gameId,
            white: game.whitePlayer,
            black: game.blackPlayer,
            timeControl: game.timeControl,
            fenSnapshot: game.fenSnapshot,
          })
        } else {
          // Send current game state to joining player
          socket.emit('game:state', {
            gameId,
            status: game.status,
            fenSnapshot: game.fenSnapshot,
            white: game.whitePlayer,
            black: game.blackPlayer,
            timeControl: game.timeControl,
          })
        }

        logger.info({ gameId, userId }, 'Player joined game room')
      } catch (err) {
        logger.error({ err, gameId, userId }, 'Error joining game')
        socket.emit('error', { code: 'JOIN_FAILED', message: 'Failed to join game' })
      }
    })

    // ── Make move ─────────────────────────────────────────────────
    socket.on('game:move', async (payload: { gameId: string; move: MoveInput; timeRemainingMs: number; elapsedMs: number }) => {
      try {
        const { gameId, move, timeRemainingMs, elapsedMs } = payload

        const result = await processMove(gameId, userId, move, timeRemainingMs, elapsedMs)

        // Broadcast move to both players in the room
        io.to(`game:${gameId}`).emit('game:move_applied', {
          userId,
          move,
          san: result.san,
          fenAfter: result.fenAfter,
          moveNumber: result.moveNumber,
          isCheck: result.isCheck,
          timeRemainingMs,
        })

        // Handle game over
        if (result.isGameOver) {
          const game = await getGameWithPlayers(gameId)
          const wagerAmount = parseFloat(game.wagerAmount as string)

          let winnerId: string | null = null
          let loserId: string | null = null

          if (result.isCheckmate) {
            winnerId = userId
            loserId = userId === game.whiteUserId ? game.blackUserId : game.whiteUserId
          }

          // Settle payout if wager game
          if (wagerAmount > 0 && winnerId && loserId) {
            await settleGamePayout(gameId, winnerId, loserId)
          }

          io.to(`game:${gameId}`).emit('game:over', {
            gameId,
            winnerId,
            isDraw: result.isDraw,
            resultReason: result.isCheckmate ? 'CHECKMATE' : result.drawType ?? 'DRAW',
            pgn: result.pgn,
          })

          userGameMap.delete(userId)
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Move failed'
        const code = (err as { code?: string }).code ?? 'MOVE_FAILED'
        logger.warn({ err, userId }, 'Move rejected')
        // Only emit error to the player who made the illegal move
        socket.emit('game:move_rejected', { code, message })
      }
    })

    // ── Resignation ───────────────────────────────────────────────
    socket.on('game:resign', async ({ gameId }: { gameId: string }) => {
      try {
        const game = await getGameWithPlayers(gameId)
        const winnerId = game.whiteUserId === userId ? game.blackUserId : game.whiteUserId

        const { db } = await import('../../db/client')
        const { games } = await import('../../db/schema')
        const { eq } = await import('drizzle-orm')

        await db.update(games).set({
          status: 'COMPLETED',
          winnerUserId: winnerId,
          resultReason: 'RESIGNATION',
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(games.id, gameId))

        const wagerAmount = parseFloat(game.wagerAmount as string)
        if (wagerAmount > 0) {
          await settleGamePayout(gameId, winnerId, userId)
        }

        io.to(`game:${gameId}`).emit('game:over', {
          gameId,
          winnerId,
          isDraw: false,
          resultReason: 'RESIGNATION',
        })

        userGameMap.delete(userId)
      } catch (err) {
        logger.error({ err, userId, gameId: (socket as unknown as Record<string, unknown>).gameId }, 'Resign failed')
      }
    })

    // ── Tab switch tracking (behavioral signal for anti-cheat) ────
    socket.on('game:tab_hidden', ({ gameId }: { gameId: string }) => {
      // Log to game room — collected for anti-cheat analysis, not acted on in real-time
      socket.to(`game:${gameId}`).emit('game:opponent_tab_hidden')
      logger.debug({ gameId, userId }, 'Tab hidden event')
    })

    // ── Disconnect ────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      logger.info({ userId, username, reason }, 'Socket disconnected')

      const gameId = userGameMap.get(userId)
      if (!gameId) return

      const reconnectWindowMs =
        parseInt(process.env.RECONNECT_WINDOW_SECONDS ?? '60') * 1000

      // Notify opponent
      io.to(`game:${gameId}`).emit('game:player_disconnected', {
        userId,
        username,
        reconnectWindowMs,
      })

      // Start disconnect timer — forfeit if they don't reconnect
      const timerKey = `${gameId}:${userId}`
      const timer = setTimeout(async () => {
        disconnectTimers.delete(timerKey)
        userGameMap.delete(userId)

        logger.info({ gameId, userId }, 'Reconnect window expired — forfeiting game')

        try {
          const result = await forfeitByDisconnect(gameId, userId)
          if (result) {
            const game = await getGameWithPlayers(gameId)
            const wagerAmount = parseFloat(game.wagerAmount as string)
            if (wagerAmount > 0 && result.winnerId) {
              await settleGamePayout(gameId, result.winnerId, userId)
            }
          }

          io.to(`game:${gameId}`).emit('game:over', {
            gameId,
            winnerId: result?.winnerId ?? null,
            isDraw: false,
            resultReason: 'FORFEIT_DISCONNECT',
          })
        } catch (err) {
          logger.error({ err, gameId, userId }, 'Forfeit processing failed')
        }
      }, reconnectWindowMs)

      disconnectTimers.set(timerKey, timer)
    })
  })

  return io
}
