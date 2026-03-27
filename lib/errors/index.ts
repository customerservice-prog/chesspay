export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly meta?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', `${resource} not found`, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409)
  }
}

export class InsufficientFundsError extends AppError {
  constructor() {
    super('INSUFFICIENT_FUNDS', 'Insufficient balance for this wager', 402)
  }
}

export class IllegalMoveError extends AppError {
  constructor(move: string) {
    super('ILLEGAL_MOVE', `Illegal move: ${move}`, 400, { move })
  }
}

export class GameStateError extends AppError {
  constructor(message: string) {
    super('GAME_STATE_ERROR', message, 409)
  }
}

// Narrow unknown errors safely
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  if (err instanceof Error) return new AppError('INTERNAL_ERROR', err.message, 500)
  return new AppError('INTERNAL_ERROR', 'An unexpected error occurred', 500)
}
