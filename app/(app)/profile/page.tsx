'use client'
import { useAuth } from '@/context/auth.context'
import { clsx } from 'clsx'

export default function ProfilePage() {
  const { user, logout } = useAuth()

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="font-display text-4xl text-primary tracking-wide">PROFILE</h1>

      {/* Profile card */}
      <div className="card-gold p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-8" style={{ background: 'radial-gradient(circle,#D4A843,transparent)', transform: 'translate(40%,-40%)' }} />
        <div className="flex items-center gap-5 relative">
          <div className="h-16 w-16 rounded-full bg-gold/20 border-2 border-gold/50 flex items-center justify-center text-gold text-2xl font-bold"
            style={{ boxShadow: '0 0 20px rgba(212,168,67,0.3)' }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="font-display text-3xl text-primary tracking-wide">{user?.username?.toUpperCase()}</h2>
            <p className="text-secondary text-sm">{user?.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="font-mono text-gold font-semibold">{user?.eloRating} ELO</span>
              <span className="text-tertiary">·</span>
              <span className={clsx('badge', user?.kycStatus === 'VERIFIED' ? 'badge-green' : 'badge-gold')}>
                {user?.kycStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KYC Notice */}
      {user?.kycStatus !== 'VERIFIED' && (
        <div className="card p-5 border-gold/30 bg-gold/5">
          <div className="flex items-start gap-3">
            <span className="text-gold text-xl mt-0.5">⚠</span>
            <div>
              <p className="font-semibold text-gold mb-1">Identity Verification Required</p>
              <p className="text-secondary text-sm mb-3">You must verify your identity before wagering real money. This ensures compliance with US financial regulations and protects all players.</p>
              <button className="btn-gold px-5 py-2 text-sm font-bold" onClick={() => alert('Stripe Identity KYC — activates in Phase 2')}>
                Verify Identity →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account info */}
      <div className="card p-6">
        <p className="section-header">Account Details</p>
        <div className="flex flex-col divide-y divide-border">
          {[
            { label: 'Username', value: user?.username },
            { label: 'Email', value: user?.email },
            { label: 'ELO Rating', value: user?.eloRating?.toString() },
            { label: 'KYC Status', value: user?.kycStatus },
            { label: 'Member Since', value: 'Phase 1 Build' },
          ].map(row => (
            <div key={row.label} className="flex justify-between py-3">
              <span className="text-secondary text-sm">{row.label}</span>
              <span className="text-primary text-sm font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="card p-5 border-red/20">
        <p className="section-header text-red/80 mb-3">Account Actions</p>
        <button onClick={() => logout()} className="btn-danger px-5 py-2.5 text-sm">
          Sign Out
        </button>
      </div>
    </div>
  )
}
