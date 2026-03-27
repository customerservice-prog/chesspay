import type { Config } from 'drizzle-kit'
import { config } from 'dotenv'

config({ path: '.env.local', override: true })

export default {
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config
