import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, type AccessTokenPayload } from './jwt'
import { AuthError, ForbiddenError } from '../errors'

export interface AuthContext {
  user: AccessTokenPayload
}

type ApiHandler<T = unknown> = (
  req: NextRequest,
  ctx: AuthContext,
  params?: T
) => Promise<NextResponse>

// Extracts and verifies the Bearer token from Authorization header.
// Usage: wrap your API route handler with requireAuth().
export function requireAuth<T = unknown>(handler: ApiHandler<T>) {
  return async (req: NextRequest, params?: T): Promise<NextResponse> => {
    try {
      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        throw new AuthError('Missing authorization header')
      }

      const token = authHeader.slice(7)
      const user = verifyAccessToken(token)

      return await handler(req, { user }, params)
    } catch (err) {
      if (err instanceof AuthError || err instanceof ForbiddenError) {
        return NextResponse.json(
          { error: err.code, message: err.message },
          { status: err.statusCode }
        )
      }
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        { status: 500 }
      )
    }
  }
}

// Requires KYC to be VERIFIED — used on wager endpoints
export function requireKyc<T = unknown>(handler: ApiHandler<T>) {
  return requireAuth<T>(async (req, ctx, params) => {
    if (ctx.user.kycStatus !== 'VERIFIED') {
      return NextResponse.json(
        {
          error: 'KYC_REQUIRED',
          message: 'Identity verification required to access this feature',
        },
        { status: 403 }
      )
    }
    return handler(req, ctx, params)
  })
}

// Server-side: parse token from cookie (for SSR pages)
export function getTokenFromCookies(req: NextRequest): AccessTokenPayload | null {
  const token = req.cookies.get('access_token')?.value
  if (!token) return null
  try {
    return verifyAccessToken(token)
  } catch {
    return null
  }
}
