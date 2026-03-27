import { eq, and, sql, inArray } from 'drizzle-orm'
import { db } from '../../db/client'
import { ledgerTransactions, games } from '../../db/schema'
import { InsufficientFundsError, GameStateError } from '../../lib/errors'
import { logger } from '../../lib/logger'
import type { NewLedgerTransaction } from '../../db/schema'

// ─────────────────────────────────────────────────────────────────
// Balance queries — ALWAYS derived from ledger, never from a column
// ─────────────────────────────────────────────────────────────────

/**
 * Returns a user's available (settled) balance in dollars.
 * This is the canonical balance calculation — used everywhere.
 */
export async function getAvailableBalance(userId: string): Promise<number> {
  const result = await db
    .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(ledgerTransactions)
    .where(
      and(
        eq(ledgerTransactions.userId, userId),
        eq(ledgerTransactions.status, 'SETTLED')
      )
    )

  return parseFloat(result[0]?.total ?? '0')
}

/**
 * Returns the amount currently locked in escrow (pending wagers).
 */
export async function getLockedBalance(userId: string): Promise<number> {
  const result = await db
    .select({ total: sql<string>`COALESCE(SUM(ABS(amount)), 0)` })
    .from(ledgerTransactions)
    .where(
      and(
        eq(ledgerTransactions.userId, userId),
        eq(ledgerTransactions.status, 'PENDING_ESCROW'),
        eq(ledgerTransactions.txnType, 'ESCROW_LOCK')
      )
    )

  return parseFloat(result[0]?.total ?? '0')
}

export async function getBalanceSummary(userId: string) {
  const [available, locked] = await Promise.all([
    getAvailableBalance(userId),
    getLockedBalance(userId),
  ])
  return { available, locked, total: available + locked }
}

// ─────────────────────────────────────────────────────────────────
// Escrow operations — the financial heart of the wager system
// ─────────────────────────────────────────────────────────────────

/**
 * Atomically locks wager amounts from both players into escrow.
 * This is the ONLY place ESCROW_LOCK rows are created.
 *
 * Uses a serializable transaction with balance checks.
 * If either player lacks funds, the entire operation rolls back.
 */
export async function lockWagerEscrow(
  gameId: string,
  whiteUserId: string,
  blackUserId: string,
  wagerAmount: number
): Promise<void> {
  if (wagerAmount <= 0) return // Points-only game, no escrow needed

  const wagerStr = wagerAmount.toFixed(2)

  await db.transaction(async (tx) => {
    // Check both balances within the transaction
    const [whiteBalance, blackBalance] = await Promise.all([
      tx
        .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(ledgerTransactions)
        .where(and(eq(ledgerTransactions.userId, whiteUserId), eq(ledgerTransactions.status, 'SETTLED'))),
      tx
        .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(ledgerTransactions)
        .where(and(eq(ledgerTransactions.userId, blackUserId), eq(ledgerTransactions.status, 'SETTLED'))),
    ])

    const whiteBal = parseFloat(whiteBalance[0]?.total ?? '0')
    const blackBal = parseFloat(blackBalance[0]?.total ?? '0')

    if (whiteBal < wagerAmount) {
      throw new InsufficientFundsError()
    }
    if (blackBal < wagerAmount) {
      throw new InsufficientFundsError()
    }

    // Insert ESCROW_LOCK rows — negative amounts (debit)
    await tx.insert(ledgerTransactions).values([
      {
        userId: whiteUserId,
        gameId,
        txnType: 'ESCROW_LOCK',
        amount: `-${wagerStr}`,
        status: 'PENDING_ESCROW',
        idempotencyKey: `ESCROW_LOCK:${gameId}:${whiteUserId}`,
        metadata: { wagerAmount, role: 'white' },
      },
      {
        userId: blackUserId,
        gameId,
        txnType: 'ESCROW_LOCK',
        amount: `-${wagerStr}`,
        status: 'PENDING_ESCROW',
        idempotencyKey: `ESCROW_LOCK:${gameId}:${blackUserId}`,
        metadata: { wagerAmount, role: 'black' },
      },
    ])

    logger.info({ gameId, whiteUserId, blackUserId, wagerAmount }, 'Escrow locked')
  })
}

/**
 * Settles a completed game:
 * 1. Deducts rake from pot
 * 2. Credits winner with net pot
 * 3. Records audit rows for loser and rake
 * 4. Releases escrow by settling the PENDING_ESCROW rows
 *
 * Idempotent — safe to call multiple times (duplicate inserts rejected by unique constraint).
 */
export async function settleGamePayout(gameId: string, winnerId: string, loserId: string): Promise<void> {
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) throw new GameStateError('Game not found for settlement')

  const potTotal = parseFloat(game.potTotal as string)
  const rakePercent = parseFloat(game.rakePercent as string)
  const rakeAmount = parseFloat((potTotal * (rakePercent / 100)).toFixed(2))
  const winnerNet = parseFloat((potTotal - rakeAmount).toFixed(2))
  const platformAccountId = process.env.PLATFORM_ACCOUNT_ID!

  const now = new Date()

  await db.transaction(async (tx) => {
    // Winner receives net pot
    await tx
      .insert(ledgerTransactions)
      .values({
        userId: winnerId,
        gameId,
        txnType: 'WAGER_WIN',
        amount: winnerNet.toFixed(2),
        status: 'SETTLED',
        settledAt: now,
        idempotencyKey: `WAGER_WIN:${gameId}:${winnerId}`,
        metadata: { potTotal, rakePercent, rakeAmount, winnerNet },
      })
      .onConflictDoNothing() // Idempotent

    // Rake credited to platform account
    await tx
      .insert(ledgerTransactions)
      .values({
        userId: platformAccountId,
        gameId,
        txnType: 'RAKE',
        amount: rakeAmount.toFixed(2),
        status: 'SETTLED',
        settledAt: now,
        idempotencyKey: `RAKE:${gameId}`,
        metadata: { rakePercent, rakeAmount },
      })
      .onConflictDoNothing()

    // Audit row for loser (zero amount — escrow already captured the loss)
    await tx
      .insert(ledgerTransactions)
      .values({
        userId: loserId,
        gameId,
        txnType: 'WAGER_LOSS',
        amount: '0',
        status: 'SETTLED',
        settledAt: now,
        idempotencyKey: `WAGER_LOSS:${gameId}:${loserId}`,
        metadata: { potTotal, rakePercent },
      })
      .onConflictDoNothing()

    // Settle the ESCROW_LOCK rows for both players
    await tx
      .update(ledgerTransactions)
      .set({ status: 'SETTLED', settledAt: now })
      .where(
        and(
          eq(ledgerTransactions.gameId, gameId),
          eq(ledgerTransactions.txnType, 'ESCROW_LOCK'),
          eq(ledgerTransactions.status, 'PENDING_ESCROW')
        )
      )

    logger.info({ gameId, winnerId, loserId, winnerNet, rakeAmount }, 'Game payout settled')
  })
}

/**
 * Refunds both players — used on crash, abandoned game, or admin override.
 * Releases escrow and credits REFUND rows back to each player.
 */
export async function refundGame(gameId: string, reason: string): Promise<void> {
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return

  const wagerAmount = parseFloat(game.wagerAmount as string)
  if (wagerAmount <= 0) return // Nothing to refund for points games

  const now = new Date()

  await db.transaction(async (tx) => {
    for (const userId of [game.whiteUserId, game.blackUserId]) {
      await tx
        .insert(ledgerTransactions)
        .values({
          userId,
          gameId,
          txnType: 'REFUND',
          amount: wagerAmount.toFixed(2),
          status: 'SETTLED',
          settledAt: now,
          idempotencyKey: `REFUND:${gameId}:${userId}`,
          metadata: { reason },
        })
        .onConflictDoNothing()
    }

    // Release escrow
    await tx
      .update(ledgerTransactions)
      .set({ status: 'SETTLED', settledAt: now })
      .where(
        and(
          eq(ledgerTransactions.gameId, gameId),
          eq(ledgerTransactions.txnType, 'ESCROW_LOCK'),
          eq(ledgerTransactions.status, 'PENDING_ESCROW')
        )
      )

    logger.info({ gameId, reason }, 'Game refunded')
  })
}

/**
 * Returns paginated transaction history for a user.
 */
export async function getTransactionHistory(userId: string, limit = 20, offset = 0) {
  return db
    .select()
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.userId, userId))
    .orderBy(sql`created_at DESC`)
    .limit(limit)
    .offset(offset)
}

/**
 * Credit funds to a user's account (e.g., after Stripe deposit confirmation).
 * In Phase 1, this is called directly for test credits.
 */
export async function creditAccount(
  userId: string,
  amountDollars: number,
  stripeRef?: string,
  idempotencyKeySuffix?: string
): Promise<void> {
  const suffix = idempotencyKeySuffix ?? `manual_${Date.now()}`
  await db
    .insert(ledgerTransactions)
    .values({
      userId,
      txnType: 'DEPOSIT',
      amount: amountDollars.toFixed(2),
      status: 'SETTLED',
      settledAt: new Date(),
      stripeRef,
      idempotencyKey: `DEPOSIT:noGame:${userId}:${suffix}`,
      metadata: { source: stripeRef ? 'stripe' : 'manual' },
    })
    .onConflictDoNothing()

  logger.info({ userId, amountDollars, stripeRef }, 'Account credited')
}
