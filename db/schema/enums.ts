import { pgEnum } from 'drizzle-orm/pg-core'

// ── KYC Status ───────────────────────────────────────────────────
export const kycStatusEnum = pgEnum('kyc_status', [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
])

// ── Account Flags (stored as text array on users table) ──────────
// Not an enum — open-ended for operational flexibility

// ── Game Status ──────────────────────────────────────────────────
export const gameStatusEnum = pgEnum('game_status', [
  'WAITING',       // Created, waiting for both players to connect
  'IN_PROGRESS',   // Active game
  'COMPLETED',     // Normal completion
  'CRASHED',       // Server crash recovery — may be resumable
  'DISPUTED',      // Under manual review
  'ABANDONED',     // Both players disconnected, refunded
])

// ── Payout Status ────────────────────────────────────────────────
export const payoutStatusEnum = pgEnum('payout_status', [
  'PENDING',            // Awaiting anti-cheat clearance
  'HELD_ANTICHEAT',     // Flagged, requires manual review
  'RELEASED',           // Funds settled to winner
  'DISPUTED',           // Manual dispute opened
  'REFUNDED',           // Game cancelled, both players refunded
])

// ── Transaction Type ─────────────────────────────────────────────
export const txnTypeEnum = pgEnum('txn_type', [
  'DEPOSIT',            // User deposits funds (Stripe)
  'WITHDRAWAL',         // User withdraws funds
  'ESCROW_LOCK',        // Funds locked at game start (debit)
  'ESCROW_RELEASE',     // Escrow returned on cancel/crash (credit)
  'WAGER_WIN',          // Winner receives net pot
  'WAGER_LOSS',         // Loser's stake consumed (zero-amount record for audit)
  'RAKE',               // Platform fee deducted
  'REFUND',             // Manual or crash refund
  'ADJUSTMENT',         // Admin manual adjustment with required note
  'BONUS',              // Promotional credit
])

// ── Transaction Status ───────────────────────────────────────────
export const txnStatusEnum = pgEnum('txn_status', [
  'PENDING_ESCROW',     // Locked in escrow, not yet settled
  'SETTLED',            // Final, counted in available balance
  'FAILED',             // Payment processing failure
  'REVERSED',           // Reversed by a subsequent transaction
])

// ── Matchmaking Status ───────────────────────────────────────────
export const queueStatusEnum = pgEnum('queue_status', [
  'WAITING',
  'MATCHED',
  'CANCELLED',
])

// ── Anti-Cheat Review Outcome ────────────────────────────────────
export const reviewOutcomeEnum = pgEnum('review_outcome', [
  'CLEARED',
  'CONFIRMED_CHEAT',
  'INCONCLUSIVE',
])

// ── Game Result Reason ───────────────────────────────────────────
export const resultReasonEnum = pgEnum('result_reason', [
  'CHECKMATE',
  'TIMEOUT',
  'RESIGNATION',
  'DRAW_AGREEMENT',
  'DRAW_STALEMATE',
  'DRAW_INSUFFICIENT',
  'DRAW_REPETITION',
  'DRAW_FIFTY_MOVE',
  'FORFEIT_DISCONNECT',
  'FORFEIT_ILLEGAL_MOVES',
  'ADMIN_OVERRIDE',
])
