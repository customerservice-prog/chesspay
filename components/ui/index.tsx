'use client'

import { type InputHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

// ── Input ─────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <input
        ref={ref}
        className={clsx(
          'input',
          error && 'border-brand-red focus:border-brand-red focus:ring-brand-red',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-brand-red">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'

// ── Card ──────────────────────────────────────────────────────────
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('card', className)}>{children}</div>
}

// ── Badge ─────────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'gold' | 'red' | 'muted' | 'blue'

export function Badge({ children, variant = 'muted' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, string> = {
    green: 'badge-green',
    gold: 'badge-gold',
    red: 'badge-red',
    muted: 'badge-muted',
    blue: 'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-900/40 text-brand-blue border border-blue-800/50',
  }
  return <span className={variants[variant]}>{children}</span>
}

// ── Stat Card ─────────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs text-brand-muted uppercase tracking-wider">{label}</span>
      <span className={clsx('text-2xl font-bold', accent ? 'text-brand-gold' : 'text-brand-text')}>{value}</span>
      {sub && <span className="text-xs text-brand-muted">{sub}</span>}
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────
export function Divider({ className }: { className?: string }) {
  return <div className={clsx('border-t border-brand-border', className)} />
}

// ── Spinner ───────────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }
  return (
    <svg className={clsx('animate-spin text-brand-gold', s[size])} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
