'use client'

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useGameSocket } from '@/hooks/useGameSocket'
import { useAuth } from './auth.context'
import { gamesApi } from '@/lib/api/client'

type QueueStatus = 'idle' | 'searching' | 'matched'

interface MatchmakingState {
  status: QueueStatus
  gameId: string | null
  wagerAmount: number
  timeControl: { baseSecs: number; incrementSecs: number }
  searchSeconds: number
}

interface MatchmakingContextValue extends MatchmakingState {
  joinQueue: (wager: number, tc: { baseSecs: number; incrementSecs: number }) => void
  leaveQueue: () => void
}

const MatchmakingContext = createContext<MatchmakingContextValue | null>(null)

export function MatchmakingProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth()
  const router = useRouter()
  const timerRef = useRef<NodeJS.Timeout>()

  const [state, setState] = useState<MatchmakingState>({
    status: 'idle',
    gameId: null,
    wagerAmount: 0,
    timeControl: { baseSecs: 600, incrementSecs: 5 },
    searchSeconds: 0,
  })

  // Simplified matchmaking: creates a game against a bot/second test user
  // In Phase 2 this connects to the real matchmaking queue via socket
  const joinQueue = useCallback(async (wager: number, tc: { baseSecs: number; incrementSecs: number }) => {
    setState(s => ({ ...s, status: 'searching', wagerAmount: wager, timeControl: tc, searchSeconds: 0 }))

    // Tick search timer
    timerRef.current = setInterval(() => {
      setState(s => ({ ...s, searchSeconds: s.searchSeconds + 1 }))
    }, 1000)

    // For Phase 1 local testing: after 3 seconds simulate a match
    // by creating a game with the second seed user (bob)
    setTimeout(async () => {
      clearInterval(timerRef.current)
      try {
        // In real matchmaking this comes from the server push
        // For now we hit the API to create a direct game
        const res = await gamesApi.createGame({
          wagerAmount: wager,
          timeControl: tc,
          opponentId: 'SEED_BOB_ID', // replaced by real matchmaking in Phase 2
        })
        const game = res.data.game as { id: string }
        setState(s => ({ ...s, status: 'matched', gameId: game.id }))
        router.push(`/game/${game.id}`)
      } catch {
        // If direct game fails just navigate to lobby for manual testing
        setState(s => ({ ...s, status: 'idle' }))
      }
    }, 3000)
  }, [router])

  const leaveQueue = useCallback(() => {
    clearInterval(timerRef.current)
    setState(s => ({ ...s, status: 'idle', searchSeconds: 0 }))
  }, [])

  return (
    <MatchmakingContext.Provider value={{ ...state, joinQueue, leaveQueue }}>
      {children}
    </MatchmakingContext.Provider>
  )
}

export function useMatchmaking() {
  const ctx = useContext(MatchmakingContext)
  if (!ctx) throw new Error('useMatchmaking must be inside MatchmakingProvider')
  return ctx
}
