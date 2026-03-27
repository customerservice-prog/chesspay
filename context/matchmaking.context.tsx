'use client'

import type { ReactNode } from 'react'

/**
 * Matchmaking runs over REST + short polling (`matchmakingApi` in `lib/api/client.ts`, wired in `app/(app)/lobby/page.tsx`).
 * This provider is a no-op shim so we can add socket-driven queue UX later without rewiring the tree.
 */
export function MatchmakingProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
