import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getGameWithPlayers, getGameMoves } from '@/server/services/game.service'
import { ok, handleError } from '@/lib/api-response'

export const GET = requireAuth(async (req, { user }, params?: { params: { id: string } }) => {
  try {
    const gameId = params?.params?.id
    if (!gameId) return handleError({ code: 'NOT_FOUND', message: 'Game ID required', statusCode: 404 })

    const [game, moves] = await Promise.all([
      getGameWithPlayers(gameId),
      getGameMoves(gameId),
    ])

    // Only players can see game details
    if (game.whiteUserId !== user.sub && game.blackUserId !== user.sub) {
      return handleError({ code: 'FORBIDDEN', message: 'Not your game', statusCode: 403 })
    }

    return ok({ game, moves })
  } catch (err) {
    return handleError(err, 'getGame')
  }
})
