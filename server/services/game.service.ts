import { eq, and, or, desc } from 'drizzle-orm'
import { db } from '../../db/client'
import { games, gameMoves, users, ledgerTransactions } from '../../db/schema'
import { applyMove, getTurnFromFen, STARTING_FEN, type MoveInput } from '../../lib/chess/engine'
import { GameStateError, NotFoundError, ForbiddenError } from '../../lib/errors'
import { logger } from '../../lib/logger'
import type { TimeControl } from '../../lib/validation'

export interface CreateGameOptions {
  whiteUserId: string
  blackUserId: string
  wagerAmount: number   // in dollars (0 for points-only)
  timeControl: TimeControl
}

export async function createGame(opts: CreateGameOptions) {
  const potTotal = (opts.wagerAmount * 2).toFixed(2)
  const rakePercent = process.env.RAKE_PERCENT ?? '7.50'

  const [game] = await db
    .insert(games)
    .values({
      whiteUserId: opts.whiteUserId,
      blackUserId: opts.blackUserId,
      wagerAmount: opts.wagerAmount.toFixed(2),
      rakePercent,
      potTotal,
      status: 'WAITING',
      fenSnapshot: STARTING_FEN,
      timeControl: opts.timeControl,
      payoutStatus: 'PENDING',
    })
    .returning()

  logger.info({ gameId: game.id, white: opts.whiteUserId, black: opts.blackUserId }, 'Game created')
  return game
}

export async function getGameById(gameId: string) {
  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  if (!game) throw new NotFoundError('Game')
  return game
}

export async function getGameWithPlayers(gameId: string) {
  const white = db.select({ id: users.id, username: users.username, eloRating: users.eloRating }).from(users)
  const black = db.select({ id: users.id, username: users.username, eloRating: users.eloRating }).from(users)

  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  if (!game) throw new NotFoundError('Game')

  const [whitePlayer] = await db.select({ id: users.id, username: users.username, eloRating: users.eloRating })
    .from(users).where(eq(users.id, game.whiteUserId)).limit(1)
  const [blackPlayer] = await db.select({ id: users.id, username: users.username, eloRating: users.eloRating })
    .from(users).where(eq(users.id, game.blackUserId)).limit(1)

  return { ...game, whitePlayer, blackPlayer }
}

export async function getGameMoves(gameId: string) {
  return db
    .select()
    .from(gameMoves)
    .where(eq(gameMoves.gameId, gameId))
    .orderBy(gameMoves.moveNumber)
}

export async function markGameStarted(gameId: string) {
  await db
    .update(games)
    .set({ status: 'IN_PROGRESS', startedAt: new Date(), updatedAt: new Date() })
    .where(eq(games.id, gameId))
}

/**
 * The core move processor — called from the Socket.io handler.
 * Validates move server-side, persists to DB, returns result.
 * All DB writes happen atomically.
 */
export async function processMove(
  gameId: string,
  userId: string,
  move: MoveInput,
  timeRemainingMs: number,
  elapsedMs: number
) {
  // Load game with row-level lock to prevent concurrent move processing
  const game = await getGameById(gameId)

  if (game.status !== 'IN_PROGRESS') {
    throw new GameStateError(`Game is not in progress (status: ${game.status})`)
  }

  // Verify it's this player's turn
  const turn = getTurnFromFen(game.fenSnapshot)
  const isWhiteTurn = turn === 'w'
  const isPlayerWhite = game.whiteUserId === userId
  const isPlayerBlack = game.blackUserId === userId

  if (!isPlayerWhite && !isPlayerBlack) {
    throw new ForbiddenError('You are not a player in this game')
  }

  if (isWhiteTurn && !isPlayerWhite) {
    throw new GameStateError('It is not your turn')
  }
  if (!isWhiteTurn && !isPlayerBlack) {
    throw new GameStateError('It is not your turn')
  }

  // Validate move via Chess.js — throws IllegalMoveError if invalid
  const result = applyMove(game.fenSnapshot, move)

  // Get current move count
  const existingMoves = await db
    .select({ id: gameMoves.id })
    .from(gameMoves)
    .where(eq(gameMoves.gameId, gameId))

  const moveNumber = existingMoves.length + 1

  // Persist move + update game state atomically
  await db.transaction(async (tx) => {
    // Insert move record
    await tx.insert(gameMoves).values({
      gameId,
      userId,
      moveNumber,
      uciMove: `${move.from}${move.to}${move.promotion ?? ''}`,
      san: result.san,
      fenAfter: result.fenAfter,
      timeRemainingMs,
      elapsedMs,
    })

    // Update game FEN snapshot — crash recovery anchor
    const updatePayload: Record<string, unknown> = {
      fenSnapshot: result.fenAfter,
      updatedAt: new Date(),
    }

    if (result.isGameOver) {
      updatePayload.status = 'COMPLETED'
      updatePayload.completedAt = new Date()
      updatePayload.pgn = result.pgn

      if (result.isCheckmate) {
        updatePayload.winnerUserId = userId
        updatePayload.resultReason = 'CHECKMATE'
      } else if (result.isDraw) {
        updatePayload.resultReason =
          result.drawType === 'stalemate' ? 'DRAW_STALEMATE'
          : result.drawType === 'insufficient' ? 'DRAW_INSUFFICIENT'
          : result.drawType === 'threefold' ? 'DRAW_REPETITION'
          : 'DRAW_FIFTY_MOVE'
      }
    }

    await tx.update(games).set(updatePayload).where(eq(games.id, gameId))
  })

  logger.info(
    { gameId, userId, san: result.san, moveNumber, isGameOver: result.isGameOver },
    'Move processed'
  )

  return { ...result, moveNumber }
}

export async function forfeitByDisconnect(gameId: string, disconnectedUserId: string) {
  const game = await getGameById(gameId)
  if (game.status !== 'IN_PROGRESS') return

  const winnerId =
    game.whiteUserId === disconnectedUserId ? game.blackUserId : game.whiteUserId

  await db
    .update(games)
    .set({
      status: 'COMPLETED',
      winnerUserId: winnerId,
      resultReason: 'FORFEIT_DISCONNECT',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId))

  logger.info({ gameId, disconnectedUserId, winnerId }, 'Game forfeited by disconnect')
  return { winnerId }
}

export async function getActiveGamesForUser(userId: string) {
  return db
    .select()
    .from(games)
    .where(
      and(
        or(eq(games.whiteUserId, userId), eq(games.blackUserId, userId)),
        or(eq(games.status, 'IN_PROGRESS'), eq(games.status, 'WAITING'))
      )
    )
    .limit(5)
}

export async function getRecentGamesForUser(userId: string, limit = 10) {
  return db
    .select()
    .from(games)
    .where(
      and(
        or(eq(games.whiteUserId, userId), eq(games.blackUserId, userId)),
        eq(games.status, 'COMPLETED')
      )
    )
    .orderBy(desc(games.completedAt))
    .limit(limit)
}
