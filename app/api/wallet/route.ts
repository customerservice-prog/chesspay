import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getBalanceSummary, getTransactionHistory, creditAccount } from '@/server/services/wallet.service'
import { ok, handleError } from '@/lib/api-response'

// GET /api/wallet — balance summary
export const GET = requireAuth(async (req, { user }) => {
  try {
    const summary = await getBalanceSummary(user.sub)
    return ok({ balance: summary })
  } catch (err) {
    return handleError(err, 'getWallet')
  }
})

// POST /api/wallet/credit — DEV ONLY: add test funds
// In Phase 2 this is replaced by the Stripe webhook handler
export const POST = requireAuth(async (req, { user }) => {
  if (process.env.NODE_ENV === 'production') {
    return handleError({ code: 'FORBIDDEN', message: 'Not available in production', statusCode: 403 })
  }
  try {
    const body = await req.json()
    const amount = Number(body.amount ?? 100)
    if (isNaN(amount) || amount <= 0 || amount > 10000) {
      return handleError({ code: 'VALIDATION_ERROR', message: 'Invalid amount', statusCode: 400 })
    }
    await creditAccount(user.sub, amount, undefined, `dev_${Date.now()}`)
    const summary = await getBalanceSummary(user.sub)
    return ok({ message: `Credited $${amount}`, balance: summary })
  } catch (err) {
    return handleError(err, 'creditAccount')
  }
})
