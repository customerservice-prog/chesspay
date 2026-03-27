'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '@/context/auth.context'
import { useGameSocket } from '@/hooks/useGameSocket'
import { gamesApi } from '@/lib/api/client'
import { clsx } from 'clsx'
import type { GameStartedPayload, GameOverPayload, MovePayload } from '@/hooks/useGameSocket'
import { capturedMaterial } from '@/lib/chess/material'

const Chessboard = dynamic(() => import('react-chessboard').then((m) => m.Chessboard), { ssr: false })

const RAKE_PERCENT = parseFloat(process.env.NEXT_PUBLIC_RAKE_PERCENT ?? '7.5')
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

interface Player {
  id: string
  username: string
  eloRating: number
}

interface GameState {
  id: string
  status: string
  fen: string
  white: Player | null
  black: Player | null
  whiteUserId?: string
  blackUserId?: string
  timeControl: { baseSecs: number; incrementSecs: number } | null
  wagerAmount: string
  rakePercent?: string
}

function playMoveSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 320
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.setValueAtTime(0.06, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.07)
    ctx.resume().catch(() => {})
  } catch {
    /* ignore */
  }
}

export default function GamePage() {
  const { id: gameId } = useParams<{ id: string }>()
  const { user, accessToken } = useAuth()
  const router = useRouter()

  const [game, setGame] = useState<GameState | null>(null)
  const [clock, setClock] = useState({
    white: 0,
    black: 0,
    activeSide: null as 'w' | 'b' | null,
    lastTickAt: null as number | null,
  })
  const [loading, setLoading] = useState(true)
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [moveError, setMoveError] = useState('')
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [moveCount, setMoveCount] = useState(0)
  const [sanMoves, setSanMoves] = useState<string[]>([])
  const moveStartRef = useRef(Date.now())

  const { connected, joinGame, makeMove, resign } = useGameSocket(accessToken, {
    onGameStarted: (p: GameStartedPayload) => {
      setGame((g) =>
        g
          ? {
              ...g,
              status: 'IN_PROGRESS',
              fen: p.fenSnapshot,
              white: p.white,
              black: p.black,
              timeControl: p.timeControl,
            }
          : g
      )
      setClock({
        white: p.timeControl.baseSecs * 1000,
        black: p.timeControl.baseSecs * 1000,
        activeSide: 'w',
        lastTickAt: Date.now(),
      })
    },
    onMoveApplied: (p: MovePayload) => {
      playMoveSound()
      setGame((g) => {
        if (!g) return g
        const whiteId = g.whiteUserId ?? g.white?.id
        const side = p.userId === whiteId ? 'white' : 'black'
        const next = side === 'white' ? 'b' : 'w'
        queueMicrotask(() => {
          setClock((c) => ({
            ...c,
            [side]: p.timeRemainingMs,
            activeSide: next,
            lastTickAt: Date.now(),
          }))
        })
        return { ...g, fen: p.fenAfter }
      })
      setLastMove({ from: p.move.from, to: p.move.to })
      setMoveError('')
      setMoveCount((c) => c + 1)
      setSanMoves((m) => [...m, p.san])
      moveStartRef.current = Date.now()
    },
    onMoveRejected: (p) => {
      setMoveError(p.message)
      setTimeout(() => setMoveError(''), 3000)
    },
    onGameOver: (p: GameOverPayload) => {
      setGameOver(p)
      setClock((c) => ({ ...c, activeSide: null }))
    },
    onPlayerDisconnected: () => setOpponentDisconnected(true),
    onPlayerReconnected: () => setOpponentDisconnected(false),
  })

  useEffect(() => {
    gamesApi
      .getGame(gameId)
      .then((res) => {
        const raw = res.data.game as GameState & {
          fenSnapshot?: string
          whitePlayer?: Player
          blackPlayer?: Player
        }
        const moves = res.data.moves as { san: string }[]
        const white = raw.whitePlayer ?? raw.white ?? null
        const black = raw.blackPlayer ?? raw.black ?? null
        setGame({
          ...raw,
          fen: raw.fenSnapshot ?? START_FEN,
          white,
          black,
        })
        setSanMoves(moves.map((m) => m.san))
        setMoveCount(moves.length)
        if (raw.timeControl)
          setClock({
            white: raw.timeControl.baseSecs * 1000,
            black: raw.timeControl.baseSecs * 1000,
            activeSide: raw.fenSnapshot?.split(' ')[1] === 'b' ? 'b' : 'w',
            lastTickAt: null,
          })
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false))
  }, [gameId, router])

  useEffect(() => {
    if (connected && gameId) joinGame(gameId)
  }, [connected, gameId, joinGame])

  useEffect(() => {
    if (!clock.activeSide || !clock.lastTickAt) return
    const iv = setInterval(() => {
      setClock((c) => {
        if (!c.activeSide || !c.lastTickAt) return c
        const elapsed = Date.now() - c.lastTickAt
        const side = c.activeSide === 'w' ? 'white' : 'black'
        return { ...c, [side]: Math.max(0, c[side] - elapsed), lastTickAt: Date.now() }
      })
    }, 100)
    return () => clearInterval(iv)
    // lastTickAt changes every tick; including it would tear down/recreate the interval each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-arm when side (re)starts
  }, [clock.activeSide])

  const onPieceDrop = useCallback(
    (from: string, to: string, piece: string): boolean => {
      if (!game || game.status !== 'IN_PROGRESS' || gameOver) return false
      const turn = game.fen.split(' ')[1]
      const isWhite = game.white?.id === user?.id
      if (turn === 'w' && !isWhite) return false
      if (turn === 'b' && isWhite) return false
      const promotion =
        piece[1]?.toLowerCase() === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined
      const elapsed = Date.now() - moveStartRef.current
      const side = isWhite ? 'white' : 'black'
      makeMove(gameId, { from, to, promotion }, clock[side], elapsed)
      return true
    },
    [game, gameOver, user, clock, gameId, makeMove]
  )

  function fmt(ms: number) {
    const s = Math.ceil(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const myColor = game?.white?.id === user?.id ? 'white' : 'black'
  const opponent = myColor === 'white' ? game?.black : game?.white
  const wager = parseFloat(game?.wagerAmount ?? '0')
  const pot = wager * 2
  const rakeFrac = parseFloat(game?.rakePercent ?? String(RAKE_PERCENT)) / 100
  const rakeAmount = pot * rakeFrac
  const winnerNet = pot - rakeAmount
  const { takenByWhite, takenByBlack } = game ? capturedMaterial(game.fen) : { takenByWhite: [], takenByBlack: [] }
  const myCaptures = myColor === 'white' ? takenByWhite : takenByBlack
  const oppCaptures = myColor === 'white' ? takenByBlack : takenByWhite

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-64">
        <span className="text-5xl animate-pulse-gold text-gold">♟</span>
      </div>
    )
  if (!game) return null

  const myClockMs = myColor === 'white' ? clock.white : clock.black
  const oppClockMs = myColor === 'white' ? clock.black : clock.white
  const myTurn = game.status === 'IN_PROGRESS' && clock.activeSide === (myColor === 'white' ? 'w' : 'b')
  const isLosing = gameOver && gameOver.winnerId !== user?.id && !gameOver.isDraw

  const movePairs: { n: number; w?: string; b?: string }[] = []
  for (let i = 0; i < sanMoves.length; i++) {
    const half = Math.floor(i / 2) + 1
    if (i % 2 === 0) movePairs.push({ n: half, w: sanMoves[i] })
    else movePairs[half - 1] = { ...movePairs[half - 1], b: sanMoves[i] }
  }

  function handleResign() {
    if (!confirm('Resign this game? This cannot be undone.')) return
    resign(gameId)
  }

  return (
    <div
      className={clsx(
        'max-w-6xl mx-auto flex flex-col lg:flex-row gap-5 transition-all duration-1000',
        isLosing && 'bg-red-radial'
      )}
    >
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-elevated border border-border flex items-center justify-center text-sm font-bold text-secondary shrink-0">
              {opponent?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-primary truncate">
                {opponent?.username ?? 'Waiting for opponent...'}
              </p>
              <p className="text-xs text-secondary font-mono">{opponent?.eloRating ?? '—'} ELO · Opponent</p>
              {oppCaptures.length > 0 && (
                <p className="text-[11px] text-tertiary mt-1 truncate" title="Captured material">
                  Takes: {oppCaptures.join(' ')}
                </p>
              )}
            </div>
            {opponentDisconnected && <span className="badge-red shrink-0">Disconnected</span>}
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="text-[10px] text-secondary uppercase tracking-wider mb-0.5">Their time</p>
            <div
              className={clsx(
                'font-num font-bold text-2xl px-5 py-2 rounded-lg tabular-nums transition-all duration-300',
                clock.activeSide === (myColor === 'white' ? 'b' : 'w')
                  ? 'bg-gold text-bg shadow-gold animate-pulse-gold'
                  : 'bg-elevated text-secondary'
              )}
            >
              {fmt(oppClockMs)}
            </div>
          </div>
        </div>

        <div
          className="chess-wrapper relative rounded-xl overflow-hidden"
          style={{
            boxShadow: myTurn
              ? '0 0 0 2px rgba(212,168,67,0.6),0 0 30px rgba(212,168,67,0.15)'
              : '0 0 0 1px rgba(33,41,61,1)',
          }}
        >
          <Chessboard
            position={game.fen}
            onPieceDrop={onPieceDrop}
            boardOrientation={myColor}
            animationDuration={150}
            customDarkSquareStyle={{ backgroundColor: '#1a2744' }}
            customLightSquareStyle={{ backgroundColor: '#c8d8e8' }}
            customBoardStyle={{ borderRadius: '0px' }}
            customSquareStyles={
              lastMove
                ? {
                    [lastMove.from]: { backgroundColor: 'rgba(212,168,67,0.35)' },
                    [lastMove.to]: { backgroundColor: 'rgba(212,168,67,0.5)' },
                  }
                : {}
            }
            arePiecesDraggable={game.status === 'IN_PROGRESS' && !gameOver}
          />
          {moveError && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-red/90 text-white text-sm font-semibold">
              {moveError}
            </div>
          )}
        </div>

        <div className="card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-gold/15 border border-gold/35 flex items-center justify-center text-gold text-sm font-bold shrink-0">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-primary">{user?.username}</p>
                {myTurn && <span className="badge-gold text-[10px]">YOUR TURN</span>}
              </div>
              <p className="text-xs text-secondary font-mono">{user?.eloRating} ELO · You</p>
              {myCaptures.length > 0 && (
                <p className="text-[11px] text-tertiary mt-1 truncate" title="Captured material">
                  Takes: {myCaptures.join(' ')}
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="text-[10px] text-secondary uppercase tracking-wider mb-0.5">Your time</p>
            <div
              className={clsx(
                'font-num font-bold text-2xl px-5 py-2 rounded-lg tabular-nums transition-all duration-300',
                myTurn ? 'bg-gold text-bg shadow-gold animate-pulse-gold' : 'bg-elevated text-secondary'
              )}
            >
              {fmt(myClockMs)}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:w-80 flex flex-col gap-4">
        {wager > 0 ? (
          <div className="card-gold p-5 relative overflow-hidden">
            <div
              className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
              style={{
                background: 'radial-gradient(circle,#D4A843,transparent)',
                transform: 'translate(40%,-40%)',
              }}
            />
            <p className="section-header mb-3">Live pot</p>
            <div className="font-num font-bold text-4xl text-gold text-glow-gold mb-1">${pot.toFixed(2)}</div>
            <p className="text-xs text-secondary mb-4">
              Winner receives{' '}
              <span className="text-green font-semibold">${winnerNet.toFixed(2)}</span> after{' '}
              {(rakeFrac * 100).toFixed(1)}% fee (${rakeAmount.toFixed(2)})
            </p>
            <div className="h-px bg-border mb-4" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-secondary mb-0.5">Your stake</p>
                <p className="font-mono font-semibold text-gold">${wager.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-secondary mb-0.5">Opponent stake</p>
                <p className="font-mono font-semibold text-primary">${wager.toFixed(2)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-secondary mb-0.5">Escrow</p>
                <p className="font-semibold text-green text-xs">🔒 Locked for this match</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-5 border border-gold/20 bg-gold/5">
            <p className="section-header mb-2">Rated · free</p>
            <p className="text-xs text-secondary">
              ELO is on the line; no wallet movement. Analysis and post-game review (coming next) will use this game for
              improvement stats.
            </p>
          </div>
        )}

        <div className="card p-5">
          <p className="section-header mb-2">Moves</p>
          <div className="max-h-48 overflow-y-auto font-mono text-xs border border-border rounded-lg bg-bg/40">
            {movePairs.length === 0 ? (
              <p className="p-3 text-secondary">No moves yet</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-tertiary border-b border-border">
                    <th className="px-2 py-1 w-8">#</th>
                    <th className="px-2 py-1">White</th>
                    <th className="px-2 py-1">Black</th>
                  </tr>
                </thead>
                <tbody>
                  {movePairs.map((row) => (
                    <tr key={row.n} className="border-b border-border/60">
                      <td className="px-2 py-1 text-tertiary">{row.n}</td>
                      <td className="px-2 py-1 text-primary">{row.w ?? ''}</td>
                      <td className="px-2 py-1 text-primary">{row.b ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card p-5">
          <p className="section-header">Game info</p>
          <div className="flex flex-col gap-2.5 text-sm mt-2">
            <div className="flex justify-between items-center">
              <span className="text-secondary">Status</span>
              <span className={clsx('badge', game.status === 'IN_PROGRESS' ? 'badge-green' : 'badge-gray')}>
                {game.status === 'IN_PROGRESS' ? (
                  <>
                    <span className="live-dot mr-1" />
                    LIVE
                  </>
                ) : (
                  game.status
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary">Half-moves</span>
              <span className="font-mono text-primary">{moveCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary">Socket</span>
              <span className={clsx('badge', connected ? 'badge-cyan' : 'badge-red')}>
                {connected ? 'CONNECTED' : 'OFFLINE'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary">Stake</span>
              <span className="font-mono font-semibold text-gold">
                {wager > 0 ? `$${wager.toFixed(2)} each` : 'Free rated'}
              </span>
            </div>
          </div>
        </div>

        {gameOver && (
          <div
            className={clsx(
              'card p-5 border text-center',
              gameOver.winnerId === user?.id
                ? 'border-gold/40 bg-gold/5'
                : gameOver.isDraw
                  ? 'border-border'
                  : 'border-red/30 bg-red/5'
            )}
          >
            <div className="text-4xl mb-2">
              {gameOver.isDraw ? '🤝' : gameOver.winnerId === user?.id ? '🏆' : '💀'}
            </div>
            <h3
              className={clsx(
                'text-xl font-bold mb-1',
                gameOver.winnerId === user?.id
                  ? 'text-gold text-glow-gold'
                  : gameOver.isDraw
                    ? 'text-primary'
                    : 'text-red'
              )}
            >
              {gameOver.isDraw ? 'Draw' : gameOver.winnerId === user?.id ? 'Victory!' : 'Defeated'}
            </h3>
            <p className="text-xs text-secondary mb-4">{gameOver.resultReason?.replace(/_/g, ' ')}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.push(`/result/${gameId}`)}
                className="btn-gold w-full py-2.5 text-sm font-bold"
              >
                View result
              </button>
              <button onClick={() => router.push('/lobby')} className="btn-outline w-full py-2.5 text-sm">
                Find next match
              </button>
            </div>
          </div>
        )}

        {game.status === 'WAITING' && !gameOver && (
          <div className="card p-5 text-center">
            <svg className="animate-spin h-6 w-6 text-gold mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-secondary text-sm mb-2">Waiting for both players</p>
            <p className="text-xs text-tertiary mb-3">Share the link so your opponent can connect and start the clock.</p>
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="btn-outline w-full py-2 text-xs"
            >
              Copy game link
            </button>
          </div>
        )}

        {game.status === 'IN_PROGRESS' && !gameOver && (
          <div className="card p-4">
            <button className="btn-danger w-full py-2.5 text-sm" onClick={handleResign}>
              ⚑ Resign
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
