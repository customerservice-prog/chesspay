import './load-env'

/**
 * Creates 100 synthetic accounts for load / QA scenarios (dev & staging only).
 * Same password for all — NEVER use in production.
 *
 * Run: npm run db:seed:loadtest
 *
 * Login pattern: loadtest_001 @ loadtest001@loadtest.local / LoadTest123!
 */

import { db, initDatabase } from '../db/client'
import { users } from '../db/schema'
import { hashPassword } from '../lib/auth/password'
import { logger } from '../lib/logger'

const COUNT = 100
const PASSWORD = 'LoadTest123!'

async function seedLoadtest() {
  if (process.env.NODE_ENV === 'production') {
    logger.error('Load-test seed must NOT run in production')
    process.exit(1)
  }

  await initDatabase()

  const passwordHash = await hashPassword(PASSWORD)
  logger.info({ count: COUNT }, 'Seeding load-test users...')

  for (let i = 1; i <= COUNT; i++) {
    const suffix = String(i).padStart(3, '0')
    try {
      await db
        .insert(users)
        .values({
          email: `loadtest${suffix}@loadtest.local`,
          username: `loadtest_${suffix}`,
          passwordHash,
          eloRating: 800 + (i % 1200),
          kycStatus: i % 5 === 0 ? 'VERIFIED' : 'UNVERIFIED',
        })
        .onConflictDoNothing()
    } catch (err) {
      logger.warn({ err, i }, 'Skipping load-test user')
    }
  }

  logger.info(
    { count: COUNT, password: PASSWORD, usernamePattern: 'loadtest_NNN' },
    'Load-test seed complete'
  )
  process.exit(0)
}

seedLoadtest().catch((err) => {
  logger.error({ err }, 'Load-test seed failed')
  process.exit(1)
})
