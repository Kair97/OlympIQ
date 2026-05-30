import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useStatsStore } from '../store/statsStore'
import { getDashboard, type CFDashboard, type LCDashboard, type DashboardData } from '../api/dashboard'

// ── rating pill helper ────────────────────────────────────────────────────────
function ratingClass(rating: number | null | undefined) {
  if (!rating) return ''
  const r = Math.min(35, Math.floor(rating / 100))
  return `r-${r}`
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Spark({ data, accent = 'var(--accent)' }: { data: number[]; accent?: string }) {
  if (!data || data.length < 2) return null
  const w = 220, h = 56
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
    <svg width={w} height={h} className="oq-spark">
      <path d={area} fill={accent} opacity="0.12" />
      <path d={line} fill="none" stroke={accent} strokeWidth="1.6" />
      <circle cx={last.x} cy={last.y} r="2.5" fill={accent} />
    </svg>
  )
}

// ── Platform Card ─────────────────────────────────────────────────────────────
function CFCard({ p }: { p: CFDashboard }) {
  return (
    <div className="oq-platcard">
      <div className="oq-platcard-head">
        <div className="oq-platcard-name">Codeforces</div>
        <div className="oq-platcard-handle">@{p.handle}</div>
      </div>
      <div className="oq-platcard-grid">
        <div>
          <div className="oq-stat-num">{p.rating ?? '—'}</div>
          <div className="oq-stat-lbl">rating · peak {p.max_rating ?? '—'}</div>
        </div>
        <div>
          <div className="oq-stat-num">{p.problems_solved ?? 0}</div>
          <div className="oq-stat-lbl">solved · {p.contest_count ?? 0} contests</div>
        </div>
      </div>
      <div className="oq-platcard-foot">
        {p.rating_history?.length > 1
          ? <Spark data={p.rating_history} accent="var(--accent)" />
          : <div style={{ height: 56 }} />}
        <div className={`oq-rating-pill ${ratingClass(p.rating)}`}>{p.rank ?? 'unrated'}</div>
      </div>
    </div>
  )
}

function LCCard({ p }: { p: LCDashboard }) {
  return (
    <div className="oq-platcard">
      <div className="oq-platcard-head">
        <div className="oq-platcard-name">LeetCode</div>
        <div className="oq-platcard-handle">@{p.handle}</div>
      </div>
      <div className="oq-platcard-grid">
        <div>
          <div className="oq-stat-num" style={{ color: 'var(--accent-2)' }}>
            {p.rating > 0 ? Math.round(p.rating) : '—'}
          </div>
          <div className="oq-stat-lbl">contest rating · {p.contest_attend} rounds</div>
        </div>
        <div>
          <div className="oq-stat-num">{p.problems_solved}</div>
          <div className="oq-stat-lbl">
            <span style={{ color: 'var(--ok)' }}>{p.easy_solved}E</span>
            {' · '}
            <span style={{ color: 'var(--warn)' }}>{p.medium_solved}M</span>
            {' · '}
            <span style={{ color: 'var(--err)' }}>{p.hard_solved}H</span>
          </div>
        </div>
      </div>
      <div className="oq-platcard-foot">
        <div style={{ height: 56 }} />
        <div className="oq-rank-badge">Top {p.top_percentage ? `${p.top_percentage.toFixed(0)}%` : '?'}</div>
      </div>
    </div>
  )
}

// ── Topic Bars ────────────────────────────────────────────────────────────────
function TopicBars({ tagFreq }: { tagFreq: Record<string, number> }) {
  const entries = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxCount = entries[0]?.[1] ?? 1
  return (
    <div className="oq-topics">
      {entries.map(([topic, count]) => (
        <div key={topic} className="oq-topic-row">
          <div className="oq-topic-name">{topic}</div>
          <div className="oq-topic-track">
            <div className="oq-topic-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
          </div>
          <div className="oq-topic-num">{count}</div>
        </div>
      ))}
    </div>
  )
}

// ── LC Skill Bars ─────────────────────────────────────────────────────────────
function SkillBars({ skills }: { skills: Array<{ tagName: string; problemsSolved: number }> }) {
  const top = [...skills].sort((a, b) => b.problemsSolved - a.problemsSolved).slice(0, 8)
  const maxVal = top[0]?.problemsSolved ?? 1
  return (
    <div className="oq-topics">
      {top.map(s => (
        <div key={s.tagName} className="oq-topic-row">
          <div className="oq-topic-name">{s.tagName}</div>
          <div className="oq-topic-track">
            <div className="oq-topic-fill" style={{ width: `${(s.problemsSolved / maxVal) * 100}%`, background: 'linear-gradient(90deg, var(--accent-2), var(--accent))' }} />
          </div>
          <div className="oq-topic-num">{s.problemsSolved}</div>
        </div>
      ))}
    </div>
  )
}

// ── Heatmap (7 days × 24 hours) ──────────────────────────────────────────────
function Heatmap({ calendar }: { calendar: Record<string, number> }) {
  const now = new Date()
  // 7 rows = last 7 days (row 0 = 6 days ago, row 6 = today)
  // 24 cols = hours of the day (from LC calendar which is day-level, we fill all hours equally)
  const grid = Array.from({ length: 7 }, (_, dayOffset) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - dayOffset))
    const dayStart = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000)
    let total = 0
    for (const [ts, count] of Object.entries(calendar)) {
      if (Math.abs(parseInt(ts) - dayStart) < 86400) total += count
    }
    const intensity = total === 0 ? 0 : total === 1 ? 1 : total <= 3 ? 2 : total <= 6 ? 3 : 4
    return Array<number>(24).fill(intensity)
  })

  return (
    <div>
      <div className="oq-heat">
        {grid.map((row, ri) => (
          <div className="oq-heat-row" key={ri}>
            {row.map((v, ci) => (
              <div key={ci} className={`oq-heat-cell heat-${v}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="oq-heat-legend" style={{ marginTop: 6 }}>
        <span className="oq-dim">less</span>
        {[0, 1, 2, 3, 4].map(i => <div key={i} className={`oq-heat-cell heat-${i}`} />)}
        <span className="oq-dim">more</span>
      </div>
    </div>
  )
}

// ── Streak card ───────────────────────────────────────────────────────────────
function StreakCard({ solved }: { solved: number }) {
  return (
    <div className="oq-streak">
      <div className="oq-streak-num">{solved}</div>
      <div className="oq-streak-lbl">solved today<br /><span className="oq-dim">keep it up</span></div>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skel({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return <div className="oq-skel" style={{ width: w, height: h }} />
}

function DashboardSkeleton() {
  return (
    <>
      <section className="oq-grid-2">
        {[0, 1].map(i => (
          <div key={i} className="oq-platcard" style={{ gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Skel w={80} h={12} />
              <Skel w={60} h={12} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Skel w="60%" h={28} /><Skel w={90} h={10} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Skel w="60%" h={28} /><Skel w={90} h={10} /></div>
            </div>
            <Skel w="100%" h={56} />
          </div>
        ))}
      </section>
      <section className="oq-grid-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="oq-panel" style={{ gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Skel w={100} h={12} /><Skel w={50} h={12} /></div>
            {Array.from({ length: 5 }, (_, j) => (
              <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Skel w="55%" h={10} /><Skel w="30%" h={8} /><Skel w="10%" h={10} />
              </div>
            ))}
          </div>
        ))}
      </section>
    </>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="oq-panel" style={{ padding: '3rem 2rem', textAlign: 'center', gap: 16, alignItems: 'center' }}>
      <div style={{ fontSize: 32, color: 'var(--accent)', filter: 'drop-shadow(0 0 12px var(--accent-soft))', marginBottom: 4 }}>◇</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>No platforms connected</div>
      <div style={{ color: 'var(--text-dim)', maxWidth: '38ch', fontSize: 13 }}>
        Link your Codeforces or LeetCode account to see your stats, topic mastery, and AI recommendations.
      </div>
      <button className="oq-btn-primary oq-btn-lg" style={{ marginTop: 8 }} onClick={onConnect}>
        Connect platforms →
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard()
      .then(d => {
        setData(d)
        useStatsStore.getState().setCfRating(d?.codeforces?.rating ?? null)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const noPlatforms = !data?.codeforces && !data?.leetcode
  const cfRating = data?.codeforces?.rating ?? 0
  const lcSolved = data?.leetcode?.problems_solved ?? 0
  const totalSolved = (data?.codeforces?.problems_solved ?? 0) + lcSolved

  const hasTags = data?.codeforces && Object.keys(data.codeforces.tag_freq ?? {}).length > 0
  const hasSkills = data?.leetcode && (data.leetcode.skills ?? []).length > 0
  const hasCalendar = data?.leetcode && Object.keys(data.leetcode.calendar ?? {}).length > 0

  return (
    <div className="oq-page">
      {/* Page header */}
      <header className="oq-page-head">
        <div>
          <div className="oq-page-eyebrow oq-mono">overview · {loading ? 'loading…' : 'synced'}</div>
          <h1 className="oq-page-title">Welcome back, {user?.username}.</h1>
          {!loading && data?.codeforces && (
            <p className="oq-page-sub">
              Codeforces rating{' '}
              <span className="oq-mono" style={{ color: 'var(--accent)' }}>{cfRating}</span>
              {' · '}
              LeetCode solved{' '}
              <span className="oq-mono" style={{ color: 'var(--text-dim)' }}>{lcSolved}</span>
              <span className="oq-dim"> — keep going.</span>
            </p>
          )}
          {!loading && noPlatforms && (
            <p className="oq-page-sub" style={{ color: 'var(--text-faint)' }}>
              Connect a platform to unlock your personalized training dashboard.
            </p>
          )}
        </div>
        {!loading && !noPlatforms && (
          <StreakCard solved={totalSolved} />
        )}
      </header>

      {loading && <DashboardSkeleton />}

      {!loading && noPlatforms && (
        <EmptyState onConnect={() => navigate('/profile')} />
      )}

      {!loading && !noPlatforms && (
        <>
          {/* Platform cards row */}
          <section className="oq-grid-2">
            {data?.codeforces && <CFCard p={data.codeforces} />}
            {data?.leetcode && <LCCard p={data.leetcode} />}
            {!data?.codeforces && (
              <div className="oq-platcard" style={{ alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 160 }}>
                <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>codeforces not connected</div>
                <button className="oq-btn-ghost" onClick={() => navigate('/profile')}>Connect →</button>
              </div>
            )}
            {!data?.leetcode && (
              <div className="oq-platcard" style={{ alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 160 }}>
                <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>leetcode not connected</div>
                <button className="oq-btn-ghost" onClick={() => navigate('/profile')}>Connect →</button>
              </div>
            )}
          </section>

          {/* Bottom analytics row */}
          <section className="oq-grid-3">
            {/* Topic mastery */}
            <div className="oq-panel">
              <div className="oq-panel-head">
                <h3>Topic mastery</h3>
                <span className="oq-dim">
                  {hasTags ? 'codeforces' : hasSkills ? 'leetcode' : '—'}
                </span>
              </div>
              {hasTags && <TopicBars tagFreq={data!.codeforces!.tag_freq} />}
              {!hasTags && hasSkills && <SkillBars skills={data!.leetcode!.skills} />}
              {!hasTags && !hasSkills && (
                <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  no topic data yet — sync your accounts
                </div>
              )}
            </div>

            {/* Activity heatmap */}
            <div className="oq-panel">
              <div className="oq-panel-head">
                <h3>Activity</h3>
                <span className="oq-dim">7 days × 24h</span>
              </div>
              {hasCalendar
                ? <Heatmap calendar={data!.leetcode!.calendar} />
                : <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>no calendar data yet</div>
              }
            </div>

            {/* Recommended */}
            <div className="oq-panel">
              <div className="oq-panel-head">
                <h3>Recommended next</h3>
                <span className="oq-dim">ai-tuned</span>
              </div>
              {data?.recommendations && data.recommendations.length > 0 ? (
                <ul className="oq-reco">
                  {data.recommendations.slice(0, 5).map((r, i) => (
                    <li key={i}>
                      <div>
                        <div className="oq-reco-title">{r.title}</div>
                        <div className="oq-reco-why">{r.reason}</div>
                      </div>
                      <div className="oq-reco-rating">
                        {r.rating ?? r.difficulty ?? '—'}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                  <div style={{ marginBottom: 8, fontFamily: 'var(--font-mono)' }}>generate a roadmap to get recommendations</div>
                  <button className="oq-btn-ghost" onClick={() => navigate('/roadmap')} style={{ fontSize: 11 }}>
                    Go to Roadmap →
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* LC skill breakdown if both platforms */}
          {hasTags && hasSkills && (
            <section style={{ marginTop: 16 }}>
              <div className="oq-panel">
                <div className="oq-panel-head">
                  <h3>LeetCode skill breakdown</h3>
                  <span className="oq-dim">by topic</span>
                </div>
                <SkillBars skills={data!.leetcode!.skills} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
