import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { createGameSchema } from '@/lib/validation'
import { createGame, getRecentGamesForUser, getActiveGamesForUser } from '@/server/services/game.service'
import { ok, created, handleError } from '@/lib/api-response'

// POST /api/games — create a new game (direct challenge)
export const POST = requireAuth(async (req, { user }) => {
  try {
    const body = await req.json()
    const input = createGameSchema.parse(body)

    if (!input.opponentId) {
      return handleError(
        { code: 'VALIDATION_ERROR', message: 'opponentId required for direct game creation', statusCode: 400 }
      )
    }

    // Randomly assign colors
    const [whiteUserId, blackUserId] =
      Math.random() > 0.5
        ? [user.sub, input.opponentId]
        : [input.opponentId, user.sub]

    const game = await createGame({
      whiteUserId,
      blackUserId,
      wagerAmount: input.wagerAmount,
      timeControl: input.timeControl,
    })

    return created({ game })
  } catch (err) {
    return handleError(err, 'createGame')
  }
})

// GET /api/games — get current user's games
export const GET = requireAuth(async (req, { user }) => {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') ?? 'active'

    const games =
      type === 'active'
        ? await getActiveGamesForUser(user.sub)
        : await getRecentGamesForUser(user.sub)

    return ok({ games })
  } catch (err) {
    return handleError(err, 'getGames')
  }
})
