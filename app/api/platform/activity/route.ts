import { getPlatformActivity } from '@/server/services/platform.service'
import { getQueueDepth } from '@/server/matchmaking/queue'
import { ok } from '@/lib/api-response'
import { logger } from '@/lib/logger'

/** Public aggregate stats — no PII beyond public usernames on recent wins ticker */
export async function GET() {
  try {
    const activity = await getPlatformActivity()
    return ok(activity)
  } catch (err) {
    logger.warn({ err }, 'platform activity DB unavailable — returning fallback')
    return ok({
      liveMatches: 0,
      registeredPlayers: 0,
      gamesCompleted24h: 0,
      matchmakingSearching: getQueueDepth(),
      recentWins: [] as { username: string; wagerAmount: string; completedAt: string | null }[],
    })
  }
}
