'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth.context'
import { gamesApi } from '@/lib/api/client'
import { clsx } from 'clsx'

const TIME_CONTROLS = [
  { label: 'Bullet', sub: '1+0', baseSecs: 60, incrementSecs: 0, icon: '⚡' },
  { label: 'Blitz', sub: '3+2', baseSecs: 180, incrementSecs: 2, icon: '🔥' },
  { label: 'Rapid', sub: '10+5', baseSecs: 600, incrementSecs: 5, icon: '⏱' },
  { label: 'Classical', sub: '30+0', baseSecs: 1800, incrementSecs: 0, icon: '♟' },
]

const WAGER_OPTIONS = [
  { value: 0, label: 'Free', sub: 'Points only' },
  { value: 5, label: '$5', sub: 'Entry level' },
  { value: 10, label: '$10', sub: 'Standard' },
  { value: 25, label: '$25', sub: 'Competitive' },
  { value: 50, label: '$50', sub: 'High stakes' },
  { value: 100, label: '$100', sub: 'Elite' },
]

export default function LobbyPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [selectedTC, setSelectedTC] = useState(TIME_CONTROLS[2])
  const [selectedWager, setSelectedWager] = useState(WAGER_OPTIONS[0])
  const [searching, setSearching] = useState(false)
  const [searchSecs, setSearchSecs] = useState(0)
  const [error, setError] = useState('')

  async function startSearch() {
    setError('')
    setSearching(true)
    setSearchSecs(0)
    const timer = setInterval(() => setSearchSecs(s => s + 1), 1000)
    try {
      const res = await gamesApi.createGame({
        wagerAmount: selectedWager.value,
        timeControl: { baseSecs: selectedTC.baseSecs, incrementSecs: selectedTC.incrementSecs },
        opponentId: user?.id,
      })
      clearInterval(timer)
      const game = res.data.game as { id: string }
      router.push(`/game/${game.id}`)
    } catch (err: unknown) {
      clearInterval(timer)
      setSearching(false)
      setError(err instanceof Error ? err.message : 'Failed to create game')
    }
  }

  const pot = selectedWager.value * 2
  const rake = pot * 0.075
  const winnerNet = pot - rake

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-primary tracking-wide">FIND A MATCH</h1>
        <p className="text-secondary text-sm mt-1">Select your time control and wager to enter the queue</p>
      </div>

      {/* Time control */}
      <div className="card p-6">
        <p className="section-header">Time Control</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {TIME_CONTROLS.map(tc => (
            <button key={tc.label} onClick={() => setSelectedTC(tc)}
              className={clsx('p-4 rounded-xl border text-center transition-all duration-150 group',
                selectedTC.label === tc.label
                  ? 'border-gold/50 bg-gold/8 shadow-gold-sm'
                  : 'border-border bg-elevated hover:border-border-bright hover:bg-overlay'
              )}>
              <div className="text-2xl mb-1">{tc.icon}</div>
              <div className={clsx('font-semibold text-sm', selectedTC.label === tc.label ? 'text-gold' : 'text-primary')}>{tc.label}</div>
              <div className="text-xs text-secondary mt-0.5 font-mono">{tc.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Wager */}
      <div className="card p-6">
        <p className="section-header">Wager Amount</p>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {WAGER_OPTIONS.map(w => (
            <button key={w.value} onClick={() => setSelectedWager(w)}
              className={clsx('p-3 rounded-xl border text-center transition-all duration-150',
                selectedWager.value === w.value
                  ? 'border-gold/50 bg-gold/8 shadow-gold-sm'
                  : 'border-border bg-elevated hover:border-border-bright'
              )}>
              <div className={clsx('font-num font-bold text-base', selectedWager.value === w.value ? 'text-gold' : 'text-primary')}>{w.label}</div>
              <div className="text-[10px] text-secondary mt-0.5">{w.sub}</div>
            </button>
          ))}
        </div>
        {selectedWager.value === 0 && (
          <p className="text-xs text-secondary">Points-only mode — no real funds at risk</p>
        )}
      </div>

      {/* Match summary */}
      <div className="card-gold p-6">
        <p className="section-header mb-5">Match Summary</p>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <p className="text-xs text-secondary mb-1">Time Control</p>
            <p className="font-semibold text-primary">{selectedTC.label} <span className="text-secondary font-mono text-sm">({selectedTC.sub})</span></p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">Your Stake</p>
            <p className="font-num font-bold text-xl text-gold">{selectedWager.value === 0 ? 'Free' : `$${selectedWager.value}`}</p>
          </div>
          {selectedWager.value > 0 && (
            <>
              <div>
                <p className="text-xs text-secondary mb-1">Total Pot</p>
                <p className="font-mono font-semibold text-primary">${pot.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-secondary mb-1">Winner Receives</p>
                <p className="font-mono font-bold text-green text-glow-green">${winnerNet.toFixed(2)}</p>
              </div>
            </>
          )}
        </div>

        {selectedWager.value > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg/60 border border-border mb-5">
            <span className="text-gold text-xs">◈</span>
            <span className="text-xs text-secondary">7.5% platform fee applies · Funds locked in escrow at game start</span>
          </div>
        )}

        {error && <div className="px-4 py-3 rounded-lg text-sm text-red border border-red/20 bg-red/8 mb-4">{error}</div>}

        {!searching ? (
          <button onClick={startSearch} className="btn-gold w-full py-4 text-base font-bold tracking-wide">
            ♟ ENTER MATCH
          </button>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-gold" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span className="font-num font-bold text-xl text-primary">SEARCHING <span className="text-gold">{String(Math.floor(searchSecs/60)).padStart(2,'0')}:{String(searchSecs%60).padStart(2,'0')}</span></span>
            </div>
            <p className="text-xs text-secondary text-center">Game created — open the URL in a second tab to play both sides locally</p>
            <button onClick={() => setSearching(false)} className="btn-outline px-6 py-2 text-sm">Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}
