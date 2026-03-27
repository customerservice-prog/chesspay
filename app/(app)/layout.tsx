'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth.context'
import { clsx } from 'clsx'

const NAV = [
  { href: '/dashboard', icon: '⬡', label: 'Dashboard' },
  { href: '/lobby',     icon: '♟', label: 'Play' },
  { href: '/wallet',    icon: '◈', label: 'Wallet' },
  { href: '/history',   icon: '◷', label: 'History' },
  { href: '/profile',   icon: '◉', label: 'Profile' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [time, setTime] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login')
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <span className="text-5xl animate-pulse-gold text-gold">♟</span>
        <div className="text-secondary text-sm font-mono tracking-widest">LOADING...</div>
      </div>
    </div>
  )

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen flex bg-bg" style={{ backgroundImage: 'radial-gradient(ellipse at top left,rgba(212,168,67,0.04) 0%,transparent 50%)' }}>
      <aside className="w-14 lg:w-56 flex flex-col bg-surface border-r border-border shrink-0 z-20 relative">
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.5),transparent)' }} />

        <div className="h-14 flex items-center justify-center lg:justify-start lg:px-5 border-b border-border">
          <span className="text-gold text-2xl" style={{ filter: 'drop-shadow(0 0 8px rgba(212,168,67,0.7))' }}>♟</span>
          <div className="hidden lg:flex flex-col ml-2.5">
            <span className="font-display text-xl text-primary tracking-wider leading-none">CHESSPAY</span>
            <span className="text-[9px] text-secondary tracking-[0.2em] uppercase">Competitive Arena</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-between px-5 py-2 border-b border-border bg-bg/50">
          <div className="flex items-center gap-1.5">
            <span className="live-dot" />
            <span className="text-[10px] text-secondary uppercase tracking-widest">Live</span>
          </div>
          <span className="font-mono text-xs text-gold">{time}</span>
        </div>

        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
          {NAV.map(({ href, icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative',
                active ? 'bg-gold/10 text-gold' : 'text-secondary hover:text-primary hover:bg-elevated'
              )}>
                {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gold rounded-r-full" style={{ boxShadow: '0 0 8px rgba(212,168,67,0.9)' }} />}
                <span className={clsx('text-base shrink-0', active && 'text-glow-gold')}>{icon}</span>
                <span className="hidden lg:block text-sm font-medium">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="h-px mx-4 mb-2" style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.3),transparent)' }} />

        <div className="p-3">
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <div className="relative shrink-0">
              <div className="h-8 w-8 rounded-full bg-gold/15 border border-gold/35 flex items-center justify-center text-gold text-xs font-bold">
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green rounded-full border-2 border-surface" style={{ boxShadow: '0 0 6px rgba(0,210,106,0.8)' }} />
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary truncate">{user?.username}</p>
              <p className="text-[10px] text-secondary font-mono">{user?.eloRating} ELO</p>
            </div>
            <button onClick={() => logout()} className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-tertiary hover:text-red hover:bg-red/10 transition-colors text-sm" title="Sign out">⏻</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        <div className="h-14 border-b border-border flex items-center px-6 gap-4 bg-surface/60 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex-1" />
          {user?.kycStatus !== 'VERIFIED' && (
            <Link href="/profile" className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gold/8 border border-gold/20 hover:bg-gold/12 transition-colors">
              <span className="text-gold text-xs">⚠</span>
              <span className="text-gold text-xs font-semibold">Verify to Wager</span>
            </Link>
          )}
        </div>
        <div className="flex-1 p-5 lg:p-8 animate-fade-in">{children}</div>
      </main>
    </div>
  )
}
