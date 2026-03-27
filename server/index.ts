/**
 * Custom server entry point.
 * Mounts Next.js request handler and Socket.io on the same HTTP server.
 * This is required because Next.js app router does not natively support WebSockets.
 *
 * Run: npm run dev  (uses tsx for hot-reload in development)
 */

import './load-env'

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { initDatabase } from '../db/client'
import { logger } from '../lib/logger'

const dev = process.env.NODE_ENV !== 'production'
/** Default 3002 so 3000/3001 can stay free for other apps; override with PORT in .env.local */
const port = parseInt(process.env.PORT ?? '3002', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

async function main() {
  await initDatabase()

  const { initSocketServer } = await import('./socket/game.handler')

  await app.prepare()

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = initSocketServer(httpServer)
  logger.info('Socket.io initialized')

  httpServer.listen(port, () => {
    const localUrl = `http://localhost:${port}`
    logger.info({ port, env: process.env.NODE_ENV }, `Checkmate.GG server running`)
    logger.info(`  → App:    ${localUrl}`)
    logger.info(`  → Socket: ws://localhost:${port}`)
    // Plain line so it’s easy to spot in the terminal (JSON logs can bury the URL).
    console.log(`\n  Local app: ${localUrl}\n`)
  })
}

main().catch((err) => {
  logger.error({ err }, 'Server failed to start')
  process.exit(1)
})
