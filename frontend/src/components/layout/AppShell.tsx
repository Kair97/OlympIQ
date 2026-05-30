import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { refresh } from '../../api/auth'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import ErrorBoundary from '../ErrorBoundary'

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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span style={{ color: 'var(--accent)', marginRight: 8 }}>◇</span>
          Loading…
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="oq-app">
      <Sidebar theme={theme} onThemeChange={setTheme} />
      <main className="oq-main">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <StatusBar />
    </div>
  )
}
