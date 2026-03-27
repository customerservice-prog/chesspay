'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

export interface MovePayload {
  userId: string
  move: { from: string; to: string; promotion?: string }
  san: string
  fenAfter: string
  moveNumber: number
  isCheck: boolean
  timeRemainingMs: number
}

export interface GameOverPayload {
  gameId: string
  winnerId: string | null
  isDraw: boolean
  resultReason: string
}

export interface GameStartedPayload {
  gameId: string
  white: { id: string; username: string; eloRating: number }
  black: { id: string; username: string; eloRating: number }
  timeControl: { baseSecs: number; incrementSecs: number }
  fenSnapshot: string
}

export interface GameSocketEvents {
  onMoveApplied?: (payload: MovePayload) => void
  onMoveRejected?: (payload: { code: string; message: string }) => void
  onGameStarted?: (payload: GameStartedPayload) => void
  onGameOver?: (payload: GameOverPayload) => void
  onPlayerDisconnected?: (payload: { userId: string; username: string; reconnectWindowMs: number }) => void
  onPlayerReconnected?: (payload: { userId: string; username: string }) => void
  onGameState?: (payload: unknown) => void
  onError?: (payload: { code: string; message: string }) => void
}

export function useGameSocket(token: string | null, events: GameSocketEvents = {}) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const eventsRef = useRef(events)
  eventsRef.current = events

  useEffect(() => {
    if (!token) return

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? '', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('game:move_applied', (p) => eventsRef.current.onMoveApplied?.(p))
    socket.on('game:move_rejected', (p) => eventsRef.current.onMoveRejected?.(p))
    socket.on('game:started', (p) => eventsRef.current.onGameStarted?.(p))
    socket.on('game:over', (p) => eventsRef.current.onGameOver?.(p))
    socket.on('game:player_disconnected', (p) => eventsRef.current.onPlayerDisconnected?.(p))
    socket.on('game:player_reconnected', (p) => eventsRef.current.onPlayerReconnected?.(p))
    socket.on('game:state', (p) => eventsRef.current.onGameState?.(p))
    socket.on('error', (p) => eventsRef.current.onError?.(p))

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [token])

  const joinGame = useCallback((gameId: string) => {
    socketRef.current?.emit('game:join', gameId)
  }, [])

  const makeMove = useCallback(
    (gameId: string, move: { from: string; to: string; promotion?: string }, timeRemainingMs: number, elapsedMs: number) => {
      socketRef.current?.emit('game:move', { gameId, move, timeRemainingMs, elapsedMs })
    },
    []
  )

  const resign = useCallback((gameId: string) => {
    socketRef.current?.emit('game:resign', { gameId })
  }, [])

  const reportTabHidden = useCallback((gameId: string) => {
    socketRef.current?.emit('game:tab_hidden', { gameId })
  }, [])

  return { connected, joinGame, makeMove, resign, reportTabHidden }
}
