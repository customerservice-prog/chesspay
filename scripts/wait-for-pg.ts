/**
 * Polls DATABASE_URL until Postgres accepts connections (dev helper for docker compose).
 */
import './load-env'
import { isEmbeddedPg } from '../db/client'
import postgres from 'postgres'

if (isEmbeddedPg()) {
  console.log('USE_PGLITE: skipping wait for external Postgres.')
  process.exit(0)
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set (.env.local)')
  process.exit(1)
}
const url = databaseUrl

const maxAttempts = 45
const delayMs = 2000

async function main() {
  for (let i = 1; i <= maxAttempts; i++) {
    const sql = postgres(url, { max: 1, connect_timeout: 5 })
    try {
      await sql`select 1`
      await sql.end()
      console.log(`Postgres is up (attempt ${i}/${maxAttempts})`)
      process.exit(0)
    } catch {
      await sql.end().catch(() => {})
      process.stdout.write(`Waiting for Postgres… ${i}/${maxAttempts}\r`)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  console.error('\nPostgres did not become ready in time. Is Docker running? Try: npm run db:up')
  process.exit(1)
}

main()
