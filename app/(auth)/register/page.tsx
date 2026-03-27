'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth.context'
import { ApiError } from '@/lib/api/client'

export default function RegisterPage() {
  const { register } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ email:'', username:'', password:'', confirm:'' })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [f]: e.target.value }))

  function validate() {
    const e: Record<string,string> = {}
    if (!form.email) e.email = 'Required'
    if (form.username.length < 3) e.username = 'Min 3 characters'
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) e.username = 'Letters, numbers, underscores only'
    if (form.password.length < 8) e.password = 'Min 8 characters'
    if (!/[A-Z]/.test(form.password)) e.password = 'Needs uppercase letter'
    if (!/[0-9]/.test(form.password)) e.password = 'Needs a number'
    if (!/[^a-zA-Z0-9]/.test(form.password)) e.password = 'Needs special character'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    return e
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      await register(form.email, form.username, form.password)
      router.replace('/dashboard')
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Registration failed' })
    } finally { setLoading(false) }
  }

  const Field = ({ label, field, type='text', placeholder }: { label:string; field:string; type?:string; placeholder:string }) => (
    <div>
      <label className="label">{label}</label>
      <input className={`input ${errors[field] ? 'border-red/50 focus:border-red' : ''}`} type={type} placeholder={placeholder}
        value={form[field as keyof typeof form]} onChange={set(field)} required />
      {errors[field] && <p className="mt-1 text-xs text-red">{errors[field]}</p>}
    </div>
  )

  return (
    <div className="card-elevated p-8">
      <h2 className="text-lg font-semibold text-primary mb-1">Create Account</h2>
      <p className="text-secondary text-sm mb-6">Join the arena. Play for real stakes.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Email" field="email" type="email" placeholder="you@example.com" />
        <Field label="Username" field="username" placeholder="chesswizard99" />
        <Field label="Password" field="password" type="password" placeholder="Min 8 chars, uppercase, number, symbol" />
        <Field label="Confirm Password" field="confirm" type="password" placeholder="••••••••" />

        {errors.form && <div className="px-4 py-3 rounded-lg text-sm text-red border border-red/20 bg-red/8">{errors.form}</div>}

        <button type="submit" disabled={loading} className="btn-gold w-full py-3.5 text-sm font-bold tracking-wide mt-2">
          {loading ? 'Creating Account...' : 'Create Account →'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-border">
        <p className="text-center text-sm text-secondary">
          Already have an account?{' '}
          <Link href="/login" className="text-gold hover:text-gold-glow font-semibold transition-colors">Sign in →</Link>
        </p>
      </div>
    </div>
  )
}
