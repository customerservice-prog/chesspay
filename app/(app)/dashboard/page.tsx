'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth.context'
import { walletApi, gamesApi } from '@/lib/api/client'
import { formatDistanceToNow } from 'date-fns'

interface Balance { available: number; locked: number; total: number }
interface Game { id:string; status:string; wagerAmount:string; winnerUserId:string|null; resultReason:string|null; completedAt:string|null; whiteUserId:string; blackUserId:string }

export default function DashboardPage() {
  const { user } = useAuth()
  const [balance, setBalance] = useState<Balance|null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([walletApi.getBalance(), gamesApi.getRecent()])
      .then(([b, g]) => {
        if (b.status === 'fulfilled') setBalance(b.value.data.balance)
        if (g.status === 'fulfilled') setGames(g.value.data.games as Game[])
      }).finally(() => setLoading(false))
  }, [])

  const wins = games.filter(g => g.winnerUserId === user?.id).length
  const losses = games.filter(g => g.winnerUserId && g.winnerUserId !== user?.id).length
  const winRate = games.length > 0 ? Math.round((wins / games.length) * 100) : 0

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-secondary uppercase tracking-widest mb-1">Welcome back</p>
          <h1 className="font-display text-4xl text-primary tracking-wide">{user?.username?.toUpperCase()}</h1>
          <p className="text-secondary text-sm mt-0.5 font-mono">{user?.eloRating} ELO · {user?.kycStatus}</p>
        </div>
        <Link href="/lobby"
          className="btn-gold px-6 py-3 text-sm font-bold tracking-wide"
          style={{ fontFamily: '"DM Sans", sans-serif' }}>
          ♟ FIND MATCH
        </Link>
      </div>

      {/* Balance hero */}
      <div className="card-gold p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle,#D4A843,transparent)', transform: 'translate(30%,-30%)' }} />
        <div className="relative">
          <p className="text-xs text-secondary uppercase tracking-widest mb-3">Total Balance</p>
          <div className="flex items-end gap-4 mb-4">
            <span className="font-num text-5xl font-bold text-gold text-glow-gold">
              ${loading ? '—' : balance?.available.toFixed(2) ?? '0.00'}
            </span>
            <span className="text-secondary text-sm mb-2 font-mono">USD</span>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-secondary mb-0.5">Available</p>
              <p className="font-mono text-sm text-green font-semibold">${balance?.available.toFixed(2) ?? '—'}</p>
            </div>
            <div className="w-px bg-border" />
            <div>
              <p className="text-xs text-secondary mb-0.5">In Escrow</p>
              <p className="font-mono text-sm text-gold font-semibold">${balance?.locked.toFixed(2) ?? '—'}</p>
            </div>
            <div className="w-px bg-border" />
            <div>
              <p className="text-xs text-secondary mb-0.5">Total</p>
              <p className="font-mono text-sm text-primary font-semibold">${balance?.total.toFixed(2) ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 50 ? 'text-green' : 'text-red', sub: `${wins}W / ${losses}L` },
          { label: 'ELO Rating', value: user?.eloRating?.toString() ?? '—', color: 'text-gold', sub: 'Current rating' },
          { label: 'Games Played', value: games.length.toString(), color: 'text-primary', sub: 'Total history' },
          { label: 'KYC Status', value: user?.kycStatus ?? '—', color: user?.kycStatus === 'VERIFIED' ? 'text-green' : 'text-gold', sub: 'Identity verification' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="stat-label mb-2">{s.label}</p>
            <p className={`font-num text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-secondary mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick actions + recent games */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Quick actions */}
        <div className="card p-5 flex flex-col gap-3">
          <p className="section-header">Quick Actions</p>
          <Link href="/lobby" className="flex items-center gap-3 p-3 rounded-lg bg-elevated border border-border hover:border-gold/40 hover:bg-gold/5 transition-all group">
            <span className="text-xl text-gold">♟</span>
            <div>
              <p className="text-sm font-semibold text-primary group-hover:text-gold transition-colors">Find a Match</p>
              <p className="text-xs text-secondary">Enter the matchmaking queue</p>
            </div>
          </Link>
          <Link href="/wallet" className="flex items-center gap-3 p-3 rounded-lg bg-elevated border border-border hover:border-green/40 hover:bg-green/5 transition-all group">
            <span className="text-xl text-green">◈</span>
            <div>
              <p className="text-sm font-semibold text-primary group-hover:text-green transition-colors">Wallet</p>
              <p className="text-xs text-secondary">Deposit, withdraw, history</p>
            </div>
          </Link>
          <Link href="/history" className="flex items-center gap-3 p-3 rounded-lg bg-elevated border border-border hover:border-blue/40 hover:bg-blue/5 transition-all group">
            <span className="text-xl text-blue">◷</span>
            <div>
              <p className="text-sm font-semibold text-primary group-hover:text-blue transition-colors">Game History</p>
              <p className="text-xs text-secondary">Review past matches</p>
            </div>
          </Link>
        </div>

        {/* Recent games */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="section-header mb-0">Recent Results</p>
            <Link href="/history" className="text-xs text-gold hover:text-gold-glow transition-colors">View all →</Link>
          </div>

          {games.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3 opacity-30">♜</div>
              <p className="text-secondary text-sm">No games yet</p>
              <Link href="/lobby" className="text-gold text-sm hover:underline mt-1 inline-block">Find your first match →</Link>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {games.slice(0, 6).map(g => {
                const won = g.winnerUserId === user?.id
                const draw = !g.winnerUserId && g.status === 'COMPLETED'
                return (
                  <Link key={g.id} href={`/result/${g.id}`}
                    className="flex items-center justify-between py-3 hover:bg-elevated/40 px-2 -mx-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-8 rounded-full ${won ? 'bg-green' : draw ? 'bg-gold' : 'bg-red'}`}
                        style={{ boxShadow: won ? '0 0 8px rgba(0,210,106,0.6)' : draw ? '0 0 8px rgba(212,168,67,0.6)' : '0 0 8px rgba(255,59,59,0.6)' }} />
                      <div>
                        <p className={`text-sm font-semibold ${won ? 'text-green' : draw ? 'text-gold' : 'text-red'}`}>
                          {won ? 'Victory' : draw ? 'Draw' : 'Defeat'}
                        </p>
                        <p className="text-xs text-secondary">{g.resultReason?.replace(/_/g, ' ') ?? '—'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-semibold text-gold">${parseFloat(g.wagerAmount).toFixed(2)}</p>
                      <p className="text-xs text-secondary">{g.completedAt ? formatDistanceToNow(new Date(g.completedAt), { addSuffix: true }) : '—'}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
