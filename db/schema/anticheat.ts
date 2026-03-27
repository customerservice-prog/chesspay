import {
  pgTable,
  uuid,
  numeric,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { games } from './games'
import { queueStatusEnum, reviewOutcomeEnum } from './enums'

// ── matchmaking_queue ─────────────────────────────────────────────
export const matchmakingQueue = pgTable(
  'matchmaking_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .unique() // One active queue entry per user at a time
      .references(() => users.id),

    // ELO snapshot at queue entry — prevents gaming the system
    eloAtQueue: integer('elo_at_queue').notNull(),

    // Expands +50 every 30s without a match (updated by matchmaking worker)
    eloRange: integer('elo_range').notNull().default(100),

    wagerAmount: numeric('wager_amount', { precision: 12, scale: 2 }).notNull(),

    // Time control must match exactly to pair
    // Shape: { baseSecs: number, incrementSecs: number }
    timeControl: jsonb('time_control').notNull(),

    status: queueStatusEnum('status').notNull().default('WAITING'),

    // Set when this entry is matched; references the created game
    matchedGameId: uuid('matched_game_id').references(() => games.id),

    queuedAt: timestamp('queued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdIdx: uniqueIndex('queue_user_id_idx').on(t.userId),
    statusIdx: index('queue_status_idx').on(t.status),
    wagerEloIdx: index('queue_wager_elo_idx').on(t.wagerAmount, t.eloAtQueue),
  })
)

// ── anticheat_reports ─────────────────────────────────────────────
export const anticheatReports = pgTable(
  'anticheat_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    gameId: uuid('game_id')
      .notNull()
      .unique() // One report per game
      .references(() => games.id),

    analyzedUserId: uuid('analyzed_user_id')
      .notNull()
      .references(() => users.id),

    // Stockfish analysis results (null until analysis completes)
    centipawnLossAvg: numeric('centipawn_loss_avg', { precision: 6, scale: 2 }),
    topEngineMoveMatchPct: numeric('top_engine_move_match_pct', { precision: 5, scale: 2 }),
    stockfishDepth: integer('stockfish_depth'),

    // Behavioral signals (reported by client, weighted not trusted absolutely)
    tabSwitchCount: integer('tab_switch_count').notNull().default(0),
    moveTimingStddevMs: numeric('move_timing_stddev_ms', { precision: 8, scale: 2 }),

    // Outcome
    flagTriggered: boolean('flag_triggered').notNull().default(false),
    // Values: 'HIGH_ENGINE_MATCH' | 'LOW_CPL' | 'EXCESSIVE_TAB_SWITCH' | 'TIMING_ANOMALY'
    flagReasons: text('flag_reasons')
      .array()
      .notNull()
      .default([]),

    // Manual review
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewOutcome: reviewOutcomeEnum('review_outcome'),
    reviewNotes: text('review_notes'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

    // Analysis pipeline status
    analysisStatus: text('analysis_status').notNull().default('QUEUED'),
    // QUEUED | RUNNING | COMPLETED | FAILED

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    gameIdIdx: uniqueIndex('anticheat_game_id_idx').on(t.gameId),
    userIdIdx: index('anticheat_user_id_idx').on(t.analyzedUserId),
    flagIdx: index('anticheat_flag_idx').on(t.flagTriggered),
    reviewOutcomeIdx: index('anticheat_review_outcome_idx').on(t.reviewOutcome),
  })
)

export type MatchmakingQueue = typeof matchmakingQueue.$inferSelect
export type NewMatchmakingQueue = typeof matchmakingQueue.$inferInsert
export type AnticheatReport = typeof anticheatReports.$inferSelect
export type NewAnticheatReport = typeof anticheatReports.$inferInsert
