import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { RefreshCw, ArrowDown } from 'lucide-react'

const LEVELS = ['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const
type Level = typeof LEVELS[number]

const LEVEL_STYLE: Record<string, string> = {
  DEBUG:    'text-xp-text-3 dark:text-xp-dtext-3',
  INFO:     'text-xp-accent',
  WARNING:  'text-amber-500 dark:text-amber-400',
  ERROR:    'text-xp-loss',
  CRITICAL: 'text-xp-loss font-bold',
}

export function Logs() {
  const [logs, setLogs] = useState<[number, string, string, string][]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [level, setLevel] = useState<Level>('ALL')
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const r = await api.logs(500)
      setLogs(r.logs); setErr('')
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id) }, [])
  useEffect(() => { if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs, autoScroll])

  const rows = level === 'ALL' ? logs : logs.filter(l => l[1] === level)

  return (
    <div className="flex flex-col h-[calc(100vh-44px-40px)] space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight text-xp-text dark:text-xp-dtext mr-2">Logs</h1>
        <div className="flex gap-0.5">
          {LEVELS.map(l => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`h-7 px-2.5 text-xs font-medium rounded transition-colors ${
                level === l
                  ? 'bg-xp-accent text-white'
                  : 'text-xp-text-3 dark:text-xp-dtext-3 hover:text-xp-text dark:hover:text-xp-dtext hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={load} className="xp-btn-ghost w-8 h-8 px-0" title="Refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setAutoScroll(a => !a)}
            className={`xp-btn-ghost w-8 h-8 px-0 ${autoScroll ? '!text-xp-accent' : ''}`}
            title="Auto-scroll"
          >
            <ArrowDown size={13} />
          </button>
        </div>
      </div>

      {err && <div className="text-xs text-xp-loss bg-xp-loss-bg rounded-lg px-3 py-2 border border-xp-loss/15 shrink-0">{err}</div>}

      {/* Log pane */}
      <div className="xp-card flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto font-mono text-xs p-3">
          {rows.length === 0 && (
            <span className="text-xp-text-3 dark:text-xp-dtext-3">No entries</span>
          )}
          {rows.map((log, i) => {
            const [ts, lvl, mod, msg] = log
            const time = new Date(ts * 1000).toLocaleTimeString('en-US', { hour12: false })
            return (
              <div key={i} className="flex gap-3 leading-[1.6] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] px-1 -mx-1 rounded">
                <span className="text-xp-text-3 dark:text-xp-dtext-3 shrink-0 w-[72px]">{time}</span>
                <span className={`shrink-0 w-[60px] ${LEVEL_STYLE[lvl] ?? 'text-xp-text-2 dark:text-xp-dtext-2'}`}>{lvl}</span>
                <span className="text-xp-text-3 dark:text-xp-dtext-3 shrink-0 w-[110px] truncate" title={mod}>{mod}</span>
                <span className="text-xp-text dark:text-xp-dtext break-all">{msg}</span>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
