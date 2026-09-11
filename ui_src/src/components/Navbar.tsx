import { NavLink } from 'react-router-dom'
import { Sun, Moon, LogOut, Activity } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/trades',     label: 'Trades' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/chart',     label: 'Chart' },
  { to: '/logs',      label: 'Logs' },
  { to: '/settings',  label: 'Settings' },
]

export function Navbar({ connected }: { connected: boolean }) {
  const { theme, toggle } = useTheme()
  const { logout } = useAuth()

  return (
    <header className="h-11 flex items-center px-5 gap-6 border-b border-black/[0.07] dark:border-white/[0.06] bg-xp-surface dark:bg-xp-dsurf shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <img src="/xplitrade_logo.png" alt="" className="h-5 w-5 object-contain" />
        <span className="text-sm font-semibold tracking-tight text-xp-text dark:text-xp-dtext">
          Xplitrade
        </span>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-0.5 flex-1">
        {NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-3 h-7 flex items-center text-sm rounded-md transition-colors duration-100 font-medium ${
                isActive
                  ? 'text-xp-text dark:text-xp-dtext bg-black/[0.05] dark:bg-white/[0.07]'
                  : 'text-xp-text-3 dark:text-xp-dtext-3 hover:text-xp-text dark:hover:text-xp-dtext hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Connection dot */}
        <div className="flex items-center gap-1.5 mr-1">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-xp-accent' : 'bg-xp-text-3 dark:bg-xp-dtext-3'}`} />
          <span className="text-xs text-xp-text-3 dark:text-xp-dtext-3 hidden sm:block">
            {connected ? 'Connected' : 'Offline'}
          </span>
        </div>

        <button onClick={toggle} className="xp-btn-ghost w-8 h-8 px-0">
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button onClick={logout} className="xp-btn-ghost w-8 h-8 px-0" title="Sign out">
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}
