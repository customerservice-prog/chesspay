'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth.context'
import { gamesApi } from '@/lib/api/client'
import { formatDistanceToNow } from 'date-fns'
import { clsx } from 'clsx'

interface Game { id:string; status:string; wagerAmount:string; winnerUserId:string|null; resultReason:string|null; completedAt:string|null; whiteUserId:string; blackUserId:string }

export default function HistoryPage() {
  const { user } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    gamesApi.getRecent().then(r => setGames(r.data.games as Game[])).finally(() => setLoading(false))
  }, [])

  const wins = games.filter(g => g.winnerUserId === user?.id).length
  const losses = games.filter(g => g.winnerUserId && g.winnerUserId !== user?.id).length
  const draws = games.filter(g => !g.winnerUserId && g.status === 'COMPLETED').length
  const earnings = games.filter(g => g.winnerUserId === user?.id).reduce((s, g) => s + parseFloat(g.wagerAmount) * 2 * 0.925, 0)

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-primary tracking-wide">GAME HISTORY</h1>
        <p className="text-secondary text-sm mt-1">Your complete match record</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label:'Wins', value: wins.toString(), color:'text-green' },
          { label:'Losses', value: losses.toString(), color:'text-red' },
          { label:'Draws', value: draws.toString(), color:'text-gold' },
          { label:'Earnings', value: `$${earnings.toFixed(2)}`, color:'text-green' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="stat-label mb-1">{s.label}</p>
            <p className={clsx('font-num font-bold text-2xl', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-primary">Recent Games</h2>
        </div>
        {loading ? (
          <div className="py-16 text-center text-secondary">Loading...</div>
        ) : games.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3 opacity-20">♜</div>
            <p className="text-secondary">No games yet. <Link href="/lobby" className="text-gold hover:underline">Find a match →</Link></p>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr className="border-b border-border">
              <th className="px-6 py-3">Result</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3 text-right">Wager</th>
              <th className="px-6 py-3 text-right">When</th>
            </tr></thead>
            <tbody>
              {games.map(g => {
                const won = g.winnerUserId === user?.id
                const draw = !g.winnerUserId && g.status === 'COMPLETED'
                return (
                  <tr key={g.id} className="border-t border-border hover:bg-elevated/40 transition-colors">
                    <td className="px-6 py-3.5">
                      <Link href={`/result/${g.id}`} className="flex items-center gap-2 group">
                        <div className={clsx('w-1.5 h-6 rounded-full', won ? 'bg-green' : draw ? 'bg-gold' : 'bg-red')} />
                        <span className={clsx('font-semibold text-sm group-hover:underline', won ? 'text-green' : draw ? 'text-gold' : 'text-red')}>
                          {won ? 'Victory' : draw ? 'Draw' : 'Defeat'}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-secondary text-sm">{g.resultReason?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-gold font-semibold">${parseFloat(g.wagerAmount).toFixed(2)}</td>
                    <td className="px-6 py-3.5 text-right text-xs text-secondary">{g.completedAt ? formatDistanceToNow(new Date(g.completedAt), { addSuffix: true }) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
