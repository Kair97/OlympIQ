import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { refresh } from '../../api/auth'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'

export default function AppShell() {
  const { user, setUser, setLoading, loading } = useAuthStore()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    refresh()
      .then((u) => setUser(u))
      .catch(() => { setUser(null); navigate('/login') })
      .finally(() => setLoading(false))
  }, [navigate, setLoading, setUser])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-faint)' }}>
        Loading…
      </div>
    )
  }

  if (!user) return null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar theme={theme} onThemeChange={setTheme} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '1.75rem 2rem' }}>
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  )
}
