import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function Layout() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const check = async () => {
      try { await api.ping(); setConnected(true) }
      catch { setConnected(false) }
    }
    check()
    const id = setInterval(check, 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar connected={connected} />
      <main className="flex-1 p-5 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
