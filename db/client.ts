import { mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Sql } from 'postgres'
import * as schema from './schema'

type ChesspayGlobal = typeof globalThis & {
  __chesspayDrizzleDb?: unknown
  __chesspayDbInitPromise?: Promise<void>
  __chesspayPgSql?: Sql
}

const G = globalThis as ChesspayGlobal

export function isEmbeddedPg(): boolean {
  const v = process.env.USE_PGLITE
  return v === 'true' || v === '1'
}

/** File-backed PGlite on cloud-sync folders (e.g. OneDrive) often breaks WASM init; default to OS temp instead. */
function pgliteDataDir(): string {
  if (process.env.PGLITE_DATA_PATH) return process.env.PGLITE_DATA_PATH
  return join(tmpdir(), 'chesspay-pglite-data')
}

function getDrizzle(): unknown {
  return G.__chesspayDrizzleDb
}

export async function initDatabase(): Promise<void> {
  if (getDrizzle()) return
  if (!G.__chesspayDbInitPromise) {
    G.__chesspayDbInitPromise = (async () => {
      if (isEmbeddedPg()) {
        const { PGlite } = await import('@electric-sql/pglite')
        const { drizzle } = await import('drizzle-orm/pglite')
        const { migrate } = await import('drizzle-orm/pglite/migrator')
        const dataDir = pgliteDataDir()
        if (!dataDir.startsWith('memory://') && !dataDir.startsWith('idb://')) {
          mkdirSync(dataDir, { recursive: true })
        }
        const client = new PGlite(dataDir)
        await client.waitReady
        const instance = drizzle(client, { schema, logger: false })
        G.__chesspayDrizzleDb = instance
        const migrationsFolder = join(process.cwd(), 'db', 'migrations')
        await migrate(instance as never, { migrationsFolder })
      } else {
        if (!process.env.DATABASE_URL) {
          throw new Error(
            'DATABASE_URL is required unless USE_PGLITE=true (embedded Postgres).',
          )
        }
        const postgresMod = (await import('postgres')).default
        const { drizzle } = await import('drizzle-orm/postgres-js')
        const sql = postgresMod(process.env.DATABASE_URL, {
          max: process.env.NODE_ENV === 'production' ? 20 : 5,
          idle_timeout: 30,
          connect_timeout: 10,
        })
        G.__chesspayPgSql = sql
        G.__chesspayDrizzleDb = drizzle(sql, { schema, logger: false })
      }
    })()
  }
  await G.__chesspayDbInitPromise
}

// Stored on globalThis so the custom server (tsx) and Next-bundled API routes share one DB.
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_t, prop: string | symbol) {
    const drizzleDb = getDrizzle()
    if (!drizzleDb) {
      throw new Error(
        'Database not initialized. Call await initDatabase() before handling requests (see server/index.ts).',
      )
    }
    const d = drizzleDb as Record<string | symbol, unknown>
    const v = d[prop]
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(drizzleDb) : v
  },
}) as PostgresJsDatabase<typeof schema>

export function getRawPostgres(): Sql {
  const sql = G.__chesspayPgSql
  if (!sql) {
    throw new Error('Raw postgres driver is only available with DATABASE_URL, not USE_PGLITE.')
  }
  return sql
}

export { getRawPostgres as pgClient }
