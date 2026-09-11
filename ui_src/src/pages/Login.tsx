import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

export function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [url, setUrl] = useState(() => localStorage.getItem('xp-url') || 'http://127.0.0.1:8080')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      localStorage.setItem('xp-url', url)
      await login(user, pass)
      nav('/dashboard')
    } catch (e: any) {
      setErr(e.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-xp-bg dark:bg-xp-dbg px-4">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-xp-accent flex items-center justify-center mb-4 shadow-[0_2px_8px_rgba(22,199,132,0.35)]">
            <img src="/xplitrade_logo.png" alt="" className="w-6 h-6 object-contain brightness-0 invert" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-xp-text dark:text-xp-dtext">
            Sign in to Xplitrade
          </h1>
          <p className="text-sm text-xp-text-3 dark:text-xp-dtext-3 mt-1">
            Connect to your trading bot
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="xp-card p-5 space-y-3">
            {/* Server URL */}
            <div>
              <label className="xp-label mb-1.5">Server URL</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="xp-input w-full"
                placeholder="http://127.0.0.1:8080"
                required
                autoComplete="url"
              />
            </div>

            {/* Username */}
            <div>
              <label className="xp-label mb-1.5">Username</label>
              <input
                type="text"
                value={user}
                onChange={e => setUser(e.target.value)}
                className="xp-input w-full"
                placeholder="freqtrader"
                required
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="xp-label mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  className="xp-input w-full pr-9"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xp-text-3 dark:text-xp-dtext-3 hover:text-xp-text-2 dark:hover:text-xp-dtext-2"
                >
                  {show ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
          </div>

          {err && (
            <div className="text-xs text-xp-loss bg-xp-loss-bg rounded-md px-3 py-2.5 border border-xp-loss/20">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="xp-btn-primary w-full h-9 text-sm"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
