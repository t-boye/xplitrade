import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts'
import { api, type Profit, type PairPerformance } from '../api/client'
import { useTheme } from '../components/ThemeProvider'

function num(n: number | null | undefined, d = 2): string {
  if (n == null || isNaN(n as number)) return '—'
  return (n as number).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return '—'
  return (n as number) >= 0 ? `+${((n as number) * 100).toFixed(2)}%` : `${((n as number) * 100).toFixed(2)}%`
}

function chartColors(dark: boolean) {
  return {
    bg:     dark ? '#111111' : '#FFFFFF',
    text:   dark ? '#666666' : '#AAAAAA',
    grid:   dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    border: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
  }
}

export function Analytics() {
  const { theme } = useTheme()
  const chartRef = useRef<HTMLDivElement>(null)
  const chartApi = useRef<IChartApi | null>(null)
  const lineSeries = useRef<ISeriesApi<'Line'> | null>(null)

  const [profit, setProfit] = useState<Profit | null>(null)
  const [performance, setPerformance] = useState<PairPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [hasEquityData, setHasEquityData] = useState(false)

  useEffect(() => {
    if (!chartRef.current) return
    const c = chartColors(theme === 'dark')
    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.text, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false },
      autoSize: true,
    })
    lineSeries.current = chart.addLineSeries({
      color: '#16C784',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: false,
    })
    chartApi.current = chart
    return () => { chart.remove() }
  }, [])

  useEffect(() => {
    const c = chartColors(theme === 'dark')
    chartApi.current?.applyOptions({
      layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.text },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border },
    })
  }, [theme])

  useEffect(() => {
    const load = async () => {
      const [pft, perf, trd] = await Promise.allSettled([
        api.profit(),
        api.performance(),
        api.trades(1000, 0),
      ])
      if (pft.status === 'fulfilled') setProfit(pft.value)
      if (perf.status === 'fulfilled') setPerformance(perf.value)
      if (trd.status === 'fulfilled') {
        const closed = (trd.value.trades ?? [])
          .filter(t => t.close_timestamp)
          .sort((a, b) => a.close_timestamp! - b.close_timestamp!)
        let cum = 0
        const points = closed.map(t => {
          cum += t.profit_abs
          return { time: Math.floor(t.close_timestamp! / 1000) as unknown as Time, value: +cum.toFixed(6) }
        })
        if (points.length) {
          lineSeries.current?.setData(points)
          chartApi.current?.timeScale().fitContent()
          setHasEquityData(true)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const winRate = profit && profit.trade_count > 0
    ? (profit.winning_trades / profit.trade_count) * 100 : null
  const totalPnl = profit?.profit_all_coin ?? null
  const isPositive = (totalPnl ?? 0) >= 0

  const STATS = [
    {
      label: 'Total P&L',
      value: totalPnl != null ? (isPositive ? '+' : '') + num(totalPnl, 4) : '—',
      color: totalPnl != null ? (isPositive ? 'text-xp-profit' : 'text-xp-loss') : '',
    },
    {
      label: 'Win Rate',
      value: winRate != null ? num(winRate, 1) + '%' : '—',
      color: '',
    },
    {
      label: 'Profit Factor',
      value: num(profit?.profit_factor, 2),
      color: '',
    },
    {
      label: 'Avg Duration',
      value: profit?.avg_duration || '—',
      color: '',
    },
    {
      label: 'Best Pair',
      value: profit?.best_pair || '—',
      color: '',
    },
    {
      label: 'Best Rate',
      value: profit?.best_rate != null ? pct(profit.best_rate) : '—',
      color: (profit?.best_rate ?? 0) >= 0 ? 'text-xp-profit' : 'text-xp-loss',
    },
  ]

  const sorted = [...performance].sort((a, b) => b.profit_abs - a.profit_abs)

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-xl font-semibold tracking-tight text-xp-text dark:text-xp-dtext">Analytics</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATS.map(({ label, value, color }) => (
          <div key={label} className="xp-card p-4">
            <div className="xp-label mb-2.5">{label}</div>
            {loading ? (
              <div className="h-6 w-16 bg-black/[0.06] dark:bg-white/[0.06] rounded animate-pulse" />
            ) : (
              <div className={`text-xl font-semibold tracking-tight tabnum leading-none ${color || 'text-xp-text dark:text-xp-dtext'}`}>
                {value}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Equity curve */}
      <div className="xp-card overflow-hidden">
        <div className="px-4 h-10 flex items-center xp-divider">
          <span className="text-sm font-semibold text-xp-text dark:text-xp-dtext">Equity Curve</span>
          <span className="text-xs text-xp-text-3 dark:text-xp-dtext-3 ml-2">cumulative P&L over closed trades</span>
        </div>
        <div className="relative" style={{ height: 220 }}>
          <div ref={chartRef} className="w-full h-full" />
          {!loading && !hasEquityData && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ zIndex: 10 }}>
              <span className="text-sm text-xp-text-3 dark:text-xp-dtext-3">No closed trades yet</span>
              <span className="text-xs text-xp-text-3 dark:text-xp-dtext-3 opacity-60">Equity curve will appear once trades close</span>
            </div>
          )}
        </div>
      </div>

      {/* Per-pair table */}
      <div className="xp-card overflow-hidden">
        <div className="px-4 h-10 flex items-center xp-divider">
          <span className="text-sm font-semibold text-xp-text dark:text-xp-dtext">Performance by Pair</span>
          {performance.length > 0 && (
            <span className="text-xs text-xp-text-3 dark:text-xp-dtext-3 ml-2">{performance.length} pairs</span>
          )}
        </div>
        {sorted.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-xp-text-3 dark:text-xp-dtext-3">
            No trade data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="xp-table">
              <thead>
                <tr>
                  {['#', 'Pair', 'Trades', 'Total P&L', 'Avg P&L %'].map(h => (
                    <th key={h} className="xp-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.pair} className="xp-tr">
                    <td className="xp-td tabnum text-xp-text-3 dark:text-xp-dtext-3 text-xs">{i + 1}</td>
                    <td className="xp-td font-semibold text-xp-text dark:text-xp-dtext">{p.pair}</td>
                    <td className="xp-td tabnum text-xs">{p.count}</td>
                    <td className={`xp-td tabnum font-medium text-xs ${p.profit_abs >= 0 ? 'text-xp-profit' : 'text-xp-loss'}`}>
                      {p.profit_abs >= 0 ? '+' : ''}{num(p.profit_abs, 4)}
                    </td>
                    <td className={`xp-td tabnum font-medium text-xs ${p.profit_ratio >= 0 ? 'text-xp-profit' : 'text-xp-loss'}`}>
                      {pct(p.profit_ratio)}
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
