import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  jsonb,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import {
  gameStatusEnum,
  payoutStatusEnum,
  resultReasonEnum,
} from './enums'

// ── games ─────────────────────────────────────────────────────────
export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    whiteUserId: uuid('white_user_id')
      .notNull()
      .references(() => users.id),
    blackUserId: uuid('black_user_id')
      .notNull()
      .references(() => users.id),

    // Financial snapshot — locked at game creation, immutable after
    wagerAmount: numeric('wager_amount', { precision: 12, scale: 2 }).notNull(),
    rakePercent: numeric('rake_percent', { precision: 4, scale: 2 })
      .notNull()
      .default('7.50'),
    potTotal: numeric('pot_total', { precision: 12, scale: 2 }).notNull(), // wager * 2

    status: gameStatusEnum('status').notNull().default('WAITING'),

    winnerUserId: uuid('winner_user_id').references(() => users.id),
    resultReason: resultReasonEnum('result_reason'),

    // Game state — updated atomically on every validated move
    // This is the crash-recovery anchor: any in-progress game can be
    // resumed from fenSnapshot + the move_log in game_moves.
    fenSnapshot: text('fen_snapshot')
      .notNull()
      .default('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), // Starting FEN

    // Full PGN written on game completion for Stockfish analysis
    pgn: text('pgn'),

    // Time control — stored as JSONB for flexibility
    // Shape: { baseSecs: number, incrementSecs: number }
    timeControl: jsonb('time_control').notNull().default(sql`'{"baseSecs":600,"incrementSecs":5}'`),

    // Payout
    payoutStatus: payoutStatusEnum('payout_status').notNull().default('PENDING'),
    payoutReleaseAt: timestamp('payout_release_at', { withTimezone: true }),

    // Disconnect tracking — userId -> ISO timestamp of disconnect
    // Used to enforce the 60-second reconnect window
    disconnectedAt: jsonb('disconnected_at').default(sql`'{}'`),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }), // Set when both players connect
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    whiteUserIdx: index('games_white_user_idx').on(t.whiteUserId),
    blackUserIdx: index('games_black_user_idx').on(t.blackUserId),
    statusIdx: index('games_status_idx').on(t.status),
    payoutStatusIdx: index('games_payout_status_idx').on(t.payoutStatus),
    createdAtIdx: index('games_created_at_idx').on(t.createdAt),
  })
)

// ── game_moves ────────────────────────────────────────────────────
// Individual move log — separate table for clean querying and Stockfish analysis
export const gameMoves = pgTable(
  'game_moves',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    // Move number in the game (1-indexed; white and black share the counter)
    moveNumber: integer('move_number').notNull(),

    // The move in UCI format (e.g. "e2e4") — what the client sent
    uciMove: text('uci_move').notNull(),

    // Standard Algebraic Notation (e.g. "e4", "Nf3") — computed server-side
    san: text('san').notNull(),

    // FEN after this move is applied — enables per-move game reconstruction
    fenAfter: text('fen_after').notNull(),

    // Time remaining for this player after move (ms)
    timeRemainingMs: integer('time_remaining_ms').notNull(),

    // Time taken to make this move (ms)
    elapsedMs: integer('elapsed_ms').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    gameIdIdx: index('game_moves_game_id_idx').on(t.gameId),
    gameUserIdx: index('game_moves_game_user_idx').on(t.gameId, t.userId),
    moveNumberIdx: index('game_moves_number_idx').on(t.gameId, t.moveNumber),
  })
)

export type Game = typeof games.$inferSelect
export type NewGame = typeof games.$inferInsert
export type GameMove = typeof gameMoves.$inferSelect
export type NewGameMove = typeof gameMoves.$inferInsert

export type TimeControl = {
  baseSecs: number
  incrementSecs: number
}
