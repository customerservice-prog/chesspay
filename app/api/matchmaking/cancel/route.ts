import { requireAuth } from '@/lib/auth/middleware'
import { cancelQueue } from '@/server/matchmaking/queue'
import { ok, handleError } from '@/lib/api-response'

export const POST = requireAuth(async (_req, { user }) => {
  try {
    cancelQueue(user.sub)
    return ok({ cancelled: true })
  } catch (err) {
    return handleError(err, 'matchmakingCancel')
  }
})
