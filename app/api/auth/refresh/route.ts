import { NextRequest, NextResponse } from 'next/server'
import { refreshTokens, logoutUser } from '@/server/services/auth.service'
import { ok, handleError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/middleware'

// POST /api/auth/refresh — uses httpOnly cookie
export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('refresh_token')?.value
    if (!refreshToken) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'No refresh token' }, { status: 401 })
    }

    const tokens = await refreshTokens(refreshToken)
    const response = ok({ accessToken: tokens.accessToken })

    response.cookies.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/api/auth/refresh',
    })

    return response
  } catch (err) {
    return handleError(err, 'refresh')
  }
}

// DELETE /api/auth/refresh — logout
export const DELETE = requireAuth(async (req, { user }) => {
  try {
    await logoutUser(user.sub)
    const response = ok({ message: 'Logged out' })
    response.cookies.delete('refresh_token')
    return response
  } catch (err) {
    return handleError(err, 'logout')
  }
})
