/**
 * One-shot local launch: embedded PG (USE_PGLITE) or Docker → compose up → wait → migrate → seed.
 * Run: npm run launch
 */
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

dotenv.config({ path: join(root, '.env.local'), override: true })

function findDocker() {
  const paths = [
    'docker',
    String.raw`C:\Program Files\Docker\Docker\resources\bin\docker.exe`,
  ]
  for (const p of paths) {
    if (p.includes('\\') && !existsSync(p)) continue
    const r = spawnSync(p, ['version'], { encoding: 'utf8', shell: true })
    if (r.status === 0) return p
  }
  return null
}

function run(label, cmd, args, opts = {}) {
  console.log(`\n→ ${label}`)
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    cwd: root,
    env: { ...process.env },
    ...opts,
  })
  return r.status === 0
}

const usePglite = process.env.USE_PGLITE === 'true' || process.env.USE_PGLITE === '1'

if (usePglite) {
  console.log('USE_PGLITE=true — embedded Postgres (no Docker).')
  if (!run('Migrations', 'npm', ['run', 'db:migrate'])) process.exit(1)
  if (!run('Seed', 'npm', ['run', 'db:seed'])) process.exit(1)
  console.log('\nDatabase ready. Start the app with: npm run dev\n')
  process.exit(0)
}

const docker = findDocker()
if (!docker) {
  console.error(`
Docker was not found. Options:

  A) Zero-install DB: add to .env.local:
       USE_PGLITE=true
     Then run: npm run launch

  B) Install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/
     Start Docker, set DATABASE_URL (see .env.example), then: npm run launch

  C) Native Postgres: set DATABASE_URL in .env.local, then:
       npm run db:setup:native
`)
  process.exit(1)
}

console.log('Using Docker:', docker)

if (!run('Docker Compose up', docker, ['compose', '-f', join(root, 'docker-compose.yml'), 'up', '-d'])) {
  process.exit(1)
}

if (!run('Wait for Postgres', 'npm', ['run', 'db:wait'])) process.exit(1)
if (!run('Migrations', 'npm', ['run', 'db:migrate'])) process.exit(1)
if (!run('Seed', 'npm', ['run', 'db:seed'])) process.exit(1)

console.log('\nDatabase ready. Start the app with: npm run dev\n')
