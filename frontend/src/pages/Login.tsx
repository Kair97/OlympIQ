import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      setUser(user)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
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
          <div className="oq-auth-brand-sub">AI-Powered Olympiad Training</div>
        </div>

        {/* Error */}
        {error && <div className="oq-flash-err">{error}</div>}

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
            <span className="oq-form-lbl">Password</span>
            <input
              className="oq-input"
              style={{ marginTop: 5 }}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>
          <button
            className="oq-btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '10px 16px', fontSize: 13 }}
          >
            {loading ? <><span className="oq-cursor-block">▌</span> Signing in…</> : 'Sign in →'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)' }}>
          No account?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Create one
          </Link>
        </div>
      </div>
    </div>
  )
}
