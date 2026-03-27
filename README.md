# Chesspay ♟

Real-time competitive chess with a wager-based ecosystem.

> **Stack:** Next.js 14 · TypeScript · Socket.io · PostgreSQL (or embedded PGlite) · Drizzle ORM · Custom JWT Auth

---

## Local Setup (Exact Commands)

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- Git  
- **Optional:** [Docker Desktop](https://docs.docker.com/desktop/) (for containerized Postgres), or local PostgreSQL 15+

---

### 1. Clone the repo

```bash
git clone https://github.com/customerservice-prog/chesspay.git
cd chesspay
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

1. Set strong **JWT** secrets (min 32 characters each).
2. Choose **one** database mode:
   - **Easiest (no Docker):** leave **`USE_PGLITE="true"`** as in `.env.example`. Data defaults to your OS temp dir (`%TEMP%/chesspay-pglite-data` on Windows).
   - **Docker Postgres:** set **`USE_PGLITE="false"`** and use **`DATABASE_URL`** pointing at `docker-compose.yml` (port **5433**), then run **`npm run launch`** (starts DB, migrates, seeds).
   - **Native Postgres:** `USE_PGLITE="false"`, set **`DATABASE_URL`**, then **`npm run db:setup:native`** (creates DB if needed, migrate, seed).

Keep **`PORT`**, **`NEXT_PUBLIC_APP_URL`**, and **`NEXT_PUBLIC_SOCKET_URL`** on the **same** host/port (default **3002** so 3000/3001 stay free).

Generate JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

Run twice — once per JWT secret.

### 4. Database: migrate + seed

If you use **PGlite** (`USE_PGLITE=true`):

```bash
npm run launch
```

(`launch` skips Docker when `USE_PGLITE` is set and runs migrate + seed only.)

If you already have Postgres up and `USE_PGLITE=false`:

```bash
npm run db:migrate
npm run db:seed
```

> **Note:** Migrations live in `db/migrations/`. You only need `npm run db:generate` when you change the Drizzle schema and need new SQL.

### 5. Start the app

```bash
npm run dev
```

The terminal prints **`Local app: http://localhost:3002`** (or whatever **`PORT`** you set).

Open that URL in the browser.

### 6. Production build / run

```bash
npm run build
npm run start
```

`npm run start` uses **`cross-env`** so **`NODE_ENV=production`** works on Windows and Unix.

---

## What You Can Test Locally

### Full game flow (two browser tabs)

1. Open the app URL (e.g. **http://localhost:3002**) in Tab 1 → log in as `alice@test.com`
2. Same URL in Tab 2 (incognito) → log in as `bob@test.com`
3. In Tab 1: **Play** → time control → **Find Match** (or share a game link as before)
4. Both players in the game room → moves sync over Socket.io
5. Checkmate, resign, or timeout → result screen

### Wallet testing

1. **Wallet** → **+ $100** (dev-only) for test funds
2. Wager games lock escrow; ledger updates after completion

### Verify ledger integrity

Connect to your DB (or use Drizzle Studio: `npm run db:studio`) and run:

```sql
SELECT txn_type, amount, status, created_at
FROM ledger_transactions
WHERE user_id = '<user id>'
ORDER BY created_at;

SELECT COALESCE(SUM(amount), 0) AS available_balance
FROM ledger_transactions
WHERE user_id = '<user id>'
AND status = 'SETTLED';
```

---

## Test accounts (after `npm run db:seed`)

| Email | Password | Notes |
|---|---|---|
| `alice@test.com` | `TestPass123!` | Primary test user |
| `bob@test.com` | `TestPass123!` | Second player |
| `admin@test.com` | `AdminPass123!` | Admin user |

---

## Project Structure

```
chesspay/
├── app/
│   ├── (auth)/                 # Login, Register
│   ├── (app)/                  # Dashboard, lobby, game, wallet, history, result
│   └── api/                    # auth, games, wallet, health, matchmaking, platform/activity
├── components/
├── context/                    # auth, matchmaking
├── db/                         # schema, migrations, client (Postgres-js + PGlite)
├── hooks/                      # useGameSocket
├── lib/                        # api, auth, chess, errors, logger, validation
├── server/
│   ├── index.ts                # Custom HTTP server: Next + Socket.io
│   ├── load-env.ts
│   ├── matchmaking/            # In-memory queue (dev)
│   ├── services/
│   └── socket/game.handler.ts
├── scripts/                    # migrate, seed, launch, wait-for-pg, ensure-database, load-env
├── middleware.ts
├── docker-compose.yml          # Postgres on host port 5433
├── .env.example
└── drizzle.config.ts
```

---

## Architecture Notes

### Why a custom server?

Next.js App Router does not handle WebSocket upgrades by itself. `server/index.ts` serves Next.js and Socket.io on the **same port**.

### Database modes

- **`USE_PGLITE=true`:** Embedded Postgres via `@electric-sql/pglite` for local dev without installing Postgres.
- **`USE_PGLITE=false`:** Use **`DATABASE_URL`** with Docker or a managed/local Postgres server.

The Drizzle instance is stored on **`globalThis`** so the custom server and Next’s API route bundles share one connection.

### The Ledger Model

`ledger_transactions` is **insert-only**. Balance = `SUM(amount) WHERE status = 'SETTLED'`.

### Move Validation

Move legality is enforced on the server (`lib/chess/engine.ts`), not the client.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server (tsx + hot reload) |
| `npm run launch` | PGlite: migrate + seed. Else: Docker up, wait, migrate, seed |
| `npm run build` | Production Next.js build |
| `npm run start` | Production server (`NODE_ENV=production`) |
| `npm run type-check` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed test users |
| `npm run db:seed:loadtest` | Seed 100 load-test accounts (dev only) |
| `npm run db:up` | `docker compose up -d` |
| `npm run db:wait` | Wait for Postgres (`DATABASE_URL`) |
| `npm run db:ensure` | Create database from `DATABASE_URL` if missing |
| `npm run db:setup` | Docker up + wait + migrate + seed |
| `npm run db:setup:native` | ensure + migrate + seed |
| `npm run db:studio` | Drizzle Studio |

---

## Phase Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 | ✅ In progress | Foundation, auth, real-time chess, ledger, wallet, lobby queue + matchmaking API, PGlite dev path |
| Phase 2 | 🔜 | Stripe deposits, ELO updates from rated games |
| Phase 3 | 🔜 | Anti-cheat MVP, KYC via Stripe Identity |
| Phase 4 | 🔜 | Redis adapter, PgBouncer, horizontal scaling |
| Phase 5 | 🔜 | Production deploy, hardening |

---

## Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `USE_PGLITE` | No | `true` / `1` = embedded PGlite (no `DATABASE_URL` needed for connection) |
| `PGLITE_DATA_PATH` | No | PGlite data dir; default OS temp, or `memory://`, or e.g. `.pglite/data` |
| `DATABASE_URL` | If `USE_PGLITE` off | PostgreSQL URL (e.g. Docker: port **5433**) |
| `JWT_ACCESS_SECRET` | ✅ | Min 32 chars |
| `JWT_REFRESH_SECRET` | ✅ | Min 32 chars |
| `JWT_ACCESS_EXPIRES_IN` | ✅ | e.g. `15m` |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | e.g. `7d` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Must match server origin (default dev: `http://localhost:3002`) |
| `NEXT_PUBLIC_SOCKET_URL` | ✅ | Same host/port as app for Socket.io |
| `PORT` | No | HTTP port (default **3002** in `.env.example`) |
| `PLATFORM_ACCOUNT_ID` | ✅ | UUID for rake account |
| `RAKE_PERCENT` / `NEXT_PUBLIC_RAKE_PERCENT` | ✅ | Keep in sync for UI |
| `RECONNECT_WINDOW_SECONDS` | ✅ | Disconnect forfeit window |
| `STRIPE_*` | Phase 2 | Stripe keys |
| `LOG_LEVEL` | No | `debug` \| `info` \| `warn` \| `error` |
