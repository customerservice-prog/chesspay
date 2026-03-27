/**
 * Load env before any module that imports db/client or other env-dependent code.
 * ESM evaluates static imports before the rest of the file, so this must be
 * imported first from server/index.ts.
 */
import { config } from 'dotenv'
import { existsSync } from 'fs'
import { join } from 'path'

const root = join(__dirname, '..')

config({ path: join(root, '.env.local'), override: true })

const dev = process.env.NODE_ENV !== 'production'
const pglite = process.env.USE_PGLITE === 'true' || process.env.USE_PGLITE === '1'
if (dev && !process.env.DATABASE_URL && !pglite && existsSync(join(root, '.env.example'))) {
  config({ path: join(root, '.env.example') })
}
