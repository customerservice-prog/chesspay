# Chesspay ♟

Real-time competitive chess with a wager-based ecosystem.

> **Stack:** Next.js 14 · TypeScript · Socket.io · PostgreSQL · Drizzle ORM · Custom JWT Auth

---

## Local Setup (Exact Commands)

### Prerequisites

Install these before starting:

- [Node.js 20+](https://nodejs.org/)
- [PostgreSQL 15+](https://www.postgresql.org/download/) running locally
- Git

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

### 3. Create your local database

Open psql or any Postgres client and run:

```sql
CREATE DATABASE checkmategg;
```

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/checkmategg"

JWT_ACCESS_SECRET="generate-with-openssl-rand-base64-64"
JWT_REFRESH_SECRET="generate-another-with-openssl-rand-base64-64"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3000"
NODE_ENV="development"
PORT="3000"

PLATFORM_ACCOUNT_ID="00000000-0000-0000-0000-000000000001"
RAKE_PERCENT="7.50"
PAYOUT_HOLD_MINUTES="15"
HIGH_STAKES_THRESHOLD_USD="25.00"
RECONNECT_WINDOW_SECONDS="60"

# Stripe — leave as-is for Phase 1 (not active yet)
STRIPE_SECRET_KEY="sk_test_REPLACE_ME"
STRIPE_WEBHOOK_SECRET="whsec_REPLACE_ME"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_REPLACE_ME"
```

Generate secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```
Run it twice — once for each JWT secret.

### 5. Run database migrations

```bash
npm run db:generate
npm run db:migrate
```

### 6. Seed test users

```bash
npm run db:seed
```

This creates:

| Email | Password | Notes |
|---|---|---|
| `alice@test.com` | `TestPass123!` | Primary test user |
| `bob@test.com` | `TestPass123!` | Second player |
| `admin@test.com` | `AdminPass123!` | Admin user |

### 7. Start the app

```bash
npm run dev
```

Open **http://localhost:3000**

---

## What You Can Test Locally

### Full game flow (two browser tabs)

1. Open **http://localhost:3000** in Tab 1 → log in as `alice@test.com`
2. Open **http://localhost:3000** in Tab 2 (incognito) → log in as `bob@test.com`
3. In Tab 1: go to **Play** → select time control → click **Find Match**
   - This creates a game and navigates to the game room
4. Copy the game URL from Tab 1
5. Paste it into Tab 2 — both players connect, game starts automatically
6. Play moves in both tabs — board syncs in real time via Socket.io
7. Checkmate, resign, or let time run out → result screen appears

### Wallet testing

1. Go to **Wallet** page
2. Click **+ $100** (dev-only button) to add test funds
3. Play a wager game — funds lock into escrow on game start
4. After game completes — ledger updates, winner receives net pot

### Verify ledger integrity

Connect to Postgres and run:
```sql
-- All transactions for a user
SELECT txn_type, amount, status, created_at
FROM ledger_transactions
WHERE user_id = '<paste user id here>'
ORDER BY created_at;

-- Derived balance (this is what the API returns)
SELECT COALESCE(SUM(amount), 0) AS available_balance
FROM ledger_transactions
WHERE user_id = '<paste user id here>'
AND status = 'SETTLED';
```

---

## Project Structure

```
chesspay/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login, Register pages
│   ├── (app)/                  # Authenticated pages
│   │   ├── dashboard/
│   │   ├── lobby/              # Matchmaking
│   │   ├── game/[id]/          # Live game room ← core product
│   │   ├── wallet/
│   │   └── result/[id]/
│   ├── api/                    # REST API routes
│   │   ├── auth/               # login, register, refresh
│   │   ├── games/              # game CRUD
│   │   ├── wallet/             # balance + transactions
│   │   └── health/             # Render health check
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                     # Button, Input, Card, Badge, Spinner, Toaster
│   ├── chess/                  # Chess-specific components
│   └── layout/                 # AppShell, Sidebar
├── context/
│   ├── auth.context.tsx         # Global auth state + token management
│   └── matchmaking.context.tsx  # Queue state
├── db/
│   ├── schema/                 # Drizzle schema (enums, users, games, ledger, anticheat)
│   ├── migrations/             # Generated SQL migrations
│   └── client.ts               # DB connection
├── hooks/
│   └── useGameSocket.ts        # Socket.io hook — all game events
├── lib/
│   ├── api/client.ts           # Centralized fetch wrapper
│   ├── auth/                   # JWT, password, middleware
│   ├── chess/engine.ts         # Server-side move validation (Chess.js)
│   ├── errors/                 # Typed error classes
│   ├── logger.ts               # Pino logger
│   └── validation.ts           # Zod schemas
├── server/
│   ├── index.ts                # Custom server (Next.js + Socket.io on same port)
│   ├── services/
│   │   ├── auth.service.ts     # Register, login, refresh, logout
│   │   ├── game.service.ts     # Create game, process moves, forfeit
│   │   └── wallet.service.ts   # Ledger, escrow, payout, balance
│   └── socket/
│       └── game.handler.ts     # Socket.io event handlers
├── scripts/
│   ├── migrate.ts              # Run Drizzle migrations
│   └── seed.ts                 # Create test users
├── middleware.ts               # Next.js route protection
├── .env.example                # Environment variable template
└── drizzle.config.ts
```

---

## Architecture Notes

### Why a custom server?

Next.js App Router doesn't support WebSocket upgrades natively. `server/index.ts` creates an HTTP server that mounts both Next.js (for all page/API routes) and Socket.io on the same port. No separate backend process needed.

### The Ledger Model

The `ledger_transactions` table is **INSERT-ONLY**. No balance column is ever mutated directly. Every wallet balance is computed as:

```sql
SELECT SUM(amount) FROM ledger_transactions
WHERE user_id = $1 AND status = 'SETTLED'
```

This makes the system crash-safe, auditable, and immune to double-spend bugs.

### Move Validation

**The client is never trusted for move legality.** All moves go through `lib/chess/engine.ts` (Chess.js) on the server inside the Socket.io handler. Illegal moves are rejected and the attempt is logged.

### Crash Recovery

Every valid move updates `games.fen_snapshot` in a DB transaction alongside the `game_moves` insert. If the server restarts mid-game, the exact board position is recoverable from the database.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run type-check` | TypeScript type check |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Apply migrations to database |
| `npm run db:seed` | Seed test users |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |

---

## Phase Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 | ✅ Complete | Foundation, auth, real-time chess, ledger, wallet UI |
| Phase 2 | 🔜 Next | Real matchmaking queue, ELO updates, Stripe deposits |
| Phase 3 | 🔜 | Anti-cheat MVP (Stockfish analysis), KYC via Stripe Identity |
| Phase 4 | 🔜 | Load testing, Redis adapter, PgBouncer, horizontal scaling |
| Phase 5 | 🔜 | Render deployment, production hardening |

---

## Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ | Min 32 chars — sign access tokens |
| `JWT_REFRESH_SECRET` | ✅ | Min 32 chars — sign refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | ✅ | e.g. `15m` |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | e.g. `7d` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Full app URL (`http://localhost:3000`) |
| `NEXT_PUBLIC_SOCKET_URL` | ✅ | Socket.io URL (same as app URL) |
| `PLATFORM_ACCOUNT_ID` | ✅ | UUID for rake collection account |
| `RAKE_PERCENT` | ✅ | Platform fee percentage (e.g. `7.50`) |
| `RECONNECT_WINDOW_SECONDS` | ✅ | Seconds before disconnect forfeits (e.g. `60`) |
| `STRIPE_SECRET_KEY` | Phase 2 | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Phase 2 | Stripe webhook signing secret |
| `PORT` | Optional | Server port (default `3000`) |
| `LOG_LEVEL` | Optional | `debug` \| `info` \| `warn` \| `error` |
