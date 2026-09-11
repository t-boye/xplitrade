import { useEffect, useState } from 'react'
import { api, type Trade } from '../api/client'
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

function num(n: number | null | undefined, d = 4): string {
  if (n == null || isNaN(n as number)) return '—'
  return (n as number).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(n: number): string {
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%'
}
function dt(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

const COLS = ['#', 'Pair', 'Side', 'Amount', 'Open Rate', 'Close Rate', 'P&L', 'P&L %', 'Exit', 'Opened', 'Closed']

export function Trades() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 50

  const load = async (off = 0) => {
    setLoading(true); setErr('')
    try {
      const r = await api.trades(limit, off)
      setTrades(r.trades); setTotal(r.total_trades); setOffset(off)
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const rows = filter
    ? trades.filter(t =>
        t.pair.toLowerCase().includes(filter.toLowerCase()) ||
        (t.exit_reason ?? '').toLowerCase().includes(filter.toLowerCase()))
    : trades

  const pages = Math.ceil(total / limit)
  const page = Math.floor(offset / limit) + 1

  return (
    <div className="space-y-3 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-xp-text dark:text-xp-dtext">Trades</h1>
          <p className="text-xs text-xp-text-3 dark:text-xp-dtext-3 mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xp-text-3 dark:text-xp-dtext-3 pointer-events-none" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter…"
              className="xp-input pl-7 w-40"
            />
          </div>
          <button onClick={() => load(offset)} className="xp-btn-ghost w-8 h-8 px-0" disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {err && <div className="text-sm text-xp-loss bg-xp-loss-bg rounded-lg px-4 py-2.5 border border-xp-loss/15">{err}</div>}

      <div className="xp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="xp-table">
            <thead>
              <tr>{COLS.map(h => <th key={h} className="xp-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={COLS.length} className="px-4 py-10 text-center text-sm text-xp-text-3 dark:text-xp-dtext-3">
                    No trades
                  </td>
                </tr>
              )}
              {rows.map(t => (
                <tr key={t.trade_id} className="xp-tr">
                  <td className="xp-td tabnum text-xp-text-3 dark:text-xp-dtext-3 text-xs">{t.trade_id}</td>
                  <td className="xp-td font-semibold text-xp-text dark:text-xp-dtext">{t.pair}</td>
                  <td className="xp-td">
                    <span className={`xp-badge text-xs ${t.is_short ? 'bg-xp-loss-bg text-xp-loss border border-xp-loss/15' : 'bg-xp-accent-dim text-xp-accent border border-xp-accent-border'}`}>
                      {t.is_short ? 'Short' : 'Long'}
                    </span>
                  </td>
                  <td className="xp-td tabnum text-xs">{num(t.amount)}</td>
                  <td className="xp-td tabnum text-xs">{num(t.open_rate)}</td>
                  <td className="xp-td tabnum text-xs">{t.close_rate ? num(t.close_rate) : '—'}</td>
                  <td className={`xp-td tabnum text-xs font-medium ${t.profit_abs >= 0 ? 'text-xp-profit' : 'text-xp-loss'}`}>
                    {t.profit_abs >= 0 ? '+' : ''}{num(t.profit_abs)}
                  </td>
                  <td className={`xp-td tabnum text-xs font-medium ${t.profit_ratio >= 0 ? 'text-xp-profit' : 'text-xp-loss'}`}>
                    {pct(t.profit_ratio)}
                  </td>
                  <td className="xp-td text-xs text-xp-text-3 dark:text-xp-dtext-3">
                    {t.exit_reason ?? t.sell_reason ?? '—'}
                  </td>
                  <td className="xp-td text-xs whitespace-nowrap">{dt(t.open_timestamp)}</td>
                  <td className="xp-td text-xs whitespace-nowrap">{dt(t.close_timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 xp-divider">
            <span className="text-xs text-xp-text-3 dark:text-xp-dtext-3">
              Page {page} of {pages} · {total} trades
            </span>
            <div className="flex gap-1">
              <button onClick={() => load(Math.max(0, offset - limit))} disabled={offset === 0} className="xp-btn-ghost w-7 h-7 px-0">
                <ChevronLeft size={13} />
              </button>
              <button onClick={() => load(offset + limit)} disabled={offset + limit >= total} className="xp-btn-ghost w-7 h-7 px-0">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
