const BASE = '/api/v1'

export interface AuthTokens {
  access_token: string
  refresh_token: string
}

export interface BotConfig {
  state: string
  bot_name: string
  dry_run: boolean
  stake_currency: string
  stake_amount: number | string
  max_open_trades: number
  exchange: string
  strategy: string
  api_version: number
}

export interface Profit {
  profit_all_coin: number
  profit_all_percent_mean: number
  profit_all_fiat: number
  profit_factor: number
  winning_trades: number
  losing_trades: number
  trade_count: number
  first_trade_date: string
  latest_trade_date: string
  avg_duration: string
  best_pair: string
  best_rate: number
  win_rate: number
}

export interface Balance {
  currencies: Array<{ currency: string; free: number; used: number; total: number; est_stake: number; est_stake_currency: string }>
  total: number
  value: number
  symbol: string
  stake: string
  note: string
  starting_capital: number
  starting_capital_ratio: number
  starting_capital_fiat: number
}

export interface Trade {
  trade_id: number
  pair: string
  base_currency: string
  quote_currency: string
  is_open: boolean
  is_short: boolean
  exchange: string
  amount: number
  stake_amount: number
  amount_requested: number
  profit_ratio: number
  profit_abs: number
  profit_factor: number
  open_rate: number
  current_rate: number
  close_rate: number | null
  open_date: string
  close_date: string | null
  open_timestamp: number
  close_timestamp: number | null
  open_order_id: string | null
  stop_loss_abs: number
  stop_loss_ratio: number
  stoploss_order_id: string | null
  stoploss_last_update: string | null
  initial_stop_loss_abs: number
  initial_stop_loss_ratio: number
  min_rate: number
  max_rate: number
  strategy: string
  enter_tag: string | null
  exit_reason: string | null
  timeframe: number
  duration: number
  duration_in_minutes: number
  sell_reason: string | null
}

export interface TradesResponse {
  trades: Trade[]
  trades_count: number
  total_trades: number
  offset: number
}

export interface LogEntry {
  timestamp: number
  level: string
  module: string
  message: string
}

export interface LogsResponse {
  logs: [string, number, string, string, string][]
  log_count: number
}

class ApiClient {
  private token: string | null = localStorage.getItem('xp-token')
  private refreshToken: string | null = localStorage.getItem('xp-refresh')
  private botUrl: string = localStorage.getItem('xp-url') || window.location.origin

  setTokens(tokens: AuthTokens) {
    this.token = tokens.access_token
    this.refreshToken = tokens.refresh_token
    localStorage.setItem('xp-token', tokens.access_token)
    localStorage.setItem('xp-refresh', tokens.refresh_token)
  }

  clearTokens() {
    this.token = null
    this.refreshToken = null
    localStorage.removeItem('xp-token')
    localStorage.removeItem('xp-refresh')
  }

  isAuthenticated() {
    return !!this.token
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.botUrl}${BASE}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    const res = await fetch(url, { ...options, headers })

    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.doRefresh()
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.token}`
        const retry = await fetch(url, { ...options, headers })
        if (!retry.ok) throw new Error(await retry.text())
        return retry.json()
      }
      this.clearTokens()
      throw new Error('Session expired')
    }

    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText)
      try {
        const parsed = JSON.parse(body)
        throw new Error(parsed.detail || parsed.message || body)
      } catch (e) {
        if (e instanceof SyntaxError) throw new Error(body || res.statusText)
        throw e
      }
    }

    const text = await res.text()
    return text ? JSON.parse(text) : ({} as T)
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${this.botUrl}${BASE}/token/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.refreshToken}` },
      })
      if (!res.ok) return false
      const data: AuthTokens = await res.json()
      this.setTokens(data)
      return true
    } catch {
      return false
    }
  }

  async login(username: string, password: string): Promise<AuthTokens> {
    const res = await fetch(`${this.botUrl}${BASE}/token/login`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
      },
    })
    if (!res.ok) throw new Error('Invalid credentials')
    const tokens: AuthTokens = await res.json()
    this.setTokens(tokens)
    return tokens
  }

  logout() { this.clearTokens() }

  ping = () => this.request<{ status: string }>('/ping')
  config = () => this.request<BotConfig>('/show_config')
  profit = () => this.request<Profit>('/profit')
  balance = () => this.request<Balance>('/balance')
  status = () => this.request<Trade[]>('/status')
  trades = (limit = 100, offset = 0) =>
    this.request<TradesResponse>(`/trades?limit=${limit}&offset=${offset}`)
  logs = (limit = 200) => this.request<LogsResponse>(`/logs?limit=${limit}`)
  startBot = () => this.request<{ status: string }>('/start', { method: 'POST' })
  stopBot = () => this.request<{ status: string }>('/stop', { method: 'POST' })
  reloadConfig = () => this.request<{ status: string }>('/reload_config', { method: 'POST' })
  forceExit = (tradeId: number, orderId?: string) =>
    this.request('/forceexit', {
      method: 'POST',
      body: JSON.stringify({ tradeid: String(tradeId), ordertype: orderId }),
    })
  deleteStoploss = (tradeId: number) =>
    this.request(`/trades/${tradeId}/stoploss`, { method: 'DELETE' })
}

export const api = new ApiClient()
