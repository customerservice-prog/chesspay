'use client'
import { useEffect, useState } from 'react'
import { walletApi } from '@/lib/api/client'
import { format } from 'date-fns'
import { clsx } from 'clsx'

interface Balance { available: number; locked: number; total: number }
interface Txn { id:string; txnType:string; amount:string; status:string; createdAt:string; metadata:Record<string,unknown> }

const RAKE_PERCENT = parseFloat(process.env.NEXT_PUBLIC_RAKE_PERCENT ?? '7.5')

const TXN_LABELS: Record<string,{ label:string; icon:string }> = {
  DEPOSIT:        { label:'Deposit',          icon:'↓' },
  WITHDRAWAL:     { label:'Withdrawal',       icon:'↑' },
  ESCROW_LOCK:    { label:'Wager Locked',     icon:'🔒' },
  ESCROW_RELEASE: { label:'Escrow Released',  icon:'🔓' },
  WAGER_WIN:      { label:'Match Won',        icon:'🏆' },
  WAGER_LOSS:     { label:'Match Lost',       icon:'—' },
  RAKE:           { label:'Platform Fee',     icon:'◈' },
  REFUND:         { label:'Refund',           icon:'↩' },
  ADJUSTMENT:     { label:'Adjustment',       icon:'⚙' },
  BONUS:          { label:'Bonus',            icon:'★' },
}

export default function WalletPage() {
  const [balance, setBalance] = useState<Balance|null>(null)
  const [txns, setTxns] = useState<Txn[]>([])
  const [loading, setLoading] = useState(true)
  const [crediting, setCrediting] = useState(false)

  async function load() {
    const [b, t] = await Promise.allSettled([walletApi.getBalance(), walletApi.getTransactions()])
    if (b.status === 'fulfilled') setBalance(b.value.data.balance)
    if (t.status === 'fulfilled') setTxns(t.value.data.transactions as Txn[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addFunds() {
    setCrediting(true)
    try { await walletApi.addTestFunds(100); await load() }
    finally { setCrediting(false) }
  }

  function amountColor(txn: Txn) {
    const n = parseFloat(txn.amount)
    if (n > 0) return 'text-green'
    if (n < 0) return 'text-red'
    return 'text-secondary'
  }

  function amountDisplay(txn: Txn) {
    const n = parseFloat(txn.amount)
    if (n === 0) return <span className="text-secondary font-mono">—</span>
    if (n > 0) return <span className="text-green font-mono font-semibold">+${n.toFixed(2)}</span>
    return <span className="text-red font-mono font-semibold">-${Math.abs(n).toFixed(2)}</span>
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl text-primary tracking-wide">WALLET</h1>
          <p className="text-secondary text-sm mt-1">All balances are ledger-derived in real time</p>
        </div>
        {process.env.NODE_ENV !== 'production' && (
          <button onClick={addFunds} disabled={crediting}
            className="btn-outline px-4 py-2 text-sm">
            {crediting ? '...' : '+ $100 Test'}
          </button>
        )}
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card-gold p-6 lg:col-span-1">
          <p className="stat-label mb-2">Available Balance</p>
          <p className="font-num font-bold text-4xl text-gold text-glow-gold">
            ${loading ? '—' : balance?.available.toFixed(2) ?? '0.00'}
          </p>
          <p className="text-xs text-secondary mt-2">Ready to wager or withdraw</p>
        </div>
        <div className="card p-6">
          <p className="stat-label mb-2">In Escrow</p>
          <p className="font-num font-bold text-3xl text-primary">
            ${loading ? '—' : balance?.locked.toFixed(2) ?? '0.00'}
          </p>
          <p className="text-xs text-secondary mt-2">Locked in active wagers</p>
        </div>
        <div className="card p-6">
          <p className="stat-label mb-2">Total Balance</p>
          <p className="font-num font-bold text-3xl text-primary">
            ${loading ? '—' : balance?.total.toFixed(2) ?? '0.00'}
          </p>
          <p className="text-xs text-secondary mt-2">Available + Escrow</p>
        </div>
      </div>

      <div className="card p-6 border border-border">
        <p className="section-header mb-3">Before you stake</p>
        <p className="text-xs text-secondary mb-4">
          Every paid match mirrors the lobby breakdown: two equal stakes, one pot, platform fee, net to the winner. Funds
          move only through ledger rows you can audit below.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          {[
            { label: 'Example stake (each player)', value: '$10.00' },
            { label: 'Pot', value: '$20.00' },
            { label: `Platform fee (${RAKE_PERCENT}%)`, value: `$${(20 * (RAKE_PERCENT / 100)).toFixed(2)}` },
            { label: 'Winner receives (net)', value: `$${(20 * (1 - RAKE_PERCENT / 100)).toFixed(2)}` },
          ].map((row) => (
            <div key={row.label} className="flex justify-between gap-4 py-2 border-b border-border/60">
              <span className="text-secondary">{row.label}</span>
              <span className="font-mono text-primary font-semibold">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ledger notice */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-elevated border border-border">
        <span className="text-gold text-sm">◈</span>
        <p className="text-xs text-secondary">
          Balances are always computed live from the ledger — no balance column is ever cached or mutated directly.
          Every transaction is immutable and traceable.
        </p>
      </div>

      {/* Transaction history */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-primary">Transaction Ledger</h2>
          <span className="badge-gray">{txns.length} entries</span>
        </div>

        {txns.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3 opacity-20">◈</div>
            <p className="text-secondary text-sm">No transactions yet</p>
            {process.env.NODE_ENV !== 'production' && (
              <p className="text-xs text-tertiary mt-1">
                Click <span className="font-mono">+ $100 Test</span> to add dev funds
              </p>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t, i) => {
                const meta = TXN_LABELS[t.txnType] ?? { label: t.txnType, icon: '?' }
                return (
                  <tr key={t.id} className={clsx('border-t border-border hover:bg-elevated/40 transition-colors', i % 2 === 0 ? '' : 'bg-bg/30')}>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{meta.icon}</span>
                        <span className="font-medium text-sm text-primary">{meta.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={clsx('badge',
                        t.status === 'SETTLED' ? 'badge-green' :
                        t.status === 'PENDING_ESCROW' ? 'badge-gold' :
                        t.status === 'FAILED' ? 'badge-red' : 'badge-gray'
                      )}>
                        {t.status === 'PENDING_ESCROW' ? 'ESCROW' : t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono">{amountDisplay(t)}</td>
                    <td className="px-6 py-3.5 text-right text-xs text-secondary font-mono">
                      {format(new Date(t.createdAt), 'MMM d · HH:mm')}
                    </td>
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
