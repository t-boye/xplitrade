import { useCallback, useEffect, useRef, useState } from 'react'
import { createChart, ColorType, type IChartApi, type ISeriesApi, type CandlestickData } from 'lightweight-charts'
import { api } from '../api/client'
import { useTheme } from '../components/ThemeProvider'
import { RefreshCw, ChevronDown, Minus, TrendingUp, AlignCenter, Trash2, MousePointer } from 'lucide-react'

const TFS = ['1m','5m','15m','30m','1h','4h','1d']
const PAIRS = ['BTC/USDT','ETH/USDT','BNB/USDT','SOL/USDT','XRP/USDT','ADA/USDT','DOGE/USDT']

const TF_LIMIT: Record<string, number> = {
  '1m': 1000, '5m': 1500, '15m': 2000, '30m': 2000,
  '1h': 3000, '4h': 2000, '1d': 1000,
}
const TF_BINANCE: Record<string, string> = {
  '1m':'1m','5m':'5m','15m':'15m','30m':'30m','1h':'1h','4h':'4h','1d':'1d',
}

type Tool = 'cursor' | 'hline' | 'trendline' | 'vline'

interface Drawing {
  id: number
  type: 'hline' | 'trendline' | 'vline'
  price?: number          // hline
  time?: number           // vline
  p1?: { time: number; price: number }  // trendline point 1
  p2?: { time: number; price: number }  // trendline point 2
}

async function fetchBinanceKlines(symbol: string, interval: string, totalLimit: number): Promise<CandlestickData[]> {
  const base = 'https://api.binance.com/api/v3/klines'
  const batchSize = 1000
  const batches = Math.ceil(totalLimit / batchSize)
  const allCandles: CandlestickData[] = []
  let endTime: number | undefined

  for (let i = 0; i < batches; i++) {
    const limit = i === batches - 1 ? totalLimit - allCandles.length : batchSize
    const url = `${base}?symbol=${symbol}&interval=${interval}&limit=${limit}${endTime ? `&endTime=${endTime}` : ''}`
    const r = await fetch(url)
    if (!r.ok) break
    const rows: number[][] = await r.json()
    if (!rows.length) break
    const batch: CandlestickData[] = rows.map(c => ({
      time: Math.floor(c[0] / 1000) as unknown as import('lightweight-charts').Time,
      open: parseFloat(c[1] as unknown as string),
      high: parseFloat(c[2] as unknown as string),
      low:  parseFloat(c[3] as unknown as string),
      close: parseFloat(c[4] as unknown as string),
    }))
    allCandles.unshift(...batch)
    endTime = rows[0][0] - 1
    if (rows.length < limit) break
  }
  return allCandles.sort((a, b) => (a.time as number) - (b.time as number))
}

let drawingIdCounter = 0

export function Chart() {
  const chartRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const chartApi = useRef<IChartApi | null>(null)
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const { theme } = useTheme()

  const [pair, setPair] = useState('BTC/USDT')
  const [tf, setTf] = useState('1h')
  const [trade, setTrade] = useState<{ open_rate: number; profit_ratio: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [noStrategy, setNoStrategy] = useState(false)

  // Drawing state
  const [tool, setTool] = useState<Tool>('cursor')
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [pending, setPending] = useState<{ time: number; price: number } | null>(null)
  const [svgLines, setSvgLines] = useState<{ id: number; x1: number; y1: number; x2: number; y2: number; label?: string }[]>([])

  const isDark = theme === 'dark'

  function getColors() {
    return {
      bg:     isDark ? '#111111' : '#FFFFFF',
      grid:   isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      text:   isDark ? '#666666' : '#AAAAAA',
      border: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
      up: '#16C784', down: '#EF5350',
      wick: isDark ? '#444444' : '#CCCCCC',
    }
  }

  useEffect(() => {
    if (!chartRef.current) return
    const c = getColors()
    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.text, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false },
      autoSize: true,
    })
    series.current = chart.addCandlestickSeries({
      upColor: c.up, downColor: c.down,
      borderUpColor: c.up, borderDownColor: c.down,
      wickUpColor: c.wick, wickDownColor: c.wick,
    })
    chartApi.current = chart
    return () => { chart.remove() }
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

  // Recompute SVG pixel coords whenever drawings or chart viewport changes
  const redrawSvg = useCallback(() => {
    const chart = chartApi.current
    const ser = series.current
    const svg = svgRef.current
    if (!chart || !ser || !svg) return
    const W = svg.clientWidth
    const H = svg.clientHeight
    if (!W || !H) return

    const lines: typeof svgLines = []
    for (const d of drawings) {
      if (d.type === 'hline' && d.price != null) {
        const y = ser.priceToCoordinate(d.price)
        if (y == null) continue
        lines.push({ id: d.id, x1: 0, y1: y, x2: W, y2: y, label: d.price.toFixed(2) })
      } else if (d.type === 'vline' && d.time != null) {
        const x = chart.timeScale().timeToCoordinate(d.time as import('lightweight-charts').Time)
        if (x == null) continue
        lines.push({ id: d.id, x1: x, y1: 0, x2: x, y2: H })
      } else if (d.type === 'trendline' && d.p1 && d.p2) {
        const x1 = chart.timeScale().timeToCoordinate(d.p1.time as import('lightweight-charts').Time)
        const y1 = ser.priceToCoordinate(d.p1.price)
        const x2 = chart.timeScale().timeToCoordinate(d.p2.time as import('lightweight-charts').Time)
        const y2 = ser.priceToCoordinate(d.p2.price)
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue
        lines.push({ id: d.id, x1, y1, x2, y2 })
      }
    }
    setSvgLines(lines)
  }, [drawings])

  useEffect(() => {
    const chart = chartApi.current
    if (!chart) return
    chart.timeScale().subscribeVisibleTimeRangeChange(redrawSvg)
    chart.subscribeCrosshairMove(redrawSvg)
    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(redrawSvg)
      chart.unsubscribeCrosshairMove(redrawSvg)
    }
  }, [redrawSvg])

  useEffect(() => { redrawSvg() }, [drawings, redrawSvg])

  const load = async () => {
    setLoading(true)
    try {
      const cfg = await api.config()
      if (!cfg.strategy) { setNoStrategy(true); setLoading(false); return }
      setNoStrategy(false)
      const symbol = pair.replace('/', '')
      const interval = TF_BINANCE[tf] ?? tf
      const limit = TF_LIMIT[tf] ?? 1000
      const candles = await fetchBinanceKlines(symbol, interval, limit)
      if (candles.length) { series.current?.setData(candles); chartApi.current?.timeScale().fitContent() }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [pair, tf])

  // Live WebSocket
  useEffect(() => {
    const symbol = pair.replace('/', '').toLowerCase()
    const interval = TF_BINANCE[tf] ?? tf
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`)
    ws.onmessage = (e) => {
      try {
        const k = JSON.parse(e.data).k
        if (!k) return
        series.current?.update({
          time: Math.floor(k.t / 1000) as unknown as import('lightweight-charts').Time,
          open: parseFloat(k.o), high: parseFloat(k.h),
          low: parseFloat(k.l), close: parseFloat(k.c),
        })
      } catch { /* ignore */ }
    }
    return () => ws.close()
  }, [pair, tf])

  useEffect(() => {
    api.status().then(ts => {
      const t = ts.find(x => x.pair === pair)
      setTrade(t ? { open_rate: t.open_rate, profit_ratio: t.profit_ratio } : null)
    }).catch(() => {})
  }, [pair])

  // Convert mouse event to chart price+time
  const mouseToChartPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    const chart = chartApi.current
    const ser = series.current
    const svg = svgRef.current
    if (!chart || !ser || !svg) return null
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const time = chart.timeScale().coordinateToTime(x)
    const price = ser.coordinateToPrice(y)
    if (time == null || price == null) return null
    return { time: time as unknown as number, price }
  }

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool === 'cursor') return
    const pt = mouseToChartPoint(e)
    if (!pt) return

    if (tool === 'hline') {
      setDrawings(prev => [...prev, { id: ++drawingIdCounter, type: 'hline', price: pt.price }])
    } else if (tool === 'vline') {
      setDrawings(prev => [...prev, { id: ++drawingIdCounter, type: 'vline', time: pt.time }])
    } else if (tool === 'trendline') {
      if (!pending) {
        setPending(pt)
      } else {
        setDrawings(prev => [...prev, { id: ++drawingIdCounter, type: 'trendline', p1: pending, p2: pt }])
        setPending(null)
      }
    }
  }

  const DRAW_COLOR = '#F59E0B'

  const TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'cursor',   icon: <MousePointer size={13} />, label: 'Cursor' },
    { id: 'hline',    icon: <Minus size={13} />,        label: 'Horizontal line' },
    { id: 'trendline',icon: <TrendingUp size={13} />,   label: 'Trend line' },
    { id: 'vline',    icon: <AlignCenter size={13} />,  label: 'Vertical line' },
  ]

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 44px - 40px)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {/* Pair selector */}
        <div className="relative">
          <select value={pair} onChange={e => setPair(e.target.value)} className="xp-input w-36 appearance-none pr-7 cursor-pointer">
            {PAIRS.map(p => <option key={p}>{p}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xp-text-3 dark:text-xp-dtext-3 pointer-events-none" />
        </div>

        {/* Timeframe pills */}
        <div className="flex gap-0.5 p-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.05]">
          {TFS.map(t => (
            <button key={t} onClick={() => setTf(t)}
              className={`h-7 px-2.5 text-xs font-medium rounded transition-colors ${tf === t ? 'bg-white dark:bg-white/[0.12] text-xp-text dark:text-xp-dtext shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-xp-text-3 dark:text-xp-dtext-3 hover:text-xp-text dark:hover:text-xp-dtext'}`}>
              {t}
            </button>
          ))}
        </div>

        <button onClick={load} className="xp-btn-ghost w-8 h-8 px-0" disabled={loading} title="Refresh">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>

        {/* Drawing tools */}
        <div className="flex gap-0.5 p-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.05]">
          {TOOLS.map(({ id, icon, label }) => (
            <button key={id} title={label} onClick={() => { setTool(id); setPending(null) }}
              className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${tool === id ? 'bg-white dark:bg-white/[0.12] text-xp-text dark:text-xp-dtext shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-xp-text-3 dark:text-xp-dtext-3 hover:text-xp-text dark:hover:text-xp-dtext'}`}>
              {icon}
            </button>
          ))}
        </div>

        {drawings.length > 0 && (
          <button title="Clear all drawings" onClick={() => { setDrawings([]); setPending(null) }}
            className="xp-btn-ghost w-8 h-8 px-0 text-xp-loss">
            <Trash2 size={13} />
          </button>
        )}

        {pending && (
          <span className="text-xs text-amber-500 animate-pulse">Click second point to finish line</span>
        )}

        {trade && (
          <div className={`ml-auto flex items-center gap-2 text-sm font-medium tabnum ${trade.profit_ratio >= 0 ? 'text-xp-profit' : 'text-xp-loss'}`}>
            <span className="text-xp-text-3 dark:text-xp-dtext-3 font-normal text-xs">Open @ {trade.open_rate.toFixed(4)}</span>
            <span>{trade.profit_ratio >= 0 ? '+' : ''}{(trade.profit_ratio * 100).toFixed(2)}%</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="xp-card flex-1 overflow-hidden relative">
        <div ref={chartRef} className="w-full h-full" />

        {/* SVG drawing overlay */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 5, cursor: tool === 'cursor' ? 'default' : 'crosshair', pointerEvents: tool === 'cursor' ? 'none' : 'all' }}
          onClick={handleSvgClick}
        >
          {svgLines.map(l => (
            <g key={l.id}>
              <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke={DRAW_COLOR} strokeWidth={1.5} strokeDasharray={l.label ? '4 3' : 'none'} opacity={0.85} />
              {l.label && (
                <text x={l.x2 - 6} y={l.y1 - 4} fill={DRAW_COLOR} fontSize={10} textAnchor="end" fontFamily="Inter, system-ui, sans-serif">
                  {l.label}
                </text>
              )}
            </g>
          ))}
        </svg>

        {noStrategy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ zIndex: 10, background: 'var(--chart-overlay-bg, rgba(17,17,17,0.92))' }}>
            <span className="text-sm font-medium text-xp-text dark:text-xp-dtext">No strategy configured</span>
            <span className="text-xs text-xp-text-3 dark:text-xp-dtext-3">Chart data requires a strategy to be set in your bot config</span>
          </div>
        )}
      </div>
    </div>
  )
}
