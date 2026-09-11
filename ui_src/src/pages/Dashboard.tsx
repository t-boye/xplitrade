import { useEffect, useState } from 'react'
import { api, type Profit, type Balance, type Trade, type BotConfig } from '../api/client'
import { TrendingUp, TrendingDown, LogOut } from 'lucide-react'

function num(n: number | null | undefined, d = 2): string {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(n: number): string {
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%'
}
function dur(secs: number): string {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function Dashboard() {
  const [config, setConfig] = useState<BotConfig | null>(null)
  const [profit, setProfit] = useState<Profit | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [openTrades, setOpenTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [exiting, setExiting] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const load = async () => {
      try {
        const [cfg, pft, bal, open] = await Promise.allSettled([
          api.config(), api.profit(), api.balance(), api.status(),
        ])
        if (cfg.status === 'fulfilled') setConfig(cfg.value)
        if (pft.status === 'fulfilled') setProfit(pft.value)
        if (bal.status === 'fulfilled') setBalance(bal.value)
        if (open.status === 'fulfilled') setOpenTrades(open.value)
        setErr('')
      } catch (e: any) { setErr(e.message) }
      finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  if (loading && !config) return (
    <div className="flex items-center justify-center h-48">
      <span className="w-5 h-5 border-2 border-xp-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const forceExit = async (tradeId: number) => {
    setExiting(e => ({ ...e, [tradeId]: true }))
    try {
      await api.forceExit(tradeId)
      // refresh open positions after a short delay to let the exchange process it
      setTimeout(() => {
        api.status().then(ts => { if (Array.isArray(ts)) setOpenTrades(ts) }).catch(() => {})
        setExiting(e => { const n = { ...e }; delete n[tradeId]; return n })
      }, 1500)
    } catch {
      setExiting(e => { const n = { ...e }; delete n[tradeId]; return n })
    }
  }

  const totalProfit = profit?.profit_all_coin ?? 0
  const winRate = profit && profit.trade_count > 0 ? profit.winning_trades / profit.trade_count : 0
  const running = config?.state === 'running'

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-xp-text dark:text-xp-dtext">
              {config?.bot_name || 'Dashboard'}
            </h1>
            <span className={`xp-badge ${running ? 'bg-xp-accent-dim text-xp-accent border border-xp-accent-border' : 'bg-black/[0.05] dark:bg-white/[0.06] text-xp-text-3 dark:text-xp-dtext-3'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-xp-accent' : 'bg-xp-text-3 dark:bg-xp-dtext-3'}`} />
              {running ? 'Running' : config?.state || 'Webserver'}
            </span>
            {config?.dry_run && (
              <span className="xp-badge bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-700/30 text-xs">
                Dry Run
              </span>
            )}
          </div>
          <p className="text-sm text-xp-text-3 dark:text-xp-dtext-3 mt-0.5">
            {config?.exchange} · {config?.strategy || 'No strategy'}
          </p>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Balance',
            value: `${num(balance?.total, 4)}`,
            sub: balance?.stake ?? '',
            sub2: balance?.value ? `≈ $${num(balance.value)} USD` : undefined,
          },
          {
            label: 'Total Profit',
            value: totalProfit >= 0
              ? `+${num(Math.abs(totalProfit), 4)}`
              : `-${num(Math.abs(totalProfit), 4)}`,
            sub: balance?.stake ?? '',
            sub2: profit ? pct(profit.profit_all_percent_mean) + ' avg' : undefined,
            positive: totalProfit >= 0,
            icon: totalProfit >= 0 ? TrendingUp : TrendingDown,
          },
          {
            label: 'Win Rate',
            value: `${num(winRate * 100, 1)}%`,
            sub2: `${profit?.winning_trades ?? 0}W · ${profit?.losing_trades ?? 0}L · ${profit?.trade_count ?? 0} total`,
          },
          {
            label: 'Open Trades',
            value: String(openTrades.length),
            sub2: `of ${config?.max_open_trades ?? '—'} max`,
          },
        ].map(({ label, value, sub, sub2, positive, icon: Icon }) => (
          <div key={label} className="xp-card p-4">
            <div className="xp-label mb-2.5">{label}</div>
            <div className={`text-3xl font-semibold tracking-tightest tabnum leading-none mb-1 ${
              positive === undefined ? 'text-xp-text dark:text-xp-dtext'
              : positive ? 'text-xp-profit' : 'text-xp-loss'
            }`}>
              {value}
              {Icon && <Icon size={16} className="inline ml-1.5 mb-0.5 opacity-70" />}
            </div>
            {sub && <span className="text-sm text-xp-text-3 dark:text-xp-dtext-3">{sub}</span>}
            {sub2 && <div className="text-xs text-xp-text-3 dark:text-xp-dtext-3 mt-0.5">{sub2}</div>}
          </div>
        ))}
      </div>

      {/* Open positions */}
      <div className="xp-card overflow-hidden">
        <div className="px-4 h-10 flex items-center gap-3 xp-divider">
          <span className="text-sm font-semibold text-xp-text dark:text-xp-dtext">Open Positions</span>
          <span className="text-xs text-xp-text-3 dark:text-xp-dtext-3">{openTrades.length}</span>
        </div>
        {openTrades.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-xp-text-3 dark:text-xp-dtext-3">
            No open positions
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="xp-table">
              <thead>
                <tr>
                  {['Pair', 'Direction', 'Amount', 'Open Rate', 'Current', 'P&L', 'P&L %', 'Duration', ''].map(h => (
                    <th key={h} className="xp-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {openTrades.map(t => (
                  <tr key={t.trade_id} className="xp-tr">
                    <td className="xp-td font-semibold text-xp-text dark:text-xp-dtext">{t.pair}</td>
                    <td className="xp-td">
                      <span className={`xp-badge text-xs ${t.is_short ? 'bg-xp-loss-bg text-xp-loss border border-xp-loss/15' : 'bg-xp-accent-dim text-xp-accent border border-xp-accent-border'}`}>
                        {t.is_short ? 'Short' : 'Long'}
                      </span>
                    </td>
                    <td className="xp-td tabnum">{num(t.amount, 4)}</td>
                    <td className="xp-td tabnum">{num(t.open_rate, 4)}</td>
                    <td className="xp-td tabnum">{num(t.current_rate, 4)}</td>
                    <td className={`xp-td tabnum font-medium ${t.profit_abs >= 0 ? 'text-xp-profit' : 'text-xp-loss'}`}>
                      {t.profit_abs >= 0 ? '+' : ''}{num(t.profit_abs, 4)}
                    </td>
                    <td className={`xp-td tabnum font-medium ${t.profit_ratio >= 0 ? 'text-xp-profit' : 'text-xp-loss'}`}>
                      {pct(t.profit_ratio)}
                    </td>
                    <td className="xp-td">{dur(t.duration ?? 0)}</td>
                    <td className="xp-td">
                      <button
                        onClick={() => forceExit(t.trade_id)}
                        disabled={!!exiting[t.trade_id]}
                        className="inline-flex items-center gap-1 h-6 px-2 text-xs font-medium rounded text-xp-loss border border-xp-loss/20 hover:bg-xp-loss hover:text-white hover:border-xp-loss transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Force exit this trade"
                      >
                        {exiting[t.trade_id]
                          ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          : <LogOut size={11} />}
                        Exit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
