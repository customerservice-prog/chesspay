import { NextRequest } from 'next/server'
import { loginSchema } from '@/lib/validation'
import { loginUser } from '@/server/services/auth.service'
import { ok, handleError } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = loginSchema.parse(body)

    const ip = req.headers.get('x-forwarded-for') ?? undefined
    const { user, tokens } = await loginUser(input, ip)

    const response = ok({ user, accessToken: tokens.accessToken })

    response.cookies.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/api/auth/refresh',
    })

    return response
  } catch (err) {
    return handleError(err, 'login')
  }
}
