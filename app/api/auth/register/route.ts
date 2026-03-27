import { NextRequest, NextResponse } from 'next/server'
import { registerSchema } from '@/lib/validation'
import { registerUser } from '@/server/services/auth.service'
import { ok, created, handleError } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = registerSchema.parse(body)

    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined
    const { user, tokens } = await registerUser(input, ip)

    const response = created({ user, accessToken: tokens.accessToken })

    // httpOnly refresh token cookie — not accessible to JS
    response.cookies.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/api/auth/refresh',
    })

    return response
  } catch (err) {
    return handleError(err, 'register')
  }
}
