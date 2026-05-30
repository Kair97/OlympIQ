import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function Register() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
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
            <span className="oq-form-lbl">Username</span>
            <input
              className="oq-input"
              style={{ marginTop: 5 }}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="tourney_handle"
              autoComplete="username"
              minLength={3}
              maxLength={30}
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
              placeholder="≥ 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
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
