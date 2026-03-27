'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth.context'
import { matchmakingApi, platformApi } from '@/lib/api/client'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'

const TIME_CONTROLS = [
  { label: 'Bullet', sub: '1+0', baseSecs: 60, incrementSecs: 0, icon: '⚡' },
  { label: 'Blitz', sub: '3+2', baseSecs: 180, incrementSecs: 2, icon: '🔥' },
  { label: 'Rapid', sub: '10+5', baseSecs: 600, incrementSecs: 5, icon: '⏱' },
  { label: 'Classical', sub: '30+0', baseSecs: 1800, incrementSecs: 0, icon: '♟' },
]

const WAGER_OPTIONS = [
  { value: 0, label: 'Free', sub: 'Rated · ELO' },
  { value: 5, label: '$5', sub: 'Entry level' },
  { value: 10, label: '$10', sub: 'Standard' },
  { value: 25, label: '$25', sub: 'Competitive' },
  { value: 50, label: '$50', sub: 'High stakes' },
  { value: 100, label: '$100', sub: 'Elite' },
]

const RAKE_PERCENT = parseFloat(process.env.NEXT_PUBLIC_RAKE_PERCENT ?? '7.5')

export default function LobbyPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [selectedTC, setSelectedTC] = useState(TIME_CONTROLS[2])
  const [selectedWager, setSelectedWager] = useState(WAGER_OPTIONS[0])
  const [searching, setSearching] = useState(false)
  const [searchSecs, setSearchSecs] = useState(0)
  const [error, setError] = useState('')
  const [activity, setActivity] = useState<{
    liveMatches: number
    registeredPlayers: number
    gamesCompleted24h: number
    matchmakingSearching: number
    recentWins: { username: string; wagerAmount: string; completedAt: string | null }[]
  } | null>(null)

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const searchingRef = useRef(false)

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current)
      searchTimerRef.current = null
    }
  }, [])

  const loadActivity = useCallback(() => {
    platformApi
      .activity()
      .then((res) => setActivity(res.data))
      .catch(() => setActivity(null))
  }, [])

  useEffect(() => {
    loadActivity()
    const t = setInterval(loadActivity, 15000)
    return () => clearInterval(t)
  }, [loadActivity])

  useEffect(() => {
    searchingRef.current = searching
  }, [searching])

  useEffect(() => {
    return () => {
      clearPoll()
      if (searchingRef.current) {
        matchmakingApi.cancel().catch(() => {})
      }
    }
  }, [clearPoll])

  async function startSearch() {
    setError('')
    setSearching(true)
    setSearchSecs(0)
    searchTimerRef.current = setInterval(() => setSearchSecs((s) => s + 1), 1000)

    try {
      const res = await matchmakingApi.join({
        wagerAmount: selectedWager.value,
        timeControl: { baseSecs: selectedTC.baseSecs, incrementSecs: selectedTC.incrementSecs },
      })

      if (res.data.status === 'matched') {
        clearPoll()
        setSearching(false)
        router.push(`/game/${res.data.gameId}`)
        return
      }

      pollTimerRef.current = setInterval(async () => {
        try {
          const p = await matchmakingApi.poll()
          if (p.data.status === 'matched') {
            clearPoll()
            setSearching(false)
            router.push(`/game/${p.data.gameId}`)
          }
        } catch {
          clearPoll()
          setSearching(false)
          setError('Matchmaking connection lost — try again')
        }
      }, 650)
    } catch (err: unknown) {
      clearPoll()
      setSearching(false)
      setError(err instanceof Error ? err.message : 'Failed to join queue')
    }
  }

  function cancelSearch() {
    clearPoll()
    matchmakingApi.cancel().catch(() => {})
    setSearching(false)
    setSearchSecs(0)
  }

  const pot = selectedWager.value * 2
  const rake = pot * (RAKE_PERCENT / 100)
  const winnerNet = pot - rake
  const feeLabel = `${RAKE_PERCENT}%`

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-primary tracking-wide">FIND A MATCH</h1>
        <p className="text-secondary text-sm mt-1 max-w-2xl">
          Free rated play builds skill and trust first — then add stakes when you are ready. You are paired with the next
          opponent on the same time control and stake tier.
        </p>
      </div>

      {/* Live platform pulse */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Live tables', value: activity?.liveMatches ?? '—', sub: 'Waiting + in progress' },
          { label: 'In queue', value: activity?.matchmakingSearching ?? '—', sub: 'Searching now' },
          { label: 'Players', value: activity?.registeredPlayers ?? '—', sub: 'Registered accounts' },
          { label: '24h games', value: activity?.gamesCompleted24h ?? '—', sub: 'Finished matches' },
        ].map((s) => (
          <div key={s.label} className="card p-4 border border-border">
            <p className="text-[10px] text-secondary uppercase tracking-widest mb-1">{s.label}</p>
            <p className="font-num text-2xl font-bold text-gold">{s.value}</p>
            <p className="text-[11px] text-tertiary mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {activity && activity.recentWins.length > 0 && (
        <div className="card p-4">
          <p className="section-header mb-2">Recent wins</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-secondary">
            {activity.recentWins.slice(0, 10).map((w, i) => (
              <span key={`${w.username}-${w.completedAt ?? i}-${i}`} className="inline-flex items-center gap-2">
                <span className="text-gold font-semibold">{w.username}</span>
                <span>
                  won{' '}
                  <span className="font-mono text-primary">${parseFloat(w.wagerAmount || '0').toFixed(2)}</span>
                </span>
                {w.completedAt && (
                  <span className="text-tertiary">
                    {formatDistanceToNow(new Date(w.completedAt), { addSuffix: true })}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Time control */}
      <div className="card p-6">
        <p className="section-header">Time Control</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          {TIME_CONTROLS.map((tc) => (
            <button
              key={tc.label}
              onClick={() => setSelectedTC(tc)}
              className={clsx(
                'p-4 rounded-xl border text-center transition-all duration-150 group',
                selectedTC.label === tc.label
                  ? 'border-gold/50 bg-gold/8 shadow-gold-sm'
                  : 'border-border bg-elevated hover:border-border-bright hover:bg-overlay'
              )}
            >
              <div className="text-2xl mb-1">{tc.icon}</div>
              <div
                className={clsx(
                  'font-semibold text-sm',
                  selectedTC.label === tc.label ? 'text-gold' : 'text-primary'
                )}
              >
                {tc.label}
              </div>
              <div className="text-xs text-secondary mt-0.5 font-mono">{tc.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Wager */}
      <div className="card p-6">
        <p className="section-header">Stake</p>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mt-3 mb-4">
          {WAGER_OPTIONS.map((w) => (
            <button
              key={w.value}
              onClick={() => setSelectedWager(w)}
              className={clsx(
                'p-3 rounded-xl border text-center transition-all duration-150',
                selectedWager.value === w.value
                  ? 'border-gold/50 bg-gold/8 shadow-gold-sm'
                  : 'border-border bg-elevated hover:border-border-bright'
              )}
            >
              <div
                className={clsx(
                  'font-num font-bold text-base',
                  selectedWager.value === w.value ? 'text-gold' : 'text-primary'
                )}
              >
                {w.label}
              </div>
              <div className="text-[10px] text-secondary mt-0.5">{w.sub}</div>
            </button>
          ))}
        </div>
        {selectedWager.value === 0 && (
          <p className="text-xs text-secondary">
            Rated chess — ELO updates on results. No wallet movement. The same pairing queue as paid tiers, so matchmaking
            stays populated.
          </p>
        )}
      </div>

      {/* Match summary — money transparency */}
      <div className="card-gold p-6">
        <p className="section-header mb-5">Match economics</p>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <p className="text-xs text-secondary mb-1">Time control</p>
            <p className="font-semibold text-primary">
              {selectedTC.label}{' '}
              <span className="text-secondary font-mono text-sm">({selectedTC.sub})</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">Your stake</p>
            <p className="font-num font-bold text-xl text-gold">
              {selectedWager.value === 0 ? '$0.00' : `$${selectedWager.value.toFixed(2)}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">Opponent stake</p>
            <p className="font-num font-bold text-lg text-primary">
              {selectedWager.value === 0 ? '$0.00' : `$${selectedWager.value.toFixed(2)}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">Total pot</p>
            <p className="font-mono font-semibold text-primary">
              {selectedWager.value === 0 ? '$0.00' : `$${pot.toFixed(2)}`}
            </p>
          </div>
          {selectedWager.value > 0 && (
            <>
              <div>
                <p className="text-xs text-secondary mb-1">Platform fee ({feeLabel})</p>
                <p className="font-mono font-semibold text-secondary">${rake.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-secondary mb-1">Winner receives (net)</p>
                <p className="font-mono font-bold text-green text-glow-green">${winnerNet.toFixed(2)}</p>
              </div>
            </>
          )}
        </div>

        {selectedWager.value > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg/60 border border-border mb-5">
            <span className="text-gold text-xs">◈</span>
            <span className="text-xs text-secondary">
              Both stakes lock in escrow when the game starts. Payouts run through the ledger after the result is final.
              {user?.kycStatus !== 'VERIFIED' && ' Complete KYC under Profile before real-money tables.'}
            </span>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-lg text-sm text-red border border-red/20 bg-red/8 mb-4">{error}</div>
        )}

        {!searching ? (
          <button onClick={startSearch} className="btn-gold w-full py-4 text-base font-bold tracking-wide">
            ♟ FIND OPPONENT
          </button>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-gold" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="font-num font-bold text-xl text-primary">
                SEARCHING{' '}
                <span className="text-gold">
                  {String(Math.floor(searchSecs / 60)).padStart(2, '0')}:{String(searchSecs % 60).padStart(2, '0')}
                </span>
              </span>
            </div>
            <p className="text-xs text-secondary text-center max-w-md">
              Pairing with the next player on {selectedTC.label} · {selectedWager.label}. Open a second browser profile or
              ask a friend on the same settings to jump the queue.
            </p>
            <button onClick={cancelSearch} className="btn-outline px-6 py-2 text-sm">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
