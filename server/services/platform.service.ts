import { and, count, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { db } from '../../db/client'
import { games, users } from '../../db/schema'
import { getQueueDepth } from '../matchmaking/queue'

export async function getPlatformActivity() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [liveRow] = await db
    .select({ n: count() })
    .from(games)
    .where(inArray(games.status, ['WAITING', 'IN_PROGRESS']))

  const [playersRow] = await db.select({ n: count() }).from(users)

  const [completed24hRow] = await db
    .select({ n: count() })
    .from(games)
    .where(
      and(eq(games.status, 'COMPLETED'), isNotNull(games.completedAt), gte(games.completedAt, since))
    )

  const recentWins = await db
    .select({
      username: users.username,
      wagerAmount: games.wagerAmount,
      completedAt: games.completedAt,
    })
    .from(games)
    .innerJoin(users, eq(games.winnerUserId, users.id))
    .where(
      and(
        eq(games.status, 'COMPLETED'),
        isNotNull(games.winnerUserId),
        isNotNull(games.completedAt),
        gte(games.completedAt, since)
      )
    )
    .orderBy(desc(games.completedAt))
    .limit(12)

  return {
    liveMatches: Number(liveRow?.n ?? 0),
    registeredPlayers: Number(playersRow?.n ?? 0),
    gamesCompleted24h: Number(completed24hRow?.n ?? 0),
    matchmakingSearching: getQueueDepth(),
    recentWins: recentWins.map((r) => ({
      username: r.username,
      wagerAmount: r.wagerAmount,
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
  }
}
