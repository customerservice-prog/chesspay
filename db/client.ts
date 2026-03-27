import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

// postgres-js connection pool
// For production, tune max based on your Postgres connection limits.
// Render's free tier: 5-10 connections; production: 25-50 via PgBouncer.
const connectionString = process.env.DATABASE_URL
const sql = postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 20 : 5,
  idle_timeout: 30,
  connect_timeout: 10,
})

export const db = drizzle(sql, { schema, logger: process.env.NODE_ENV === 'development' })

// Export the raw sql client for operations that need it (e.g., LISTEN/NOTIFY)
export { sql as pgClient }
