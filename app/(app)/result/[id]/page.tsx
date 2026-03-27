'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth.context'
import { gamesApi } from '@/lib/api/client'
import { format } from 'date-fns'
import { clsx } from 'clsx'

interface GameResult { id:string; status:string; whiteUserId:string; blackUserId:string; winnerUserId:string|null; resultReason:string|null; wagerAmount:string; potTotal:string; rakePercent:string; payoutStatus:string; completedAt:string|null; whitePlayer:{id:string;username:string;eloRating:number}; blackPlayer:{id:string;username:string;eloRating:number} }

const REASONS: Record<string,string> = {
  CHECKMATE:'Checkmate',TIMEOUT:'Time Out',RESIGNATION:'Resignation',
  DRAW_AGREEMENT:'Draw by Agreement',DRAW_STALEMATE:'Stalemate',
  DRAW_INSUFFICIENT:'Insufficient Material',DRAW_REPETITION:'Threefold Repetition',
  DRAW_FIFTY_MOVE:'Fifty-Move Rule',FORFEIT_DISCONNECT:'Forfeit — Disconnect',
}

export default function ResultPage() {
  const { id: gameId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const [game, setGame] = useState<GameResult|null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    gamesApi.getGame(gameId)
      .then(r => setGame(r.data.game as GameResult))
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false))
  }, [gameId, router])

  if (loading) return <div className="flex justify-center py-20"><span className="text-4xl animate-pulse-gold text-gold">♟</span></div>
  if (!game) return null

  const isWinner = game.winnerUserId === user?.id
  const isDraw = !game.winnerUserId
  const wager = parseFloat(game.wagerAmount)
  const pot = parseFloat(game.potTotal)
  const rake = pot * (parseFloat(game.rakePercent) / 100)
  const winnerNet = pot - rake

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5 animate-slide-up">

      {/* Hero */}
      <div className={clsx('rounded-2xl p-8 text-center relative overflow-hidden border',
        isDraw ? 'border-border bg-surface' :
        isWinner ? 'border-gold/40' : 'border-red/30'
      )} style={isWinner ? { background: 'radial-gradient(ellipse at top,rgba(212,168,67,0.08) 0%,rgba(13,17,23,1) 70%)' } :
                isDraw ? {} : { background: 'radial-gradient(ellipse at top,rgba(255,59,59,0.06) 0%,rgba(13,17,23,1) 70%)' }}>
        <div className="text-6xl mb-4">{isDraw ? '🤝' : isWinner ? '🏆' : '💀'}</div>
        <h1 className={clsx('font-display text-5xl tracking-wide mb-2',
          isDraw ? 'text-primary' : isWinner ? 'text-gold text-glow-gold' : 'text-red text-glow-red'
        )}>
          {isDraw ? 'DRAW' : isWinner ? 'VICTORY' : 'DEFEAT'}
        </h1>
        <p className="text-secondary">{REASONS[game.resultReason ?? ''] ?? game.resultReason ?? '—'}</p>
        {game.completedAt && <p className="text-xs text-tertiary mt-2 font-mono">{format(new Date(game.completedAt), 'MMM d, yyyy · HH:mm')}</p>}
      </div>

      {/* Players */}
      <div className="card p-6">
        <p className="section-header">Players</p>
        <div className="flex items-center justify-between">
          {[
            { player: game.whitePlayer, color: 'White', piece: '♔', isMe: game.whitePlayer?.id === user?.id, winner: game.winnerUserId === game.whitePlayer?.id },
            { player: game.blackPlayer, color: 'Black', piece: '♚', isMe: game.blackPlayer?.id === user?.id, winner: game.winnerUserId === game.blackPlayer?.id },
          ].map(({ player, color, piece, isMe, winner }) => (
            <div key={color} className={clsx('flex flex-col items-center gap-2 p-4 rounded-xl flex-1',
              isMe ? 'bg-gold/5 border border-gold/20' : 'bg-elevated border border-border'
            )}>
              <span className={clsx('text-3xl', isMe ? 'text-gold' : 'text-secondary')}>{piece}</span>
              <p className={clsx('font-semibold text-sm', isMe ? 'text-gold' : 'text-primary')}>{player?.username}</p>
              <p className="text-xs text-secondary font-mono">{player?.eloRating} ELO</p>
              <p className="text-xs text-secondary">{color}</p>
              {winner && <span className="badge-gold">WINNER</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Payout */}
      {wager > 0 && (
        <div className="card-gold p-6">
          <p className="section-header">Payout Breakdown</p>
          <div className="flex flex-col gap-3 text-sm">
            {[
              { label: 'Total Pot', value: `$${pot.toFixed(2)}`, color: 'text-primary' },
              { label: `Platform Fee (${game.rakePercent}%)`, value: `-$${rake.toFixed(2)}`, color: 'text-secondary' },
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-secondary">{row.label}</span>
                <span className={clsx('font-mono', row.color)}>{row.value}</span>
              </div>
            ))}
            <div className="h-px bg-border" />
            <div className="flex justify-between">
              <span className="font-semibold text-primary">Winner Receives</span>
              <span className="font-num font-bold text-xl text-green text-glow-green">${winnerNet.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-secondary">Payout Status</span>
              <span className={clsx('badge',
                game.payoutStatus === 'RELEASED' ? 'badge-green' :
                game.payoutStatus === 'HELD_ANTICHEAT' ? 'badge-red' : 'badge-gold'
              )}>
                {game.payoutStatus === 'HELD_ANTICHEAT' ? '⚠ UNDER REVIEW' :
                 game.payoutStatus === 'RELEASED' ? '✓ PAID OUT' : '⏳ PENDING'}
              </span>
            </div>
            {game.payoutStatus === 'HELD_ANTICHEAT' && (
              <div className="mt-2 p-3 rounded-lg bg-red/8 border border-red/20 text-xs text-secondary">
                ⚠ Anti-cheat analysis in progress. Funds held for up to 15 minutes pending review.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => router.push('/lobby')} className="btn-gold flex-1 py-3.5 font-bold tracking-wide">♟ PLAY AGAIN</button>
        <button onClick={() => router.push('/dashboard')} className="btn-outline flex-1 py-3.5">Dashboard</button>
      </div>
    </div>
  )
}
