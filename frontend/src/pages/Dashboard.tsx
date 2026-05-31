import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useStatsStore } from '../store/statsStore'
import {
  getDashboard,
  type CFDashboard, type LCDashboard, type DashboardData,
  type LCContestEntry, type CFRecentProblem, type LCRecentProblem,
} from '../api/dashboard'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'

// ── helpers ───────────────────────────────────────────────────────────────────
function ratingClass(rating: number | null | undefined) {
  if (!rating) return ''
  return `r-${Math.min(35, Math.floor(rating / 100))}`
}

function fmtDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── Custom recharts tooltip ───────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number; name?: string }>; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 11,
      fontFamily: 'var(--font-mono)',
    }}>
      {label && <div style={{ color: 'var(--text-faint)', marginBottom: 2 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: 'var(--accent)' }}>{p.value}</div>
      ))}
    </div>
  )
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

// ── CF Platform Card ──────────────────────────────────────────────────────────
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

// ── LC Platform Card ──────────────────────────────────────────────────────────
function LCCard({ p }: { p: LCDashboard }) {
  const topLangs = Object.entries(p.language_stats ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const total = (p.easy_solved ?? 0) + (p.medium_solved ?? 0) + (p.hard_solved ?? 0)
  return (
    <div className="oq-platcard">
      <div className="oq-platcard-head">
        <div className="oq-platcard-name">LeetCode</div>
        <div className="oq-platcard-handle">@{p.handle}</div>
      </div>
      <div className="oq-platcard-grid">
        <div>
          <div className="oq-stat-num" style={{ color: 'var(--accent-2)' }}>{p.problems_solved ?? 0}</div>
          <div className="oq-stat-lbl">problems solved</div>
        </div>
        <div>
          <div className="oq-stat-num" style={{ fontSize: 20 }}>
            {p.rating > 0 ? Math.round(p.rating) : '—'}
          </div>
          <div className="oq-stat-lbl">contest rating · {p.contest_attend ?? 0} rounds</div>
        </div>
      </div>
      {total > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {([
            { label: 'Easy',   count: p.easy_solved,  color: 'var(--ok)'   },
            { label: 'Medium', count: p.medium_solved, color: 'var(--warn)' },
            { label: 'Hard',   count: p.hard_solved,   color: 'var(--err)'  },
          ] as const).map(({ label, count, color }) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 28px', gap: 8, alignItems: 'center', fontSize: 11.5 }}>
              <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{label}</span>
              <div style={{ height: 5, background: 'var(--bg-elev)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(count / total) * 100}%`, background: color, borderRadius: 3 }} />
              </div>
              <span style={{ color, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{count}</span>
            </div>
          ))}
        </div>
      )}
      <div className="oq-platcard-foot" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {topLangs.map(([lang, count]) => (
            <span key={lang} style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              padding: '2px 7px', borderRadius: 999,
              background: 'var(--bg-elev)', border: '1px solid var(--line)', color: 'var(--text-dim)',
            }}>
              {lang} <span style={{ color: 'var(--accent-2)' }}>{count}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          {p.ranking > 0 && <div className="oq-rank-badge" style={{ fontSize: 10 }}>#{p.ranking.toLocaleString()}</div>}
          {p.top_percentage > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ok)' }}>
              Top {p.top_percentage.toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CF Topic Bars ─────────────────────────────────────────────────────────────
function CFTopicBars({ tagFreq }: { tagFreq: Record<string, number> }) {
  const entries = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 10)
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

// ── LC Topic Bars ─────────────────────────────────────────────────────────────
function LCTopicBars({ skills }: { skills: Array<{ tagName: string; problemsSolved: number }> }) {
  const top = [...skills].sort((a, b) => b.problemsSolved - a.problemsSolved).slice(0, 10)
  const maxVal = top[0]?.problemsSolved ?? 1
  return (
    <div className="oq-topics">
      {top.map(s => (
        <div key={s.tagName} className="oq-topic-row">
          <div className="oq-topic-name">{s.tagName}</div>
          <div className="oq-topic-track">
            <div className="oq-topic-fill" style={{
              width: `${(s.problemsSolved / maxVal) * 100}%`,
              background: 'linear-gradient(90deg, var(--accent-2), var(--accent))',
            }} />
          </div>
          <div className="oq-topic-num">{s.problemsSolved}</div>
        </div>
      ))}
    </div>
  )
}

// ── CF Rating Histogram ───────────────────────────────────────────────────────
function CFRatingHistogram({ buckets }: { buckets: Record<string, number> }) {
  const TIERS = [
    { label: '≤1000', keys: ['800','900','1000'], color: 'var(--ok)' },
    { label: '1100–1400', keys: ['1100','1200','1300','1400'], color: 'oklch(0.78 0.15 100)' },
    { label: '1500–1900', keys: ['1500','1600','1700','1800','1900'], color: 'var(--warn)' },
    { label: '2000+', keys: ['2000','2100','2200','2300','2400','2500','2600','2700','2800','2900','3000','3100','3200','3300','3400','3500'], color: 'var(--err)' },
  ]
  const data = TIERS.map(t => ({
    label: t.label,
    count: t.keys.reduce((sum, k) => sum + (buckets[k] ?? 0), 0),
    color: t.color,
  })).filter(d => d.count > 0)
  if (data.length === 0) return <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>no rated problems yet</div>
  const max = Math.max(...data.map(d => d.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map(({ label, count, color }) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 36px', gap: 8, alignItems: 'center', fontSize: 11 }}>
          <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{label}</span>
          <div style={{ height: 8, background: 'var(--bg-elev)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
          <span style={{ color, fontFamily: 'var(--font-mono)', textAlign: 'right', fontSize: 11 }}>{count}</span>
        </div>
      ))}
    </div>
  )
}

// ── CF Index Breakdown ────────────────────────────────────────────────────────
function CFIndexBreakdown({ indexFreq }: { indexFreq: Record<string, number> }) {
  const ORDER = ['A', 'B', 'C', 'D', 'E', 'F+']
  const data = ORDER.map(k => ({ label: k, count: indexFreq[k] ?? 0 })).filter(d => d.count > 0)
  if (data.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barSize={18}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--accent-soft)' }} />
        <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── CF Language Breakdown ─────────────────────────────────────────────────────
function CFLanguageBreakdown({ langFreq }: { langFreq: Record<string, number> }) {
  const top = Object.entries(langFreq).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const max = top[0]?.[1] ?? 1
  if (top.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {top.map(([lang, count]) => (
        <div key={lang} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 32px', gap: 8, alignItems: 'center', fontSize: 11 }}>
          <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lang.replace('GNU ', '').replace(' 17', '').replace(' 14', '')}
          </span>
          <div style={{ height: 5, background: 'var(--bg-elev)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: 'var(--accent-2)', borderRadius: 3 }} />
          </div>
          <span style={{ color: 'var(--accent-2)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{count}</span>
        </div>
      ))}
    </div>
  )
}

// ── CF Recent AC ──────────────────────────────────────────────────────────────
function CFRecentACList({ items }: { items: CFRecentProblem[] }) {
  if (!items?.length) return <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>no recent data</div>
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.slice(0, 8).map((p, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
          <a
            href={`https://codeforces.com/contest/${p.contestId}/problem/${p.index}`}
            target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text)', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
          >
            {p.name}
          </a>
          {p.rating && (
            <span className="oq-mono" style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>{p.rating}</span>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>{fmtDate(p.solved_at)}</span>
        </li>
      ))}
    </ul>
  )
}

// ── LC Skill Full Breakdown (tiers) ──────────────────────────────────────────
type SkillEntry = { tagName: string; problemsSolved: number }

function LCSkillBreakdown({ skills }: { skills: SkillEntry[] }) {
  if (!skills?.length) return <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>no skill data — sync your account</div>

  // LeetCode returns skills in tier order: fundamental first, advanced last.
  // The backend merges them in order: fundamental → intermediate → advanced.
  // We group by solved count ranges as a proxy for tier since tier info is merged.
  const sorted = [...skills].sort((a, b) => b.problemsSolved - a.problemsSolved)
  const maxVal = sorted[0]?.problemsSolved ?? 1

  // Split into buckets: strong (top 3), moderate (next 4), weak (rest with > 0)
  const strong    = sorted.filter(s => s.problemsSolved > 0).slice(0, 3)
  const moderate  = sorted.filter(s => s.problemsSolved > 0).slice(3, 8)
  const weak      = sorted.filter(s => s.problemsSolved > 0).slice(8)
  const untouched = sorted.filter(s => s.problemsSolved === 0)

  function SkillRow({ s, color }: { s: SkillEntry; color: string }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, alignItems: 'center', fontSize: 11 }}>
        <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.tagName}
        </span>
        <div style={{ height: 5, background: 'var(--bg-elev)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(s.problemsSolved / maxVal) * 100}%`, background: color, borderRadius: 3 }} />
        </div>
        <span style={{ color, fontFamily: 'var(--font-mono)', textAlign: 'right', fontSize: 11 }}>{s.problemsSolved}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {strong.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--ok)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            strong
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {strong.map(s => <SkillRow key={s.tagName} s={s} color="var(--ok)" />)}
          </div>
        </div>
      )}
      {moderate.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--warn)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            moderate
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {moderate.map(s => <SkillRow key={s.tagName} s={s} color="var(--warn)" />)}
          </div>
        </div>
      )}
      {weak.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--err)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            needs work
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {weak.map(s => <SkillRow key={s.tagName} s={s} color="var(--err)" />)}
          </div>
        </div>
      )}
      {untouched.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            not started · {untouched.length} topics
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {untouched.map(s => (
              <span key={s.tagName} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elev)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                {s.tagName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── LC Contest History Chart ──────────────────────────────────────────────────
function LCContestChart({ history }: { history: LCContestEntry[] }) {
  const attended = history.filter(h => h.attended).slice(-15)
  if (attended.length < 2) return <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>need 2+ contests</div>
  const data = attended.map(h => ({
    label: h.contest.title.replace('Weekly Contest ', 'W').replace('Biweekly Contest ', 'BW'),
    rating: Math.round(h.rating),
    rank: h.ranking,
  }))
  return (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
        <Tooltip content={<ChartTooltip />} />
        <Line type="monotone" dataKey="rating" stroke="var(--accent-2)" strokeWidth={1.8} dot={false} activeDot={{ r: 3, fill: 'var(--accent-2)' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── LC Recent AC ──────────────────────────────────────────────────────────────
function LCRecentACList({ items }: { items: LCRecentProblem[] }) {
  if (!items?.length) return <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>no recent data</div>
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.slice(0, 8).map((p, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
          <a
            href={`https://leetcode.com/problems/${p.titleSlug}/`}
            target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text)', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
          >
            {p.title}
          </a>
          <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{p.lang}</span>
          <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>{fmtDate(p.solved_at)}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Activity Calendar (GitHub-style, 24 weeks) ────────────────────────────────
function ActivityCalendar({ calendar, streak }: { calendar: Record<string, number>; streak?: number }) {
  const WEEKS = 24
  const dayMap = new Map<string, number>()
  for (const [ts, count] of Object.entries(calendar)) {
    const d = new Date(parseInt(ts) * 1000)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    dayMap.set(key, (dayMap.get(key) ?? 0) + count)
  }
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - WEEKS * 7 + 1)
  startDate.setDate(startDate.getDate() - startDate.getDay())
  const nowTs = now.getTime()
  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (__, d) => {
      const date = new Date(startDate)
      date.setDate(date.getDate() + w * 7 + d)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return { key, date, count: dayMap.get(key) ?? 0, isFuture: date.getTime() > nowTs }
    })
  )
  const months: Array<{ label: string; col: number }> = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const m = week[1].date.getMonth()
    if (m !== lastMonth) { months.push({ label: week[1].date.toLocaleString('default', { month: 'short' }), col: wi }); lastMonth = m }
  })
  const cellColor = (count: number, isFuture: boolean) => {
    if (isFuture) return 'transparent'
    if (count === 0) return 'var(--bg-elev)'
    if (count === 1) return 'oklch(0.72 0.16 305 / 0.22)'
    if (count <= 3) return 'oklch(0.72 0.16 305 / 0.44)'
    if (count <= 6) return 'oklch(0.72 0.16 305 / 0.68)'
    return 'var(--accent)'
  }
  const CELL = 11, GAP = 2, LW = 24
  const total = Array.from(dayMap.values()).reduce((a, b) => a + b, 0)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div>
            <span className="oq-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{total}</span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 4 }}>submissions</span>
          </div>
          {(streak ?? 0) > 0 && (
            <div>
              <span className="oq-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ok)' }}>{streak}</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 4 }}>day streak</span>
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>last {WEEKS} weeks</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', marginLeft: LW, marginBottom: 4, position: 'relative', height: 14 }}>
            {months.map((m, i) => (
              <div key={i} style={{ position: 'absolute', left: m.col * (CELL + GAP), fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{m.label}</div>
            ))}
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginRight: 4, width: LW - 4 }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, i) => (
                <div key={i} style={{ height: CELL, fontSize: 9, color: [1,3,5].includes(i) ? 'var(--text-faint)' : 'transparent', fontFamily: 'var(--font-mono)', lineHeight: `${CELL}px`, userSelect: 'none' }}>{label}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginRight: GAP }}>
                {week.map((cell, di) => (
                  <div key={di} title={cell.isFuture ? '' : `${cell.date.toLocaleDateString()}: ${cell.count}`}
                    style={{ width: CELL, height: CELL, borderRadius: 2, background: cellColor(cell.count, cell.isFuture), flexShrink: 0 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>less</span>
        {[0,1,2,3,4].map(lv => (
          <div key={lv} style={{ width: CELL, height: CELL, borderRadius: 2, background: lv === 0 ? 'var(--bg-elev)' : lv === 1 ? 'oklch(0.72 0.16 305 / 0.22)' : lv === 2 ? 'oklch(0.72 0.16 305 / 0.44)' : lv === 3 ? 'oklch(0.72 0.16 305 / 0.68)' : 'var(--accent)' }} />
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>more</span>
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
        {[0,1].map(i => (
          <div key={i} className="oq-platcard" style={{ gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Skel w={80} h={12} /><Skel w={60} h={12} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Skel w="60%" h={28} /><Skel w={90} h={10} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Skel w="60%" h={28} /><Skel w={90} h={10} /></div>
            </div>
            <Skel w="100%" h={56} />
          </div>
        ))}
      </section>
      <section className="oq-grid-3">
        {[0,1,2].map(i => (
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
      <div style={{ fontSize: 32, color: 'var(--accent)', marginBottom: 4 }}>◇</div>
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

function NotConnectedTopics({ platform, onConnect }: { platform: string; onConnect: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{platform} not connected</div>
      <button className="oq-btn-ghost" style={{ fontSize: 11 }} onClick={onConnect}>Connect →</button>
    </div>
  )
}

// ── Panel subheader ───────────────────────────────────────────────────────────
function SubHead({ label }: { label: string }) {
  return <div className="oq-section-label" style={{ marginTop: 12, marginBottom: 6 }}>{label}</div>
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
  const cfRating    = data?.codeforces?.rating ?? 0
  const lcSolved    = data?.leetcode?.problems_solved ?? 0
  const totalSolved = (data?.codeforces?.problems_solved ?? 0) + lcSolved

  const hasCFTags    = data?.codeforces && Object.keys(data.codeforces.tag_freq ?? {}).length > 0
  const hasLCSkills  = data?.leetcode && (data.leetcode.skills ?? []).length > 0
  const hasCalendar  = data?.leetcode && Object.keys(data.leetcode.calendar ?? {}).length > 0
  const hasCFBuckets = data?.codeforces && Object.keys(data.codeforces.rating_buckets ?? {}).length > 0
  const hasCFIndex   = data?.codeforces && Object.keys(data.codeforces.index_freq ?? {}).length > 0
  const hasCFLang    = data?.codeforces && Object.keys(data.codeforces.lang_freq ?? {}).length > 0
  const hasLCContest = data?.leetcode && (data.leetcode.contest_history ?? []).filter(h => h.attended).length >= 2

  return (
    <div className="oq-page">
      {/* Header */}
      <header className="oq-page-head">
        <div>
          <div className="oq-page-eyebrow oq-mono">overview · {loading ? 'loading…' : 'synced'}</div>
          <h1 className="oq-page-title">Welcome back, {user?.username}.</h1>
          {!loading && (data?.codeforces || data?.leetcode) && (
            <p className="oq-page-sub">
              {data?.codeforces && <>Codeforces <span className="oq-mono" style={{ color: 'var(--accent)' }}>{cfRating}</span>{' · '}</>}
              {data?.leetcode && <>LeetCode solved <span className="oq-mono" style={{ color: 'var(--text-dim)' }}>{lcSolved}</span></>}
              <span className="oq-dim"> — keep going.</span>
            </p>
          )}
          {!loading && noPlatforms && (
            <p className="oq-page-sub" style={{ color: 'var(--text-faint)' }}>
              Connect a platform to unlock your personalized training dashboard.
            </p>
          )}
        </div>
        {!loading && !noPlatforms && <StreakCard solved={totalSolved} />}
      </header>

      {loading && <DashboardSkeleton />}
      {!loading && noPlatforms && <EmptyState onConnect={() => navigate('/profile')} />}

      {!loading && !noPlatforms && (
        <>
          {/* ── Row 1: Platform cards ── */}
          <section className="oq-grid-2">
            {data?.codeforces ? <CFCard p={data.codeforces} /> : (
              <div className="oq-platcard" style={{ alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 160 }}>
                <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>codeforces not connected</div>
                <button className="oq-btn-ghost" onClick={() => navigate('/profile')}>Connect →</button>
              </div>
            )}
            {data?.leetcode ? <LCCard p={data.leetcode} /> : (
              <div className="oq-platcard" style={{ alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 160 }}>
                <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>leetcode not connected</div>
                <button className="oq-btn-ghost" onClick={() => navigate('/profile')}>Connect →</button>
              </div>
            )}
          </section>

          {/* ── Row 2: CF topics | LC topics | Recommended ── */}
          <section className="oq-grid-3">
            <div className="oq-panel">
              <div className="oq-panel-head">
                <h3>Codeforces topics</h3>
                <span className="oq-dim oq-mono" style={{ fontSize: 11 }}>
                  {data?.codeforces ? `${Object.values(data.codeforces.tag_freq ?? {}).reduce((a, b) => a + b, 0)} solved` : '—'}
                </span>
              </div>
              {hasCFTags
                ? <CFTopicBars tagFreq={data!.codeforces!.tag_freq} />
                : <NotConnectedTopics platform="Codeforces" onConnect={() => navigate('/profile')} />}
            </div>

            <div className="oq-panel">
              <div className="oq-panel-head">
                <h3>LeetCode topics</h3>
                <span className="oq-dim oq-mono" style={{ fontSize: 11 }}>
                  {data?.leetcode ? `${data.leetcode.problems_solved ?? 0} solved` : '—'}
                </span>
              </div>
              {hasLCSkills
                ? <LCTopicBars skills={data!.leetcode!.skills} />
                : <NotConnectedTopics platform="LeetCode" onConnect={() => navigate('/profile')} />}
            </div>

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
                      <div className="oq-reco-rating">{r.rating ?? r.difficulty ?? '—'}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                  <div style={{ marginBottom: 8, fontFamily: 'var(--font-mono)' }}>generate a roadmap to get recommendations</div>
                  <button className="oq-btn-ghost" onClick={() => navigate('/roadmap')} style={{ fontSize: 11 }}>Go to Roadmap →</button>
                </div>
              )}
            </div>
          </section>

          {/* ── Row 3: CF deep stats | LC deep stats ── */}
          {(data?.codeforces || data?.leetcode) && (
            <section className="oq-grid-2" style={{ marginTop: 16 }}>

              {/* CF deep stats */}
              {data?.codeforces && (
                <div className="oq-panel">
                  <div className="oq-panel-head">
                    <h3>Codeforces analysis</h3>
                    <span className="oq-dim oq-mono" style={{ fontSize: 11 }}>@{data.codeforces.handle}</span>
                  </div>

                  {hasCFBuckets && (
                    <>
                      <SubHead label="difficulty breakdown" />
                      <CFRatingHistogram buckets={data.codeforces.rating_buckets} />
                    </>
                  )}

                  {hasCFIndex && (
                    <>
                      <SubHead label="problem index (how deep into rounds)" />
                      <CFIndexBreakdown indexFreq={data.codeforces.index_freq} />
                    </>
                  )}

                  {hasCFLang && (
                    <>
                      <SubHead label="language breakdown" />
                      <CFLanguageBreakdown langFreq={data.codeforces.lang_freq} />
                    </>
                  )}

                  {(data.codeforces.recent_ac ?? []).length > 0 && (
                    <>
                      <SubHead label="recently solved" />
                      <CFRecentACList items={data.codeforces.recent_ac} />
                    </>
                  )}
                </div>
              )}

              {/* LC deep stats */}
              {data?.leetcode && (
                <div className="oq-panel">
                  <div className="oq-panel-head">
                    <h3>LeetCode analysis</h3>
                    <span className="oq-dim oq-mono" style={{ fontSize: 11 }}>@{data.leetcode.handle}</span>
                  </div>

                  {/* Skill topic breakdown — mirrors what LeetCode profile shows */}
                  {(data.leetcode.skills ?? []).length > 0 && (
                    <>
                      <SubHead label="topic breakdown" />
                      <LCSkillBreakdown skills={data.leetcode.skills} />
                    </>
                  )}

                  {hasLCContest && (
                    <>
                      <SubHead label="contest rating history" />
                      <LCContestChart history={data.leetcode.contest_history} />
                    </>
                  )}

                  {(data.leetcode.recent_ac ?? []).length > 0 && (
                    <>
                      <SubHead label="recently solved" />
                      <LCRecentACList items={data.leetcode.recent_ac} />
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── Row 4: Activity calendar ── */}
          {data?.leetcode && (
            <section style={{ marginTop: 16 }}>
              <div className="oq-panel">
                <div className="oq-panel-head">
                  <h3>Activity calendar</h3>
                  <span className="oq-dim">LeetCode · 24 weeks</span>
                </div>
                {hasCalendar
                  ? <ActivityCalendar calendar={data.leetcode.calendar} streak={data.leetcode.streak} />
                  : <div style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>no calendar data yet — sync your LeetCode account</div>
                }
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
