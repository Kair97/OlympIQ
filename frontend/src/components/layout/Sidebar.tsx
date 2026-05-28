import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { logout } from '../../api/auth'

const links = [
  { to: '/dashboard',       label: 'Dashboard',      icon: '⊞' },
  { to: '/roadmap',         label: 'Roadmap',        icon: '🗺' },
  { to: '/analyzer',        label: 'Analyzer',       icon: '🔍' },
  { to: '/profile',         label: 'Profile',        icon: '⚙' },
]

interface Props { theme: string; onThemeChange: (t: string) => void }

export default function Sidebar({ theme, onThemeChange }: Props) {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    setUser(null)
    navigate('/login')
  }

  return (
    <aside style={{
      width: 248,
      minWidth: 248,
      background: 'var(--bg-sunken)',
      borderRight: '1px solid var(--line)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem 0',
      height: '100%',
    }}>
      <div style={{ padding: '0 1.25rem 1.5rem' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--accent)' }}>
          OlympIQ
        </span>
      </div>

      <nav style={{ flex: 1 }}>
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 1.25rem',
              color: isActive ? 'var(--text)' : 'var(--text-dim)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              boxShadow: isActive ? 'inset 2px 0 0 var(--accent)' : 'none',
              transition: 'background 0.15s, color 0.15s',
            })}
          >
            <span style={{ fontSize: '1rem' }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--line)' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginBottom: 2 }}>Signed in as</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            {user?.username}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {['dark', 'dim', 'light'].map((t) => (
            <button
              key={t}
              onClick={() => onThemeChange(t)}
              style={{
                flex: 1,
                padding: '0.25rem',
                fontSize: '0.6875rem',
                background: theme === t ? 'var(--accent-soft)' : 'var(--bg-elev)',
                color: theme === t ? 'var(--accent-fg)' : 'var(--text-faint)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <button onClick={handleLogout} className="oq-btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
