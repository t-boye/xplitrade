import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, type IChartApi, type ISeriesApi, type CandlestickData } from 'lightweight-charts'
import { api } from '../api/client'
import { useTheme } from '../components/ThemeProvider'
import { RefreshCw, ChevronDown } from 'lucide-react'

const TFS = ['1m','5m','15m','30m','1h','4h','1d']
const PAIRS = ['BTC/USDT','ETH/USDT','BNB/USDT','SOL/USDT','XRP/USDT','ADA/USDT','DOGE/USDT']

export function Chart() {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartApi = useRef<IChartApi | null>(null)
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const { theme } = useTheme()

  const [pair, setPair] = useState('BTC/USDT')
  const [tf, setTf] = useState('1h')
  const [trade, setTrade] = useState<{ open_rate: number; profit_ratio: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const tok = () => localStorage.getItem('xp-token') ?? ''

  function getColors() {
    const d = theme === 'dark'
    return {
      bg:     d ? '#111111' : '#FFFFFF',
      grid:   d ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      text:   d ? '#666666' : '#AAAAAA',
      border: d ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
      up: '#16C784', down: '#EF5350',
      wick: d ? '#444444' : '#CCCCCC',
    }
  }

  useEffect(() => {
    if (!chartRef.current) return
    const c = getColors()
    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: c.bg },
        textColor: c.text,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11,
      },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false },
      width: chartRef.current.clientWidth,
      height: chartRef.current.clientHeight,
    })
    series.current = chart.addCandlestickSeries({
      upColor: c.up, downColor: c.down,
      borderUpColor: c.up, borderDownColor: c.down,
      wickUpColor: c.wick, wickDownColor: c.wick,
    })
    chartApi.current = chart

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chart.resize(chartRef.current.clientWidth, chartRef.current.clientHeight)
    })
    ro.observe(chartRef.current)
    return () => { ro.disconnect(); chart.remove() }
  }, [])

  useEffect(() => {
    const c = getColors()
    chartApi.current?.applyOptions({
      layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.text },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border },
    })
    series.current?.applyOptions({
      upColor: c.up, downColor: c.down,
      borderUpColor: c.up, borderDownColor: c.down,
      wickUpColor: c.wick, wickDownColor: c.wick,
    })
  }, [theme])

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch(`/api/v1/pair_history?pair=${encodeURIComponent(pair)}&timeframe=${tf}&limit=300`, {
        headers: { Authorization: `Bearer ${tok()}` },
      })
      if (!r.ok) {
        const body = await r.text().catch(() => r.statusText)
        try {
          const parsed = JSON.parse(body)
          throw new Error(parsed.detail || `${r.status} ${r.statusText}`)
        } catch (e) {
          if (e instanceof SyntaxError) throw new Error(body || `${r.status} ${r.statusText}`)
          throw e
        }
      }
      const data = await r.json()
      const candles: CandlestickData[] = (data.data ?? []).map((c: number[]) => ({
        time: Math.floor(c[0] / 1000) as number,
        open: c[1], high: c[2], low: c[3], close: c[4],
      }))
      if (candles.length) { series.current?.setData(candles); chartApi.current?.timeScale().fitContent() }
    } catch (e: any) {
      if (!e.message?.includes('correct state')) setErr(e.message)
    }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [pair, tf])

  useEffect(() => {
    api.status().then(ts => {
      const t = ts.find(x => x.pair === pair)
      setTrade(t ? { open_rate: t.open_rate, profit_ratio: t.profit_ratio } : null)
    }).catch(() => {})
  }, [pair])

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 44px - 40px)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Pair selector */}
        <div className="relative">
          <select
            value={pair}
            onChange={e => setPair(e.target.value)}
            className="xp-input w-36 appearance-none pr-7 cursor-pointer"
          >
            {PAIRS.map(p => <option key={p}>{p}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xp-text-3 dark:text-xp-dtext-3 pointer-events-none" />
        </div>

        {/* Timeframe pills */}
        <div className="flex gap-0.5 p-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.05]">
          {TFS.map(t => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`h-7 px-2.5 text-xs font-medium rounded transition-colors ${
                tf === t
                  ? 'bg-white dark:bg-white/[0.12] text-xp-text dark:text-xp-dtext shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                  : 'text-xp-text-3 dark:text-xp-dtext-3 hover:text-xp-text dark:hover:text-xp-dtext'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <button onClick={load} className="xp-btn-ghost w-8 h-8 px-0" disabled={loading} title="Refresh">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>

        {trade && (
          <div className={`ml-auto flex items-center gap-2 text-sm font-medium tabnum ${trade.profit_ratio >= 0 ? 'text-xp-profit' : 'text-xp-loss'}`}>
            <span className="text-xp-text-3 dark:text-xp-dtext-3 font-normal text-xs">Open @ {trade.open_rate.toFixed(4)}</span>
            <span>{trade.profit_ratio >= 0 ? '+' : ''}{(trade.profit_ratio * 100).toFixed(2)}%</span>
          </div>
        )}
      </div>

      {err && <div className="text-xs text-xp-loss bg-xp-loss-bg rounded-md px-3 py-2 border border-xp-loss/15 shrink-0">{err}</div>}

      {/* Chart */}
      <div className="xp-card flex-1 overflow-hidden">
        <div ref={chartRef} className="w-full h-full" />
      </div>
    </div>
  )
}
