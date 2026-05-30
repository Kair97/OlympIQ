import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { logout } from '../../api/auth'
import { useEffect, useState } from 'react'
import { getAccounts } from '../../api/profile'
import type { PlatformAccount } from '../../types'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', glyph: '◐' },
  { to: '/analyzer',  label: 'Analyzer',  glyph: '▣' },
  { to: '/roadmap',   label: 'Roadmap',   glyph: '↗' },
  { to: '/profile',   label: 'Profile',   glyph: '○' },
]

interface Props {
  theme: string
  onThemeChange: (t: string) => void
}

export default function Sidebar({ theme, onThemeChange }: Props) {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<PlatformAccount[]>([])

  useEffect(() => {
    getAccounts().then(a => setAccounts(a ?? [])).catch(() => {})
  }, [])

  async function handleLogout() {
    await logout()
    setUser(null)
    navigate('/login')
  }

  const initials = user?.username?.[0]?.toUpperCase() ?? '?'
  const cfAcc = accounts.find(a => a.platform === 'codeforces')
  const lcAcc = accounts.find(a => a.platform === 'leetcode')

  return (
    <nav className="oq-sidenav">
      {/* Brand */}
      <div className="oq-brand">
        <span className="oq-brand-mark">◇</span>
        <span className="oq-brand-name">OlympIQ</span>
        <span className="oq-brand-tag">β</span>
      </div>

      {/* Main nav */}
      <div className="oq-nav-section">
        <div className="oq-nav-label">workspace</div>
        {navItems.map(({ to, label, glyph }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `oq-nav-item${isActive ? ' is-active' : ''}`}
          >
            <span className="oq-nav-glyph">{glyph}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Connected accounts */}
      {(cfAcc || lcAcc) && (
        <div className="oq-nav-section">
          <div className="oq-nav-label">connected</div>
          {cfAcc && (
            <div className="oq-conn">
              <span className="oq-dot oq-dot-ok" />
              <span>codeforces</span>
              <span className="oq-handle">@{cfAcc.handle}</span>
            </div>
          )}
          {lcAcc && (
            <div className="oq-conn">
              <span className="oq-dot oq-dot-ok" />
              <span>leetcode</span>
              <span className="oq-handle">@{lcAcc.handle}</span>
            </div>
          )}
          {!cfAcc && (
            <div className="oq-conn">
              <span className="oq-dot" />
              <span style={{ color: 'var(--text-faint)' }}>codeforces</span>
              <span className="oq-handle" style={{ color: 'var(--err)', opacity: 0.7 }}>not linked</span>
            </div>
          )}
          {!lcAcc && (
            <div className="oq-conn">
              <span className="oq-dot" />
              <span style={{ color: 'var(--text-faint)' }}>leetcode</span>
              <span className="oq-handle" style={{ color: 'var(--err)', opacity: 0.7 }}>not linked</span>
            </div>
          )}
        </div>
      )}

      {/* Footer: user + theme + logout */}
      <div className="oq-nav-foot">
        {/* Theme row */}
        <div className="oq-theme-row" style={{ marginBottom: 10 }}>
          {['dark', 'dim', 'light'].map(t => (
            <button
              key={t}
              className={`oq-theme-btn${theme === t ? ' is-active' : ''}`}
              onClick={() => onThemeChange(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="oq-user">
          <div className="oq-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="oq-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username}
            </div>
            <div className="oq-user-meta">member</div>
          </div>
          <button
            onClick={handleLogout}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
            title="Sign out"
          >
            ↩
          </button>
        </div>
      </div>
    </nav>
  )
}
