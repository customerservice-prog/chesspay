import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  char,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { kycStatusEnum } from './enums'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),

    // Stored as bcrypt hash — never plaintext
    passwordHash: text('password_hash').notNull(),

    eloRating: integer('elo_rating').notNull().default(1200),

    // KYC — required before first wager
    kycStatus: kycStatusEnum('kyc_status').notNull().default('UNVERIFIED'),
    kycProviderRef: text('kyc_provider_ref'), // Stripe Identity session ID

    // Age verification — 18+ enforced by DB check constraint
    dateOfBirth: date('date_of_birth'),

    // Geo
    countryCode: char('country_code', { length: 2 }),
    ipCountryLast: char('ip_country_last', { length: 2 }),

    // Behavioral flags — open text array for operational flexibility
    // Values: 'CHEAT_SUSPECT' | 'ILLEGAL_MOVE_ATTEMPT' | 'EXCESSIVE_DISCONNECT' | etc.
    accountFlags: text('account_flags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    // Stripe
    stripeCustomerId: text('stripe_customer_id').unique(),

    // Auth
    refreshTokenHash: text('refresh_token_hash'), // Latest valid refresh token (hashed)
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: text('last_login_ip'),

    isBanned: boolean('is_banned').notNull().default(false),
    banReason: text('ban_reason'),

    // Timestamps — always UTC
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    usernameIdx: uniqueIndex('users_username_idx').on(t.username),
    eloIdx: index('users_elo_idx').on(t.eloRating),
    // Enforce 18+ at DB level — belt-and-suspenders alongside app validation
    ageCheck: check(
      'users_age_check',
      sql`date_of_birth IS NULL OR EXTRACT(YEAR FROM AGE(date_of_birth)) >= 18`
    ),
  })
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
