import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getDashboard, type CFDashboard, type LCDashboard, type DashboardData } from '../api/dashboard'

// ── Sparkline SVG ──────────────────────────────────────────────────────────
function Spark({ data, accent = 'var(--accent)' }: { data: number[]; accent?: string }) {
  if (!data || data.length < 2) return null
  const w = 220, h = 52
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * (w - 4) + 2,
    y: h - 4 - ((v - min) / span) * (h - 8),
  }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].x},${h} L${pts[0].x},${h} Z`
  const last = pts[pts.length - 1]
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={area} fill={accent} opacity="0.12" />
      <path d={line} fill="none" stroke={accent} strokeWidth="1.6" />
      <circle cx={last.x} cy={last.y} r="3" fill={accent} />
    </svg>
  )
}

// ── Platform Card ───────────────────────────────────────────────────────────
function CFCard({ p }: { p: CFDashboard }) {
  return (
    <div className="oq-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>Codeforces</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-faint)' }}>@{p.handle}</div>
        </div>
        <span className="oq-tag" style={{ fontSize: '0.75rem' }}>{p.rank}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{p.rating}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>rating · peak {p.max_rating}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700 }}>{p.problems_solved}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>solved · {p.contest_count} contests</div>
        </div>
      </div>
      {p.rating_history?.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Spark data={p.rating_history} accent="var(--accent)" />
        </div>
      )}
    </div>
  )
}

function LCCard({ p }: { p: LCDashboard }) {
  return (
    <div className="oq-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>LeetCode</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-faint)' }}>@{p.handle}</div>
        </div>
        <span className="oq-tag" style={{ fontSize: '0.75rem' }}>#{p.ranking.toLocaleString()}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-2)' }}>{p.rating > 0 ? Math.round(p.rating) : '—'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>contest rating · {p.contest_attend} contests</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700 }}>{p.problems_solved}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            <span style={{ color: 'var(--ok)' }}>{p.easy_solved}E</span>{' · '}
            <span style={{ color: 'var(--warn)' }}>{p.medium_solved}M</span>{' · '}
            <span style={{ color: 'var(--err)' }}>{p.hard_solved}H</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Topic Mastery Bars ──────────────────────────────────────────────────────
function TopicBars({ tagFreq }: { tagFreq: Record<string, number> }) {
  const entries = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  const maxCount = entries[0]?.[1] ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {entries.map(([topic, count]) => (
        <div key={topic} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 36px', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic}</div>
          <div style={{ height: 6, background: 'var(--bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', textAlign: 'right' }}>{count}</div>
        </div>
      ))}
    </div>
  )
}

// ── LC Skill Bars ───────────────────────────────────────────────────────────
function SkillBars({ skills }: { skills: Array<{ tagName: string; problemsSolved: number }> }) {
  const top = [...skills].sort((a, b) => b.problemsSolved - a.problemsSolved).slice(0, 8)
  const max = top[0]?.problemsSolved ?? 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {top.map(s => (
        <div key={s.tagName} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 36px', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.tagName}</div>
          <div style={{ height: 6, background: 'var(--bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(s.problemsSolved / max) * 100}%`, height: '100%', background: 'var(--accent-2)', borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', textAlign: 'right' }}>{s.problemsSolved}</div>
        </div>
      ))}
    </div>
  )
}

// ── Activity Heatmap (LC calendar, last 7 weeks) ────────────────────────────
function Heatmap({ calendar }: { calendar: Record<string, number> }) {
  const now = Date.now()
  const cells: number[] = []
  for (let i = 6 * 7 - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const found = Object.entries(calendar).find(([k]) => {
      const diff = Math.abs(parseInt(k) - d.getTime() / 1000)
      return diff < 43200 // within 12 hours
    })
    cells.push(found ? Math.min(4, found[1]) : 0)
  }

  const weeks: number[][] = []
  for (let w = 0; w < 6; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7))
  }

  const heatColors = ['var(--bg-elev)', 'oklch(0.76 0.10 150/0.4)', 'oklch(0.76 0.12 150/0.6)', 'oklch(0.76 0.14 150/0.8)', 'var(--ok)']

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {week.map((v, di) => (
              <div key={di} style={{ width: 14, height: 14, borderRadius: 3, background: heatColors[v] }} title={`${v} submissions`} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', marginTop: '0.5rem' }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-faint)' }}>less</span>
        {heatColors.map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />)}
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-faint)' }}>more</span>
      </div>
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard()
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const noPlatforms = !data?.codeforces && !data?.leetcode

  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', marginBottom: '0.25rem' }}>overview</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Welcome back, {user?.username}.</h1>
        {data?.codeforces && (
          <p style={{ color: 'var(--text-faint)', fontSize: '0.875rem' }}>
            Codeforces rating <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{data.codeforces.rating}</span>
            {' · '}
            LeetCode solved <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{data.leetcode?.problems_solved ?? 0}</span>
          </p>
        )}
      </div>

      {loading && <p style={{ color: 'var(--text-faint)' }}>Loading stats…</p>}

      {!loading && noPlatforms && (
        <div className="oq-panel" style={{ textAlign: 'center', padding: '3rem 1.25rem' }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: '1rem' }}>
            No platform accounts connected yet.
          </p>
          <button className="oq-btn-primary" onClick={() => navigate('/profile')}>
            Connect Codeforces or LeetCode →
          </button>
        </div>
      )}

      {!loading && !noPlatforms && (
        <>
          {/* Platform cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {data?.codeforces && <CFCard p={data.codeforces} />}
            {data?.leetcode && <LCCard p={data.leetcode} />}
          </div>

          {/* Bottom row: topic bars + heatmap */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* CF Topic Mastery */}
            {data?.codeforces && Object.keys(data.codeforces.tag_freq ?? {}).length > 0 && (
              <div className="oq-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Topic mastery</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Codeforces</span>
                </div>
                <TopicBars tagFreq={data.codeforces.tag_freq} />
              </div>
            )}

            {/* LC Skills */}
            {data?.leetcode && (data.leetcode.skills ?? []).length > 0 && (
              <div className="oq-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Skill breakdown</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>LeetCode</span>
                </div>
                <SkillBars skills={data.leetcode.skills} />
              </div>
            )}

            {/* LC Activity Heatmap */}
            {data?.leetcode && Object.keys(data.leetcode.calendar ?? {}).length > 0 && (
              <div className="oq-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Activity</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>last 6 weeks</span>
                </div>
                <Heatmap calendar={data.leetcode.calendar} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
