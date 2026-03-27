'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth.context'
import { ApiError } from '@/lib/api/client'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="card-elevated p-8">
      <h2 className="text-lg font-semibold text-primary mb-1">Sign In</h2>
      <p className="text-secondary text-sm mb-6">Access your account and active positions</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg text-sm text-red border border-red/20 bg-red/8">{error}</div>
        )}

        <button type="submit" disabled={loading}
          className="btn-gold w-full py-3.5 text-sm font-bold tracking-wide mt-2">
          {loading ? (
            <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Authenticating...</span>
          ) : 'Enter Arena'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-border">
        <p className="text-center text-sm text-secondary">
          No account?{' '}
          <Link href="/register" className="text-gold hover:text-gold-glow font-semibold transition-colors">Create one →</Link>
        </p>
      </div>

      {process.env.NODE_ENV !== 'production' && (
        <div className="mt-4 p-3 rounded-lg bg-bg border border-border">
          <p className="text-xs text-tertiary mb-1 font-semibold uppercase tracking-wider">Dev Accounts</p>
          <p className="text-xs font-mono text-secondary">alice@test.com / TestPass123!</p>
          <p className="text-xs font-mono text-secondary">bob@test.com / TestPass123!</p>
        </div>
      )}
    </div>
  )
}
