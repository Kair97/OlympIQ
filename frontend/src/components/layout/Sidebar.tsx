import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useStatsStore } from '../../store/statsStore'
import { logout } from '../../api/auth'
import { useEffect } from 'react'
import { getAccounts } from '../../api/profile'

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

  // Global accounts store — shared with Profile so disconnect updates the dots immediately
  const accounts    = useStatsStore(s => s.accounts)
  const setAccounts = useStatsStore(s => s.setAccounts)

  useEffect(() => {
    getAccounts().then(a => setAccounts(a ?? [])).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="oq-nav-section">
        <div className="oq-nav-label">platforms</div>

        <div className="oq-conn">
          <span className={`oq-dot${cfAcc ? ' oq-dot-ok' : ' oq-dot-err'}`} />
          <span style={{ color: cfAcc ? 'var(--text-dim)' : 'var(--text-faint)' }}>codeforces</span>
          <span className="oq-handle" style={{ color: cfAcc ? 'var(--text-faint)' : 'var(--err)', opacity: cfAcc ? 1 : 0.8 }}>
            {cfAcc ? `@${cfAcc.handle}` : 'not linked'}
          </span>
        </div>

        <div className="oq-conn">
          <span className={`oq-dot${lcAcc ? ' oq-dot-ok' : ' oq-dot-err'}`} />
          <span style={{ color: lcAcc ? 'var(--text-dim)' : 'var(--text-faint)' }}>leetcode</span>
          <span className="oq-handle" style={{ color: lcAcc ? 'var(--text-faint)' : 'var(--err)', opacity: lcAcc ? 1 : 0.8 }}>
            {lcAcc ? `@${lcAcc.handle}` : 'not linked'}
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div className="oq-nav-foot">
        {/* Theme row */}
        <div className="oq-theme-row" style={{ marginBottom: 12 }}>
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

        {/* User card */}
        <div className="oq-user">
          <div className="oq-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="oq-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username}
            </div>
            <div className="oq-user-meta">member</div>
          </div>
        </div>

        {/* Sign out — full-width, clearly labeled */}
        <button
          onClick={handleLogout}
          style={{
            marginTop: 8,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-faint)',
            padding: '7px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--line)',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'color 0.15s, border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--err)'
            e.currentTarget.style.borderColor = 'var(--err)'
            e.currentTarget.style.background = 'oklch(0.70 0.20 25 / 0.07)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-faint)'
            e.currentTarget.style.borderColor = 'var(--line)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <span style={{ fontSize: 13 }}>↩</span>
          Sign out
        </button>
      </div>
    </nav>
  )
}
