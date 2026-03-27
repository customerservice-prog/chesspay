import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

const root = resolve(process.cwd())
config({ path: resolve(root, '.env.local'), override: true })

const dev = process.env.NODE_ENV !== 'production'
const pglite = process.env.USE_PGLITE === 'true' || process.env.USE_PGLITE === '1'
if (dev && !process.env.DATABASE_URL && !pglite && existsSync(resolve(root, '.env.example'))) {
  config({ path: resolve(root, '.env.example') })
}
