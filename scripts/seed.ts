/**
 * Seed script — creates test accounts for local development.
 * Run: npm run db:seed
 *
 * Test accounts created:
 *   alice@test.com / password: TestPass123!  (ELO: 1400)
 *   bob@test.com   / password: TestPass123!  (ELO: 1350)
 *   admin@test.com / password: AdminPass123! (ELO: 1200)
 *
 * NEVER run this against production.
 */

import { db } from '../db/client'
import { users } from '../db/schema'
import { hashPassword } from '../lib/auth/password'
import { logger } from '../lib/logger'

const PLATFORM_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'

const seedUsers = [
  {
    id: PLATFORM_ACCOUNT_ID,
    email: 'platform@checkmate.gg',
    username: '_platform',
    password: 'NOT_A_REAL_PASSWORD_DO_NOT_LOGIN',
    eloRating: 0,
    isBanned: false,
    note: 'Platform account — receives rake. Never login-accessible.',
  },
  {
    email: 'alice@test.com',
    username: 'alice_plays',
    password: 'TestPass123!',
    eloRating: 1400,
    note: 'Primary test user',
  },
  {
    email: 'bob@test.com',
    username: 'bob_plays',
    password: 'TestPass123!',
    eloRating: 1350,
    note: 'Opponent test user',
  },
  {
    email: 'admin@test.com',
    username: 'admin_user',
    password: 'AdminPass123!',
    eloRating: 1200,
    note: 'Admin test user',
  },
]

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    logger.error('Seed script must NOT be run in production')
    process.exit(1)
  }

  logger.info('Seeding database...')

  for (const u of seedUsers) {
    const passwordHash = await hashPassword(u.password)
    try {
      await db
        .insert(users)
        .values({
          ...(u.id ? { id: u.id } : {}),
          email: u.email,
          username: u.username,
          passwordHash,
          eloRating: u.eloRating ?? 1200,
          kycStatus: 'UNVERIFIED',
        })
        .onConflictDoNothing()

      logger.info(`Seeded user: ${u.email} (${u.note})`)
    } catch (err) {
      logger.warn({ err, email: u.email }, 'Skipping user (may already exist)')
    }
  }

  logger.info('Seed complete')
  process.exit(0)
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed')
  process.exit(1)
})
