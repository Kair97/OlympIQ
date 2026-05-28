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
      const msg = err instanceof Error ? err.message : 'Registration failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="oq-panel" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--accent)' }}>OlympIQ</span>
          <p style={{ color: 'var(--text-faint)', marginTop: '0.5rem', fontSize: '0.875rem' }}>Create your account</p>
        </div>

        {error && (
          <div style={{ background: 'var(--err)', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="oq-label">Email</label>
            <input className="oq-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <label className="oq-label">Username</label>
            <input className="oq-input" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="tourney_handle" minLength={3} maxLength={30} required />
          </div>
          <div>
            <label className="oq-label">Password</label>
            <input className="oq-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" minLength={8} required />
          </div>
          <button className="oq-btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--text-faint)', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
