'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { clsx } from 'clsx'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const add = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => remove(id), 4000)
  }, [remove])

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  }

  const colors = {
    success: 'border-brand-green text-brand-green',
    error: 'border-brand-red text-brand-red',
    info: 'border-brand-blue text-brand-blue',
    warning: 'border-brand-gold text-brand-gold',
  }

  return (
    <ToastContext.Provider value={{ toast: add }}>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={clsx(
              'flex items-center gap-3 bg-brand-elevated border rounded-lg px-4 py-3 shadow-xl',
              'animate-slide-up pointer-events-auto min-w-64 max-w-sm',
              colors[t.type]
            )}
          >
            <span className="font-bold text-sm">{icons[t.type]}</span>
            <span className="text-brand-text text-sm flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-brand-muted hover:text-brand-text ml-2">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  // Fallback if used outside provider
  if (!ctx) return { toast: (m: string) => console.log(m) }
  return ctx
}
