import { requireAuth } from '@/lib/auth/middleware'
import { joinQueueSchema } from '@/lib/validation'
import { joinOrMatch } from '@/server/matchmaking/queue'
import { ok, handleError } from '@/lib/api-response'

export const POST = requireAuth(async (req, { user }) => {
  try {
    const body = await req.json()
    const input = joinQueueSchema.parse(body)
    const result = await joinOrMatch(user.sub, input.wagerAmount, input.timeControl)
    return ok(result)
  } catch (err) {
    return handleError(err, 'matchmakingJoin')
  }
})
