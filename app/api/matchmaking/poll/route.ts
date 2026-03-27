import { requireAuth } from '@/lib/auth/middleware'
import { pollMatch } from '@/server/matchmaking/queue'
import { ok, handleError } from '@/lib/api-response'

export const GET = requireAuth(async (_req, { user }) => {
  try {
    return ok(pollMatch(user.sub))
  } catch (err) {
    return handleError(err, 'matchmakingPoll')
  }
})
