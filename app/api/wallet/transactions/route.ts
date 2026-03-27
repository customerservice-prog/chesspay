import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getTransactionHistory } from '@/server/services/wallet.service'
import { ok, handleError } from '@/lib/api-response'

export const GET = requireAuth(async (req, { user }) => {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const transactions = await getTransactionHistory(user.sub, limit, offset)
    return ok({ transactions })
  } catch (err) {
    return handleError(err, 'getTransactions')
  }
})
