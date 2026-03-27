/**
 * Custom server entry point.
 * Mounts Next.js request handler and Socket.io on the same HTTP server.
 * This is required because Next.js app router does not natively support WebSockets.
 *
 * Run: npm run dev  (uses tsx for hot-reload in development)
 */

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { config } from 'dotenv'
import { initSocketServer } from './socket/game.handler'
import { logger } from '../lib/logger'

// Load env before anything else
config({ path: '.env.local' })

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

async function main() {
  await app.prepare()

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  // Attach Socket.io to the same HTTP server
  const io = initSocketServer(httpServer)
  logger.info('Socket.io initialized')

  httpServer.listen(port, () => {
    logger.info({ port, env: process.env.NODE_ENV }, `Checkmate.GG server running`)
    logger.info(`  → App:    http://localhost:${port}`)
    logger.info(`  → Socket: ws://localhost:${port}`)
  })
}

main().catch((err) => {
  logger.error({ err }, 'Server failed to start')
  process.exit(1)
})
