import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { getStats } from '../api/profile'
import { getRecommendations } from '../api/analyzer'
import type { UserStats, RoadmapProblem } from '../types'

function PlatformCard({ stat }: { stat: UserStats }) {
  const name = stat.platform === 'codeforces' ? 'Codeforces' : 'LeetCode'
  return (
    <div className="oq-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{name}</span>
        {stat.rank && <span className="oq-tag mono">{stat.rank}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {stat.rating != null && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Rating</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', color: 'var(--accent)', fontWeight: 700 }}>{stat.rating}</div>
          </div>
        )}
        {stat.max_rating != null && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Max</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700 }}>{stat.max_rating}</div>
          </div>
        )}
        {stat.problems_solved != null && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Solved</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700 }}>{stat.problems_solved}</div>
          </div>
        )}
        {stat.contest_count != null && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Contests</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700 }}>{stat.contest_count}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProblemRow({ p }: { p: RoadmapProblem }) {
  const diffColor = p.difficulty === 'easy' ? 'var(--ok)' : p.difficulty === 'hard' ? 'var(--err)' : 'var(--warn)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', textDecoration: 'none', fontWeight: 500, fontSize: '0.875rem' }}>
          {p.title}
        </a>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.reason}</div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
        {p.difficulty && <span style={{ fontSize: '0.75rem', color: diffColor, fontWeight: 600, textTransform: 'capitalize' }}>{p.difficulty}</span>}
        {p.rating && <span className="oq-tag mono">{p.rating}</span>}
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="oq-btn-ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}>
          Solve ↗
        </a>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<UserStats[]>([])
  const [recs, setRecs] = useState<RoadmapProblem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [s, r] = await Promise.allSettled([getStats(), getRecommendations()])
      if (s.status === 'fulfilled') setStats(s.value ?? [])
      if (r.status === 'fulfilled') setRecs(r.value ?? [])
      setLoading(false)
    }
    void load()
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Dashboard</h1>
      <p style={{ color: 'var(--text-faint)', marginBottom: '2rem', fontSize: '0.875rem' }}>Welcome back, <span className="mono">{user?.username}</span></p>

      {loading ? (
        <p style={{ color: 'var(--text-faint)' }}>Loading stats…</p>
      ) : stats.length === 0 ? (
        <div className="oq-panel" style={{ textAlign: 'center', padding: '3rem 1.25rem' }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: '1rem' }}>No platform accounts connected yet.</p>
          <a href="/profile" className="oq-btn-primary">Connect Codeforces or LeetCode →</a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {stats.map((s) => <PlatformCard key={s.id} stat={s} />)}
        </div>
      )}

      {recs.length > 0 && (
        <div className="oq-panel">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Recommended Problems</h2>
          <p style={{ color: 'var(--text-faint)', fontSize: '0.8125rem', marginBottom: '1rem' }}>AI-curated problems based on your current level and weak areas</p>
          {recs.slice(0, 8).map((p, i) => <ProblemRow key={i} p={p} />)}
        </div>
      )}
    </div>
  )
}
