import './load-env'
import { initDatabase, isEmbeddedPg, db } from '../db/client'
import { logger } from '../lib/logger'

async function runMigrations() {
  await initDatabase()

  if (isEmbeddedPg()) {
    logger.info('PGlite: migrations run during database init')
    process.exit(0)
  }

  const { migrate } = await import('drizzle-orm/postgres-js/migrator')
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
