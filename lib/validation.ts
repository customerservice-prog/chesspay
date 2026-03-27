import { z } from 'zod'

// ── Auth ──────────────────────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

// ── Games ─────────────────────────────────────────────────────────
export const timeControlSchema = z.object({
  baseSecs: z.number().int().min(30).max(3600),
  incrementSecs: z.number().int().min(0).max(60),
})

export const createGameSchema = z.object({
  wagerAmount: z
    .number()
    .min(0, 'Wager cannot be negative')
    .max(10000, 'Wager exceeds maximum'),
  timeControl: timeControlSchema,
  opponentId: z.string().uuid().optional(), // Optional: direct challenge vs. matchmaking
})

export const makeMoveSchema = z.object({
  gameId: z.string().uuid(),
  move: z.object({
    from: z.string().length(2),
    to: z.string().length(2),
    promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
  }),
  timeRemainingMs: z.number().int().min(0),
})

// ── Matchmaking ───────────────────────────────────────────────────
export const joinQueueSchema = z.object({
  wagerAmount: z.number().min(0).max(10000),
  timeControl: timeControlSchema,
})

// ── Wallet ────────────────────────────────────────────────────────
export const depositSchema = z.object({
  amountCents: z.number().int().min(100).max(1000000), // $1 min, $10k max
})

export const withdrawSchema = z.object({
  amountCents: z.number().int().min(100),
})

// ── Shared ────────────────────────────────────────────────────────
export const uuidParamSchema = z.object({
  id: z.string().uuid(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateGameInput = z.infer<typeof createGameSchema>
export type MakeMoveInput = z.infer<typeof makeMoveSchema>
export type JoinQueueInput = z.infer<typeof joinQueueSchema>
export type TimeControl = z.infer<typeof timeControlSchema>
