import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { refresh } from '../api/auth'
import { useAuthStore } from '../store/authStore'

const FEATURES = [
  {
    icon: '✦',
    title: 'Razbor — Problem Breakdown',
    sub: 'Deep educational analysis of any CF or LeetCode problem. Algorithm approach, progressive hints, complexity — no spoiler code.',
  },
  {
    icon: '↗',
    title: 'Personalized Roadmap',
    sub: 'AI generates weekly, topic-based, or interview-prep plans calibrated to your actual rating, solved history, and goal.',
  },
  {
    icon: '◈',
    title: 'Smart Recommendations',
    sub: 'Problems you haven\'t solved yet, selected to fill your exact gaps — calibrated above your rating so every solve counts.',
  },
]

export default function Landing() {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (user) { navigate('/dashboard', { replace: true }); return }
    refresh()
      .then(u => { setUser(u); navigate('/dashboard', { replace: true }) })
      .catch(() => setChecking(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (checking && !user) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
          <span style={{ color: 'var(--accent)', marginRight: 8 }}>◇</span>loading…
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 48px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--accent)', fontSize: 20 }}>◇</span>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>OlympIQ</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/login" className="oq-btn-ghost" style={{ textDecoration: 'none' }}>Sign in</Link>
          <Link to="/register" className="oq-btn-primary" style={{ textDecoration: 'none' }}>Start for free →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20 }}>
          AI-powered competitive programming training
        </div>
        <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 20px' }}>
          From 1200 to<br />
          <span style={{ color: 'var(--accent)' }}>Candidate Master.</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-dim)', lineHeight: 1.6, margin: '0 0 36px', maxWidth: '52ch', marginLeft: 'auto', marginRight: 'auto' }}>
          AI-generated study roadmap, problem-by-problem. Built for the olympiad student
          who knows <em>what</em> to practice but not <em>what to do next.</em>
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="oq-btn-primary oq-btn-lg" style={{ textDecoration: 'none' }}>
            Start for free →
          </Link>
          <a href="#how" className="oq-btn-ghost oq-btn-lg" style={{ textDecoration: 'none' }}>
            See how it works ↓
          </a>
        </div>
        <div style={{ marginTop: 28, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>
          Codeforces · LeetCode · Gemini AI · no subscription required
        </div>
      </section>

      {/* Feature cards */}
      <section id="how" style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 36 }}>
          how it works
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="oq-panel" style={{ padding: '28px 24px', gap: 14 }}>
              <div style={{ fontSize: 22, color: 'var(--accent)', filter: 'drop-shadow(0 0 8px var(--accent-soft))' }}>{f.icon}</div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>{f.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section style={{ borderTop: '1px solid var(--line)', padding: '60px 24px', textAlign: 'center', background: 'var(--bg-sunken)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--accent)', marginBottom: 16 }}>◇</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
          Ready to grind smarter?
        </h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '0 0 28px' }}>
          Connect your Codeforces account and get a personalized plan in under 30 seconds.
        </p>
        <Link to="/register" className="oq-btn-primary oq-btn-lg" style={{ textDecoration: 'none' }}>
          Create your account →
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '20px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--accent)' }}>◇</span> OlympIQ
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>
          built for competitive programmers
        </div>
      </footer>
    </div>
  )
}
