import pino from 'pino'

// pino-pretty uses a worker thread; Next.js API route bundling breaks its resolution (.next/.../worker.js).
// Enable readable logs only when explicitly requested (e.g. scripts): PINO_PRETTY=true
const usePrettyTransport =
  process.env.NODE_ENV !== 'production' && process.env.PINO_PRETTY === 'true'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(usePrettyTransport && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
})
