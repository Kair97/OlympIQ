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
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  // Close sidebar when screen grows past mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 901px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setSidebarOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
      {/* Mobile-only top bar */}
      <div className="oq-mobile-bar">
        <button
          className="oq-hamburger"
          aria-label="Open navigation"
          onClick={() => setSidebarOpen(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="6"  x2="21" y2="6"  />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="oq-mobile-brand">
          <span style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>◇</span>
          {' '}OlympIQ
        </div>
      </div>

      {/* Tap-away overlay behind sidebar drawer */}
      {sidebarOpen && (
        <div
          className="oq-mobile-overlay is-open"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        theme={theme}
        onThemeChange={setTheme}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="oq-main">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <StatusBar />
    </div>
  )
}
