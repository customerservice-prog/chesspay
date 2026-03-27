import {
  pgTable,
  uuid,
  numeric,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { games } from './games'
import { txnTypeEnum, txnStatusEnum } from './enums'

// ── ledger_transactions ───────────────────────────────────────────
//
// This table is THE source of truth for all money movement.
//
// CRITICAL INVARIANTS (enforced by application + constraints):
//   1. INSERT ONLY — no UPDATE or DELETE ever issued against this table.
//   2. Status transitions are recorded as NEW rows referencing the original txn_id.
//   3. A player's available balance = SUM(amount) WHERE status = 'SETTLED'.
//   4. Locked (escrow) amount = SUM(amount) WHERE status = 'PENDING_ESCROW'.
//   5. idempotency_key is UNIQUE — prevents duplicate writes on retry.
//
// These invariants make the ledger tamper-evident and fully auditable.
// A complete financial history can be reconstructed from this table alone.
//
export const ledgerTransactions = pgTable(
  'ledger_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    // Null for deposits/withdrawals not tied to a game
    gameId: uuid('game_id').references(() => games.id),

    // Null for the first record; populated on status-transition records
    // Links a SETTLED/REVERSED record back to its originating PENDING_ESCROW record
    originalTxnId: uuid('original_txn_id'),

    txnType: txnTypeEnum('txn_type').notNull(),

    // Positive = credit to user, Negative = debit from user
    // ESCROW_LOCK: negative (locks funds)
    // ESCROW_RELEASE / WAGER_WIN / REFUND: positive (returns/grants funds)
    // RAKE: negative (deducted from platform account row, not user)
    // WAGER_LOSS: 0 (escrow already captured the loss; this row is for audit trail)
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),

    status: txnStatusEnum('status').notNull(),

    // Stripe PaymentIntent or Transfer ID for externally-processed transactions
    stripeRef: text('stripe_ref'),

    // UNIQUE — prevents double-processing on server restart or retry storms.
    // Format: {TXN_TYPE}:{game_id|"noGame"}:{user_id}:{suffix}
    // Example: "ESCROW_LOCK:abc-game-uuid:xyz-user-uuid"
    // Example: "DEPOSIT:noGame:xyz-user-uuid:pi_stripe123"
    idempotencyKey: text('idempotency_key').notNull().unique(),

    // Flexible structured metadata — Stockfish score, rake %, admin notes, etc.
    metadata: jsonb('metadata').notNull().default('{}'),

    // Timestamps — createdAt is immutable (set once on INSERT)
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Set when this record transitions to SETTLED (written on the new SETTLED row)
    settledAt: timestamp('settled_at', { withTimezone: true }),
  },
  (t) => ({
    userIdIdx: index('ledger_user_id_idx').on(t.userId),
    gameIdIdx: index('ledger_game_id_idx').on(t.gameId),
    statusIdx: index('ledger_status_idx').on(t.status),
    txnTypeIdx: index('ledger_txn_type_idx').on(t.txnType),
    idempotencyIdx: uniqueIndex('ledger_idempotency_key_idx').on(t.idempotencyKey),
    createdAtIdx: index('ledger_created_at_idx').on(t.createdAt),
    // Compound index for the most common balance query
    userStatusIdx: index('ledger_user_status_idx').on(t.userId, t.status),
  })
)

export type LedgerTransaction = typeof ledgerTransactions.$inferSelect
export type NewLedgerTransaction = typeof ledgerTransactions.$inferInsert
