import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { useAuthStore } from '../store/authStore'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function Register() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!/^[A-Za-z0-9_]+$/.test(username)) {
      setError('Username can contain only letters, numbers, and underscores')
      return
    }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    try {
      const user = await register(email, username, password)
      setUser(user)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="oq-auth-page">
      <div className="oq-auth-card">
        {/* Brand */}
        <div className="oq-auth-brand">
          <div className="oq-auth-brand-mark">◇</div>
          <div className="oq-auth-brand-name">OlympIQ</div>
          <div className="oq-auth-brand-sub">Create your account</div>
        </div>

        {/* Error */}
        {error && <div className="oq-flash-err" role="alert">{error}</div>}

        {/* Form */}
        <form className="oq-form" onSubmit={handleSubmit}>
          <label>
            <span className="oq-form-lbl">Email</span>
            <input
              className="oq-input"
              style={{ marginTop: 5 }}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            <span className="oq-form-lbl">Username</span>
            <input
              className="oq-input"
              style={{ marginTop: 5 }}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="tourney_handle"
              autoComplete="username"
              pattern="[A-Za-z0-9_]+"
              title="Use only letters, numbers, and underscores"
              minLength={3}
              maxLength={30}
              required
            />
          </label>
          <label>
            <span className="oq-form-lbl">Password</span>
            <div style={{ position: 'relative', marginTop: 5 }}>
              <input
                className="oq-input"
                style={{ width: '100%', paddingRight: 40 }}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="≥ 8 characters"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-faint)', padding: 0, display: 'flex', alignItems: 'center',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </label>
          <button
            className="oq-btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '10px 16px', fontSize: 13 }}
          >
            {loading ? <><span className="oq-cursor-block">▌</span> Creating account…</> : 'Create account →'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
