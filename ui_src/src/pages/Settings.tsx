import { useEffect, useState } from 'react'
import { api, type BotConfig } from '../api/client'
import { Play, Square, RefreshCw, AlertTriangle } from 'lucide-react'

export function Settings() {
  const [config, setConfig] = useState<BotConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = async () => {
    try { setConfig(await api.config()) }
    catch { /* ok */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const act = async (fn: () => Promise<{ status: string }>, label: string) => {
    setMsg(''); setErr('')
    try {
      const r = await fn()
      setMsg(r.status || label + ' OK')
      load()
    } catch (e: any) { setErr(e.message) }
  }

  const running = config?.state === 'running'

  const META = config ? [
    ['Bot Name',         config.bot_name],
    ['State',            config.state],
    ['Mode',             config.dry_run ? 'Dry Run' : 'Live Trading'],
    ['Exchange',         config.exchange],
    ['Strategy',         config.strategy || '—'],
    ['Stake Currency',   config.stake_currency],
    ['Stake Amount',     String(config.stake_amount)],
    ['Max Open Trades',  String(config.max_open_trades)],
    ['API Version',      String(config.api_version)],
  ] : []

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-xp-text dark:text-xp-dtext">Settings</h1>

      {/* Bot controls */}
      <div className="xp-card p-5">
        <p className="xp-label mb-4">Bot Control</p>

        {msg && <div className="text-xs text-xp-accent bg-xp-accent-dim rounded-md px-3 py-2.5 border border-xp-accent-border mb-3">{msg}</div>}
        {err && <div className="text-xs text-xp-loss bg-xp-loss-bg rounded-md px-3 py-2.5 border border-xp-loss/15 mb-3">{err}</div>}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => act(api.startBot, 'Started')} disabled={running} className="xp-btn-primary">
            <Play size={13} /> Start Bot
          </button>
          <button onClick={() => act(api.stopBot, 'Stopped')} disabled={!running} className="xp-btn-danger">
            <Square size={13} /> Stop Bot
          </button>
          <button onClick={() => act(api.reloadConfig, 'Config reloaded')} className="xp-btn-ghost">
            <RefreshCw size={13} /> Reload Config
          </button>
        </div>
      </div>

      {/* Config */}
      {loading ? (
        <div className="flex items-center justify-center h-24">
          <span className="w-5 h-5 border-2 border-xp-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : config ? (
        <div className="xp-card overflow-hidden">
          <div className="px-5 h-10 flex items-center xp-divider">
            <p className="xp-label">Active Configuration</p>
          </div>
          <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {META.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-xp-text-3 dark:text-xp-dtext-3">{k}</span>
                <span className={`text-sm font-medium ${
                  k === 'State' ? (running ? 'text-xp-accent' : 'text-xp-text-2 dark:text-xp-dtext-2')
                  : 'text-xp-text dark:text-xp-dtext'
                }`}>{v}</span>
              </div>
            ))}
          </div>
          {config.dry_run && (
            <div className="mx-5 mb-5 mt-1 flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/15 border border-amber-200/70 dark:border-amber-700/25 rounded-lg px-3 py-3">
              <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                Dry run mode is active — no real trades will be executed.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
