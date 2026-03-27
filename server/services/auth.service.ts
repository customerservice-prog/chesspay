import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../../db/client'
import { users } from '../../db/schema'
import { hashPassword, verifyPassword } from '../../lib/auth/password'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/auth/jwt'
import { AuthError, ConflictError } from '../../lib/errors'
import { logger } from '../../lib/logger'
import type { RegisterInput, LoginInput } from '../../lib/validation'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthUser {
  id: string
  email: string
  username: string
  eloRating: number
  kycStatus: string
}

export async function registerUser(
  input: RegisterInput,
  ipAddress?: string
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  // Check for existing email or username
  const existing = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1)

  if (existing.length > 0) {
    throw new ConflictError('An account with this email already exists')
  }

  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1)

  if (existingUsername.length > 0) {
    throw new ConflictError('This username is already taken')
  }

  const passwordHash = await hashPassword(input.password)
  const refreshJti = nanoid()
  const refreshToken = signRefreshToken({ sub: 'placeholder', jti: refreshJti })

  const [user] = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      username: input.username,
      passwordHash,
      refreshTokenHash: await hashPassword(refreshToken),
      lastLoginIp: ipAddress,
      lastLoginAt: new Date(),
    })
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      eloRating: users.eloRating,
      kycStatus: users.kycStatus,
    })

  // Re-sign with real user ID
  const finalRefreshToken = signRefreshToken({ sub: user.id, jti: refreshJti })
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    elo: user.eloRating,
    kycStatus: user.kycStatus,
  })

  // Store hashed refresh token
  await db
    .update(users)
    .set({ refreshTokenHash: await hashPassword(finalRefreshToken) })
    .where(eq(users.id, user.id))

  logger.info({ userId: user.id, username: user.username }, 'User registered')

  return {
    user: { id: user.id, email: user.email, username: user.username, eloRating: user.eloRating, kycStatus: user.kycStatus },
    tokens: { accessToken, refreshToken: finalRefreshToken },
  }
}

export async function loginUser(
  input: LoginInput,
  ipAddress?: string
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1)

  if (!user) {
    // Constant-time comparison to prevent user enumeration
    await verifyPassword('dummy', '$2a$12$dummyhashfortimingattackprevention000000000000000000000')
    throw new AuthError('Invalid email or password')
  }

  if (user.isBanned) {
    throw new AuthError('This account has been suspended')
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash)
  if (!passwordValid) {
    logger.warn({ userId: user.id, ip: ipAddress }, 'Failed login attempt')
    throw new AuthError('Invalid email or password')
  }

  const refreshJti = nanoid()
  const refreshToken = signRefreshToken({ sub: user.id, jti: refreshJti })
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    elo: user.eloRating,
    kycStatus: user.kycStatus,
  })

  await db
    .update(users)
    .set({
      refreshTokenHash: await hashPassword(refreshToken),
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  logger.info({ userId: user.id }, 'User logged in')

  return {
    user: { id: user.id, email: user.email, username: user.username, eloRating: user.eloRating, kycStatus: user.kycStatus },
    tokens: { accessToken, refreshToken },
  }
}

export async function refreshTokens(rawRefreshToken: string): Promise<AuthTokens> {
  const payload = verifyRefreshToken(rawRefreshToken)

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1)

  if (!user || !user.refreshTokenHash) {
    throw new AuthError('Invalid refresh token')
  }

  // Verify the stored hash matches — prevents token reuse after logout
  const tokenValid = await verifyPassword(rawRefreshToken, user.refreshTokenHash)
  if (!tokenValid) {
    logger.warn({ userId: user.id }, 'Refresh token mismatch — possible token theft')
    throw new AuthError('Invalid refresh token')
  }

  if (user.isBanned) throw new AuthError('Account suspended')

  const newRefreshJti = nanoid()
  const newRefreshToken = signRefreshToken({ sub: user.id, jti: newRefreshJti })
  const newAccessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    elo: user.eloRating,
    kycStatus: user.kycStatus,
  })

  await db
    .update(users)
    .set({ refreshTokenHash: await hashPassword(newRefreshToken), updatedAt: new Date() })
    .where(eq(users.id, user.id))

  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
}

export async function logoutUser(userId: string): Promise<void> {
  // Invalidate refresh token by clearing the hash
  await db
    .update(users)
    .set({ refreshTokenHash: null, updatedAt: new Date() })
    .where(eq(users.id, userId))

  logger.info({ userId }, 'User logged out')
}
