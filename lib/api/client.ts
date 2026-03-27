// Centralized API client — all fetch calls go through here.
// Never scatter raw fetch() calls across components.

class ApiClient {
  private token: string | null = null
  private baseUrl: string

  constructor() {
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  }

  setToken(token: string | null) {
    this.token = token
  }

  private getHeaders(extra?: Record<string, string>): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...extra,
    }
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    })
    return this.handleResponse<T>(res)
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(body),
    })
    return this.handleResponse<T>(res)
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',
    })
    return this.handleResponse<T>(res)
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new ApiError(
        json.message ?? 'Request failed',
        json.error ?? 'UNKNOWN',
        res.status
      )
      throw err
    }
    return json as T
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const apiClient = new ApiClient()

// Domain-specific API functions — import these in hooks/components
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ data: { user: unknown; accessToken: string } }>('/api/auth/login', { email, password }),
  register: (email: string, username: string, password: string) =>
    apiClient.post<{ data: { user: unknown; accessToken: string } }>('/api/auth/register', { email, username, password }),
}

export const walletApi = {
  getBalance: () =>
    apiClient.get<{ data: { balance: { available: number; locked: number; total: number } } }>('/api/wallet'),
  getTransactions: () =>
    apiClient.get<{ data: { transactions: unknown[] } }>('/api/wallet/transactions'),
  addTestFunds: (amount: number) =>
    apiClient.post<{ data: { balance: unknown } }>('/api/wallet', { amount }),
}

export const gamesApi = {
  getActive: () =>
    apiClient.get<{ data: { games: unknown[] } }>('/api/games?type=active'),
  getRecent: () =>
    apiClient.get<{ data: { games: unknown[] } }>('/api/games?type=recent'),
  getGame: (id: string) =>
    apiClient.get<{ data: { game: unknown; moves: unknown[] } }>(`/api/games/${id}`),
  createGame: (body: unknown) =>
    apiClient.post<{ data: { game: unknown } }>('/api/games', body),
}

export type MatchmakingJoinResult =
  | { status: 'matched'; gameId: string }
  | { status: 'queued' }

export type MatchmakingPollResult =
  | { status: 'matched'; gameId: string }
  | { status: 'queued' }
  | { status: 'idle' }

export const matchmakingApi = {
  join: (body: { wagerAmount: number; timeControl: { baseSecs: number; incrementSecs: number } }) =>
    apiClient.post<{ data: MatchmakingJoinResult }>('/api/matchmaking/join', body),
  poll: () => apiClient.get<{ data: MatchmakingPollResult }>('/api/matchmaking/poll'),
  cancel: () => apiClient.post<{ data: { cancelled: boolean } }>('/api/matchmaking/cancel', {}),
}

export const platformApi = {
  activity: () =>
    apiClient.get<{
      data: {
        liveMatches: number
        registeredPlayers: number
        gamesCompleted24h: number
        matchmakingSearching: number
        recentWins: { username: string; wagerAmount: string; completedAt: string | null }[]
      }
    }>('/api/platform/activity'),
}
