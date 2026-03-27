/**
 * Creates the database named in DATABASE_URL if it does not exist (connects to `postgres` first).
 */
import './load-env'
import { isEmbeddedPg } from '../db/client'
import postgres from 'postgres'

if (isEmbeddedPg()) {
  console.log('USE_PGLITE: no server database to create (embedded Postgres).')
  process.exit(0)
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL missing')
  process.exit(1)
}

const dbNameMatch = databaseUrl.match(/\/([^/?]+)(\?.*)?$/)
const dbName = dbNameMatch?.[1]
if (!dbName || dbName === 'postgres') {
  console.error('DATABASE_URL must end with a database name (e.g. /checkmategg)')
  process.exit(1)
}
if (!/^[a-zA-Z0-9_-]+$/.test(dbName)) {
  console.error('Database name has unsupported characters')
  process.exit(1)
}

const adminUrl = databaseUrl.replace(/\/[^/?]+(\?.*)?$/, '/postgres')

async function main() {
  const sql = postgres(adminUrl, { max: 1, connect_timeout: 15 })
  try {
    await sql.unsafe(`CREATE DATABASE ${dbName}`)
    console.log(`Created database "${dbName}"`)
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err.code === '42P04') {
      console.log(`Database "${dbName}" already exists`)
    } else {
      throw e
    }
  }
  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
