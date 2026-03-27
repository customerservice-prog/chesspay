import jwt from 'jsonwebtoken'
import { AuthError } from '../errors'

export interface AccessTokenPayload {
  sub: string      // user ID
  username: string
  elo: number
  kycStatus: string
  iat?: number
  exp?: number
}

export interface RefreshTokenPayload {
  sub: string
  jti: string      // unique token ID — used to invalidate specific tokens
  iat?: number
  exp?: number
}

function getSecret(key: 'access' | 'refresh'): string {
  const secret =
    key === 'access'
      ? process.env.JWT_ACCESS_SECRET
      : process.env.JWT_REFRESH_SECRET

  if (!secret) throw new Error(`JWT_${key.toUpperCase()}_SECRET is not set`)
  return secret
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getSecret('access'), {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as string,
    algorithm: 'HS256',
  })
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getSecret('refresh'), {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as string,
    algorithm: 'HS256',
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, getSecret('access')) as AccessTokenPayload
  } catch {
    throw new AuthError('Invalid or expired access token')
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, getSecret('refresh')) as RefreshTokenPayload
  } catch {
    throw new AuthError('Invalid or expired refresh token')
  }
}

export function decodeTokenUnsafe(token: string): AccessTokenPayload | null {
  try {
    return jwt.decode(token) as AccessTokenPayload
  } catch {
    return null
  }
}
