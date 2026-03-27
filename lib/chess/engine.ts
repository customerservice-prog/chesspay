import { Chess } from 'chess.js'
import { IllegalMoveError, GameStateError } from '../errors'

export interface MoveInput {
  from: string
  to: string
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export interface MoveResult {
  san: string           // Standard algebraic notation
  fenAfter: string      // Board state after move
  isGameOver: boolean
  isCheckmate: boolean
  isDraw: boolean
  drawType?: 'stalemate' | 'insufficient' | 'threefold' | 'fifty_move'
  isCheck: boolean
  pgn: string           // Full PGN of game so far
}

/**
 * Validates and applies a move to the game state.
 * This is the ONLY place moves are validated — never trust the client.
 * Throws IllegalMoveError if the move is not legal in the given position.
 */
export function applyMove(currentFen: string, move: MoveInput): MoveResult {
  const chess = new Chess(currentFen)

  // Validate it's a legal move
  const result = chess.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  })

  if (!result) {
    throw new IllegalMoveError(`${move.from}${move.to}${move.promotion ?? ''}`)
  }

  const isGameOver = chess.isGameOver()
  const isCheckmate = chess.isCheckmate()
  const isDraw = chess.isDraw()

  let drawType: MoveResult['drawType']
  if (isDraw) {
    if (chess.isStalemate()) drawType = 'stalemate'
    else if (chess.isInsufficientMaterial()) drawType = 'insufficient'
    else if (chess.isThreefoldRepetition()) drawType = 'threefold'
    else drawType = 'fifty_move'
  }

  return {
    san: result.san,
    fenAfter: chess.fen(),
    isGameOver,
    isCheckmate,
    isDraw,
    drawType,
    isCheck: chess.isCheck(),
    pgn: chess.pgn(),
  }
}

/**
 * Returns whose turn it is from a FEN string.
 * 'w' = white, 'b' = black
 */
export function getTurnFromFen(fen: string): 'w' | 'b' {
  const parts = fen.split(' ')
  if (parts[1] !== 'w' && parts[1] !== 'b') {
    throw new GameStateError(`Invalid FEN: cannot determine turn from "${fen}"`)
  }
  return parts[1] as 'w' | 'b'
}

/**
 * Returns all legal moves from a FEN position (for debugging/anti-cheat).
 */
export function getLegalMoves(fen: string): string[] {
  const chess = new Chess(fen)
  return chess.moves({ verbose: false })
}

/**
 * Reconstructs a Chess instance from a list of UCI moves (for analysis).
 */
export function replayMoves(moves: string[]): Chess {
  const chess = new Chess()
  for (const uci of moves) {
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined
    chess.move({ from, to, promotion })
  }
  return chess
}

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
