import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from '../db/client'
import { logger } from '../lib/logger'

async function runMigrations() {
  logger.info('Running database migrations...')

  try {
    await migrate(db, { migrationsFolder: './db/migrations' })
    logger.info('Migrations completed successfully')
    process.exit(0)
  } catch (err) {
    logger.error({ err }, 'Migration failed')
    process.exit(1)
  }
}

runMigrations()
