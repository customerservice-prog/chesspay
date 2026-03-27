/** Count pieces on the board portion of a FEN string (before first space). */
function countOnBoard(fen: string): { upper: Record<string, number>; lower: Record<string, number> } {
  const board = fen.split(' ')[0] ?? ''
  const upper: Record<string, number> = {}
  const lower: Record<string, number> = {}
  for (const ch of board) {
    if (ch === '/') continue
    if (ch >= '1' && ch <= '8') continue
    if (ch >= 'A' && ch <= 'Z') upper[ch] = (upper[ch] ?? 0) + 1
    else if (ch >= 'a' && ch <= 'z') lower[ch] = (lower[ch] ?? 0) + 1
  }
  return { upper, lower }
}

const START_UPPER: Record<string, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1, K: 1 }
const START_LOWER: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }

const UNICODE: Record<string, string> = {
  P: '♙',
  N: '♘',
  B: '♗',
  R: '♖',
  Q: '♕',
  K: '♔',
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚',
}

/** Pieces captured by White (missing black material) and by Black (missing white material). */
export function capturedMaterial(fen: string): { takenByWhite: string[]; takenByBlack: string[] } {
  const { upper, lower } = countOnBoard(fen)
  const takenByWhite: string[] = []
  const takenByBlack: string[] = []

  for (const [piece, start] of Object.entries(START_LOWER)) {
    const onBoard = lower[piece] ?? 0
    const missing = start - onBoard
    const sym = UNICODE[piece] ?? piece
    for (let i = 0; i < missing; i++) takenByWhite.push(sym)
  }

  for (const [piece, start] of Object.entries(START_UPPER)) {
    if (piece === 'K') continue
    const onBoard = upper[piece] ?? 0
    const missing = start - onBoard
    const sym = UNICODE[piece] ?? piece
    for (let i = 0; i < missing; i++) takenByBlack.push(sym)
  }

  return { takenByWhite, takenByBlack }
}
