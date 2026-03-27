import { NextResponse } from 'next/server'
import { AppError, toAppError } from './errors'
import { logger } from './logger'

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status })
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 })
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

export function handleError(err: unknown, context?: string): NextResponse {
  const appErr = toAppError(err)

  if (appErr.statusCode >= 500) {
    logger.error({ err, context }, 'Internal server error')
  } else if (appErr.statusCode >= 400) {
    logger.warn({ code: appErr.code, message: appErr.message, context }, 'Client error')
  }

  return NextResponse.json(
    {
      error: appErr.code,
      message: appErr.message,
      ...(appErr.meta ? { meta: appErr.meta } : {}),
    },
    { status: appErr.statusCode }
  )
}
