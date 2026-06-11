import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useStatsStore } from '../../store/statsStore'
import { logout } from '../../api/auth'
import { useEffect } from 'react'
import { getAccounts } from '../../api/profile'

const iconProps = {
  width: 16, height: 16, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round', strokeLinejoin: 'round',
} as const

const navItems = [
  {
    to: '/dashboard', label: 'Dashboard',
    glyph: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/analyzer', label: 'Analyzer',
    glyph: (
      <svg {...iconProps} aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.2" y2="16.2" />
        <path d="M8.5 11h5M11 8.5v5" />
      </svg>
    ),
  },
  {
    to: '/recommender', label: 'Recommender',
    glyph: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
        <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
      </svg>
    ),
  },
  {
    to: '/profile', label: 'Profile',
    glyph: (
      <svg {...iconProps} aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
    ),
  },
]

interface Props {
  theme: string
  onThemeChange: (t: string) => void
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ theme, onThemeChange, isOpen, onClose }: Props) {
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
    <nav className={`oq-sidenav${isOpen ? ' is-open' : ''}`}>
      {/* Mobile close button */}
      <button className="oq-sidenav-close" onClick={onClose} aria-label="Close navigation">×</button>

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
            onClick={onClose}
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
        <button className="oq-signout" onClick={handleLogout}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </nav>
  )
}
