/**
 * In-memory pairing queue for the custom Node server (single-instance).
 * For horizontal scale, replace with Redis + atomic POP or a dedicated matchmaking service.
 */
import { createGame } from '../services/game.service'
import { logger } from '../../lib/logger'
import type { TimeControl } from '../../lib/validation'

function queueKey(wagerAmount: number, tc: TimeControl): string {
  return `${Number(wagerAmount).toFixed(2)}|${tc.baseSecs}|${tc.incrementSecs}`
}

const waiting = new Map<string, string>()
const pendingMatch = new Map<string, string>()

export function cancelQueue(userId: string): void {
  for (const [key, uid] of [...waiting.entries()]) {
    if (uid === userId) waiting.delete(key)
  }
  pendingMatch.delete(userId)
}

export function getQueueDepth(): number {
  return waiting.size
}

export async function joinOrMatch(
  userId: string,
  wagerAmount: number,
  timeControl: TimeControl
): Promise<{ status: 'matched'; gameId: string } | { status: 'queued' }> {
  const key = queueKey(wagerAmount, timeControl)
  const peer = waiting.get(key)

  if (peer === userId) {
    return { status: 'queued' }
  }

  if (peer) {
    waiting.delete(key)
    const [whiteUserId, blackUserId] =
      Math.random() > 0.5 ? [peer, userId] : [userId, peer]

    const game = await createGame({
      whiteUserId,
      blackUserId,
      wagerAmount,
      timeControl,
    })

    pendingMatch.set(peer, game.id)
    logger.info({ gameId: game.id, key, whiteUserId, blackUserId }, 'Matchmaking paired')
    return { status: 'matched', gameId: game.id }
  }

  waiting.set(key, userId)
  logger.info({ userId, key }, 'Matchmaking queued')
  return { status: 'queued' }
}

export function pollMatch(
  userId: string
): { status: 'matched'; gameId: string } | { status: 'queued' } | { status: 'idle' } {
  const gameId = pendingMatch.get(userId)
  if (gameId) {
    pendingMatch.delete(userId)
    return { status: 'matched', gameId }
  }
  for (const [, uid] of waiting) {
    if (uid === userId) return { status: 'queued' }
  }
  return { status: 'idle' }
}
