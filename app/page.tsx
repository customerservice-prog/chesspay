import { redirect } from 'next/navigation'

// Root redirects to dashboard; layout middleware handles auth gating
export default function RootPage() {
  redirect('/dashboard')
}
