import { useEffect, useState } from 'react'
import { generateRoadmap, getRoadmap } from '../api/roadmap'
import { getGoals, upsertGoals } from '../api/profile'
import { useRoadmapStore } from '../store/roadmapStore'
import { useStatsStore } from '../store/statsStore'
import type { UnifiedRoadmap, RoadmapProblem, RoadmapTopic, RoadmapWeek, RoadmapPattern, UserGoal } from '../types'

type Mode = 'weekly' | 'topic' | 'interview'

function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skel({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return <div className="oq-skel" style={{ width: w, height: h }} />
}

function RoadmapSkeleton() {
  return (
    <div className="oq-rm-weeks">
      {[0, 1, 2].map(i => (
        <div key={i} className="oq-panel" style={{ padding: '16px 20px', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Skel w={32} h={18} /><Skel w="40%" h={14} /><Skel w="20%" h={8} />
          </div>
          {i === 0 && Array.from({ length: 3 }, (_, j) => (
            <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
              <Skel w={36} h={18} /><Skel w="50%" h={12} /><Skel w="15%" h={12} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function ratingPillClass(rating: number | null, difficulty?: string | null) {
  if (difficulty) {
    const d = difficulty.toLowerCase()
    if (d === 'easy' || d === 'medium' || d === 'hard') return `oq-rating-pill small ${d}`
  }
  if (!rating) return 'oq-rating-pill small'
  return `oq-rating-pill small r-${Math.min(35, Math.floor(rating / 100))}`
}

// ── Problem row ───────────────────────────────────────────────────────────────
function ProblemRow({ p }: { p: RoadmapProblem }) {
  return (
    <li className="oq-rm-prob">
      <div className="oq-rm-prob-main">
        <div className={ratingPillClass(p.rating, p.difficulty)}>
          {p.rating ?? p.difficulty ?? '—'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="oq-rm-prob-title">{p.title}</div>
          <div className="oq-rm-prob-meta">
            {p.platform.toLowerCase()}
            {p.tags.length > 0 && ` · ${p.tags.slice(0, 3).join(' · ')}`}
          </div>
        </div>
      </div>
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="oq-btn-ghost">
        Open ↗
      </a>
    </li>
  )
}

// ── Summary section ───────────────────────────────────────────────────────────
function SummarySection({ data }: { data: UnifiedRoadmap['summary'] }) {
  return (
    <section className="oq-panel oq-rm-summary" style={{ marginBottom: 20, padding: '18px 22px', gap: 14 }}>
      {/* current_level callout */}
      {data.current_level && (
        <div style={{
          fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5,
          padding: '8px 12px', background: 'var(--bg-sunken)',
          borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent)',
        }}>
          {data.current_level}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="oq-mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
              {data.total_weeks}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>weeks</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="oq-mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
              {data.estimated_hours}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>hours est.</div>
          </div>
          {/* platform_balance */}
          {data.platform_balance && (
            <div style={{ textAlign: 'center' }}>
              <div className="oq-mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent-2)' }}>
                {data.platform_balance.leetcode_percentage}%
                <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> / </span>
                {data.platform_balance.codeforces_percentage}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>LC / CF</div>
            </div>
          )}
        </div>

        {/* Focus areas */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="oq-section-label" style={{ marginBottom: 6 }}>focus areas</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.focus_areas.map((area, i) => (
              <span key={i} className="oq-mono" style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-soft)', color: 'var(--accent-fg)', border: '1px solid var(--accent-soft)',
              }}>
                {area}
              </span>
            ))}
          </div>
          {/* platform_balance note */}
          {data.platform_balance?.note && (
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8, fontStyle: 'italic' }}>
              {data.platform_balance.note}
            </div>
          )}
        </div>

        {/* Milestones — support both old "description" and new "goal" field */}
        {data.milestones.length > 0 && (
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="oq-section-label" style={{ marginBottom: 6 }}>milestones</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.milestones.map((m, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, color: 'var(--text-dim)' }}>
                  <span className="oq-mono" style={{ color: 'var(--accent)', flexShrink: 0, fontSize: 11 }}>W{m.week}</span>
                  <span>{m.goal ?? m.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Weekly plan ───────────────────────────────────────────────────────────────
function WeekItem({ w, defaultOpen }: { w: RoadmapWeek; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cx('oq-rm-week', defaultOpen && 'is-current', open && 'is-open')}>
      <button className="oq-rm-week-head" onClick={() => setOpen(v => !v)}>
        <div className="oq-rm-week-idx oq-mono">W{String(w.week).padStart(2, '0')}</div>
        <div>
          <div className="oq-rm-week-theme">{w.theme}</div>
          <div className="oq-rm-week-meta">
            {w.focus_topics.slice(0, 3).join(' · ')}
            {w.difficulty_target && (
              <span className="oq-mono" style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-faint)' }}>
                {w.difficulty_target}
              </span>
            )}
          </div>
        </div>
        <div className="oq-rm-week-track">
          <div className="oq-rm-week-fill" style={{ width: defaultOpen ? '40%' : '0%' }} />
        </div>
        <span className="oq-rm-week-toggle oq-mono">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul className="oq-rm-prob-list">
          {w.problems?.length
            ? w.problems.map((p, j) => <ProblemRow key={j} p={p} />)
            : <li className="oq-rm-week-empty">problem set will be generated when you reach this week</li>
          }
        </ul>
      )}
    </div>
  )
}

function WeeklyView({ weeks }: { weeks: RoadmapWeek[] }) {
  return (
    <div className="oq-rm-weeks">
      {weeks.map((w, i) => <WeekItem key={i} w={w} defaultOpen={i === 0} />)}
    </div>
  )
}

// ── Strength bar colour ───────────────────────────────────────────────────────
function strengthColor(score: number) {
  if (score < 0.33) return 'var(--err)'
  if (score < 0.66) return 'var(--warn)'
  return 'var(--ok)'
}

// ── By topic ──────────────────────────────────────────────────────────────────
function TopicView({ topics }: { topics: RoadmapTopic[] }) {
  return (
    <div className="oq-rm-topics">
      {topics.map((topic, i) => (
        <div key={i} className="oq-panel oq-rm-topic">
          <div className="oq-rm-topic-head">
            <div style={{ flex: 1 }}>
              <h4 className="oq-rm-topic-name">{topic.name}</h4>
              <div className="oq-rm-topic-why">{topic.why}</div>
              {topic.sub_patterns_covered && topic.sub_patterns_covered.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                  {topic.sub_patterns_covered.map((sp, si) => (
                    <span key={si} className="oq-mono" style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elev)', color: 'var(--text-faint)',
                      border: '1px solid var(--line)',
                    }}>
                      {sp}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="oq-rm-topic-strength">
              <div className="oq-topic-track">
                <div className="oq-topic-fill" style={{
                  width: `${topic.strength_score * 100}%`,
                  background: strengthColor(topic.strength_score),
                }} />
              </div>
              <span className="oq-mono">{Math.round(topic.strength_score * 100)}%</span>
            </div>
          </div>
          <div className="oq-section-label">recommended unsolved</div>
          <ul className="oq-rm-prob-list">
            {topic.problems.map((p, j) => <ProblemRow key={j} p={p} />)}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ── Interview mode ────────────────────────────────────────────────────────────
function strengthBadge(s?: string) {
  if (!s) return null
  const color = s === 'weak' ? 'var(--err)' : s === 'moderate' ? 'var(--warn)' : 'var(--ok)'
  return (
    <span className="oq-mono" style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 'var(--radius-sm)',
      background: color + '22', color, border: `1px solid ${color}55`,
    }}>
      {s}
    </span>
  )
}

function InterviewView({ data }: { data: UnifiedRoadmap['interview_mode'] }) {
  return (
    <div className="oq-rm-iv">
      <div className="oq-panel oq-rm-iv-head">
        <div>
          <div className="oq-page-eyebrow oq-mono">
            interview prep · {data.target_companies.join(' · ') || 'general'}
          </div>
          <h3 className="oq-rm-iv-title">
            {data.patterns.reduce((n, p) => n + p.problems.length, 0)} problems · {data.patterns.length} patterns
          </h3>
          {data.readiness_score != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                FAANG readiness
              </span>
              <div style={{ flex: 1, maxWidth: 160, height: 6, background: 'var(--bg-elev)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${data.readiness_score * 100}%`,
                  background: data.readiness_score < 0.33 ? 'var(--err)'
                    : data.readiness_score < 0.66 ? 'var(--warn)'
                    : 'var(--ok)',
                  borderRadius: 3,
                }} />
              </div>
              <span className="oq-mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {Math.round(data.readiness_score * 100)}%
              </span>
            </div>
          )}
          <p className="oq-rm-iv-sub">
            Patterns mixed across difficulty — recall, speed, and one new concept per session.
          </p>
        </div>
        <button className="oq-btn-primary oq-btn-lg">Start session</button>
      </div>
      {data.patterns.map((pattern: RoadmapPattern, i: number) => (
        <div key={i} className="oq-panel" style={{ gap: 14 }}>
          <div className="oq-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3>{pattern.name}</h3>
              {strengthBadge(pattern.user_strength)}
              {pattern.problems_solved !== undefined && (
                <span className="oq-mono oq-dim" style={{ fontSize: 11 }}>
                  {pattern.problems_solved} solved
                </span>
              )}
            </div>
            <span className="oq-mono oq-dim">{Math.round(pattern.frequency * 100)}% frequency</span>
          </div>
          <div className="oq-topic-track" style={{ height: 5 }}>
            <div className="oq-topic-fill" style={{ width: `${pattern.frequency * 100}%` }} />
          </div>
          <ul className="oq-rm-prob-list" style={{ padding: 0 }}>
            {pattern.problems.map((p, j) => <ProblemRow key={j} p={p} />)}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ── Goal editor modal ─────────────────────────────────────────────────────────
const GOAL_OPTS = [
  { id: 'rating',        icon: '↑', label: 'Rating target',   sub: 'Push your Codeforces / LeetCode rating to a number.' },
  { id: 'interview',     icon: '▢', label: 'Interview prep',  sub: 'FAANG-flavoured drills: arrays, DP, graphs.' },
  { id: 'topic_mastery', icon: '▤', label: 'Topic mastery',   sub: 'Reach comfortable on a specific topic.' },
]

function GoalEditor({ goal, onClose, onSave }: {
  goal: UserGoal | null
  onClose: () => void
  onSave: (g: Partial<UserGoal>) => void
}) {
  const [kind, setKind] = useState<UserGoal['goal_type']>(goal?.goal_type ?? 'rating')
  const [target, setTarget] = useState(goal?.target_rating?.toString() ?? '')
  const [date, setDate] = useState(goal?.target_date?.split('T')[0] ?? '')
  const [weeklyHours, setWeeklyHours] = useState(goal?.weekly_hours?.toString() ?? '15')
  const [notifyDaily, setNotifyDaily] = useState(goal?.notify_daily ?? false)
  const [notifyWeekly, setNotifyWeekly] = useState(goal?.notify_weekly ?? false)
  const [notifyProblems, setNotifyProblems] = useState(goal?.notify_problems ?? false)

  return (
    <div className="oq-modal-backdrop" onClick={onClose}>
      <div className="oq-modal" onClick={e => e.stopPropagation()}>
        <div className="oq-modal-head">
          <div>
            <div className="oq-page-eyebrow oq-mono">edit goal</div>
            <h3 className="oq-modal-title">What are you training for?</h3>
          </div>
          <button className="oq-icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="oq-goal-grid">
          {GOAL_OPTS.map(opt => (
            <button key={opt.id}
              className={cx('oq-goal-opt', kind === opt.id && 'is-active')}
              onClick={() => setKind(opt.id as UserGoal['goal_type'])}
            >
              <span className="oq-goal-opt-icon">{opt.icon}</span>
              <div>
                <div className="oq-goal-opt-label">{opt.label}</div>
                <div className="oq-goal-opt-sub">{opt.sub}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="oq-form-row">
          <label>
            <span className="oq-form-lbl">Target rating</span>
            <input className="oq-input" style={{ marginTop: 5 }} type="number" value={target}
              onChange={e => setTarget(e.target.value)} placeholder="e.g. 2000" />
          </label>
          <label>
            <span className="oq-form-lbl">Deadline</span>
            <input className="oq-input" style={{ marginTop: 5 }} type="date" value={date}
              onChange={e => setDate(e.target.value)} />
          </label>
        </div>
        <div className="oq-form-row">
          <label>
            <span className="oq-form-lbl">Weekly study hours</span>
            <input className="oq-input" style={{ marginTop: 5 }} type="number"
              min={1} max={168} value={weeklyHours}
              onChange={e => setWeeklyHours(e.target.value)}
              placeholder="e.g. 15" />
          </label>
        </div>
        <div className="oq-notify-block">
          <div className="oq-section-label">notify me when</div>
          <label className="oq-notify-row">
            <input type="checkbox" checked={notifyDaily} onChange={e => setNotifyDaily(e.target.checked)} />
            <div>
              <div className="oq-notify-title">Daily problem nudge</div>
              <div className="oq-mono oq-dim oq-notify-meta">morning streak reminder</div>
            </div>
          </label>
          <label className="oq-notify-row">
            <input type="checkbox" checked={notifyWeekly} onChange={e => setNotifyWeekly(e.target.checked)} />
            <div>
              <div className="oq-notify-title">Weekly digest</div>
              <div className="oq-mono oq-dim oq-notify-meta">Sunday progress vs goal</div>
            </div>
          </label>
          <label className="oq-notify-row">
            <input type="checkbox" checked={notifyProblems} onChange={e => setNotifyProblems(e.target.checked)} />
            <div>
              <div className="oq-notify-title">New recommendations</div>
              <div className="oq-mono oq-dim oq-notify-meta">when AI picks new problems for you</div>
            </div>
          </label>
        </div>
        <div className="oq-modal-foot">
          <button className="oq-btn-ghost oq-btn-lg" onClick={onClose}>Cancel</button>
          <button className="oq-btn-primary oq-btn-lg"
            onClick={() => onSave({
              goal_type: kind,
              target_rating: target ? parseInt(target) : null,
              target_date: date || null,
              weekly_hours: weeklyHours ? parseInt(weeklyHours) : 15,
              notify_daily: notifyDaily,
              notify_weekly: notifyWeekly,
              notify_problems: notifyProblems,
            })}>
            ✦ Save &amp; Regenerate
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Goal card ─────────────────────────────────────────────────────────────────
function GoalCard({ goal }: { goal: UserGoal }) {
  const { notify, setNotify, setEditing } = useRoadmapStore()
  const cfRating = useStatsStore(s => s.cfRating)
  const current = cfRating ?? 1100
  const start   = Math.min(current, 1100)
  const target  = goal.target_rating ?? 2000
  const pct     = Math.min(100, Math.max(0, ((current - start) / (target - start)) * 100))

  return (
    <section className="oq-panel oq-goal-card">
      <div className="oq-goal-card-l">
        <div className="oq-page-eyebrow oq-mono">current goal · {goal.goal_type.replace('_', ' ')}</div>
        <h2 className="oq-goal-title">Reach {target} rating</h2>
        <div className="oq-goal-progress">
          <div className="oq-goal-track">
            <div className="oq-goal-fill" style={{ width: `${pct}%` }} />
            <div className="oq-goal-fill-mark" style={{ left: `${pct}%` }}>
              <span className="oq-mono">{current}</span>
            </div>
          </div>
          <div className="oq-goal-bounds oq-mono oq-dim">
            <span>{start} · start</span>
            <span>{target} · {goal.target_date ? new Date(goal.target_date).toLocaleDateString() : 'no deadline'}</span>
          </div>
        </div>
        <div className="oq-goal-stats">
          <div><span>days left</span><strong>—</strong></div>
          <div><span>pace</span><strong>—/day</strong></div>
          <div><span>hrs/week</span><strong className="oq-ok">{goal.weekly_hours ?? 15}</strong></div>
          <div><span>target</span><strong className="oq-ok">{target}</strong></div>
        </div>
      </div>
      <div className="oq-goal-card-r">
        <button className="oq-btn-ghost" onClick={() => setEditing(true)}>Edit goal</button>
        <div className="oq-notify-block">
          <div className="oq-section-label">notify me when</div>
          {([
            { key: 'daily' as const,    label: 'Daily problem nudge', meta: 'morning streak reminder' },
            { key: 'weekly' as const,   label: 'Weekly digest',       meta: 'Sunday progress report' },
            { key: 'problems' as const, label: 'New recommendations', meta: 'when AI picks new problems' },
          ]).map(({ key, label, meta }) => (
            <label key={key} className="oq-notify-row">
              <input type="checkbox"
                checked={notify[key]}
                onChange={() => setNotify({ ...notify, [key]: !notify[key] })}
              />
              <div>
                <div className="oq-notify-title">{label}</div>
                <div className="oq-mono oq-dim oq-notify-meta">{meta}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Main Roadmap ──────────────────────────────────────────────────────────────
export default function Roadmap() {
  const store = useRoadmapStore()

  useEffect(() => {
    if (store.loaded) return
    async function load() {
      const [rm, g] = await Promise.allSettled([getRoadmap(), getGoals()])
      if (rm.status === 'fulfilled' && rm.value?.roadmap) {
        store.setRoadmap(rm.value.roadmap as unknown as UnifiedRoadmap, rm.value.mode as Mode)
      }
      if (g.status === 'fulfilled' && g.value) {
        store.setGoals(g.value)
        store.setNotify({
          daily:    g.value.notify_daily,
          weekly:   g.value.notify_weekly,
          problems: g.value.notify_problems,
        })
      }
      store.setLoaded(true)
    }
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    // Use getState() so updates reach the live store even if the
    // component unmounts mid-request (user navigated away and back).
    const s = () => useRoadmapStore.getState()
    s().setGenerating(true)
    s().setGenError('')
    try {
      const rm = await generateRoadmap()
      s().setRoadmap(rm as unknown as UnifiedRoadmap, 'weekly')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? ''
      if (msg.includes('quota') || msg.includes('rate'))
        s().setGenError('AI quota exceeded — update your API key and restart Docker.')
      else if (msg.includes('platform') || msg.includes('connect'))
        s().setGenError('No platform connected — go to Profile and connect Codeforces or LeetCode first.')
      else
        s().setGenError('Failed to generate - check the n8n roadmap workflow and webhook URL.')
    } finally {
      s().setGenerating(false)
    }
  }

  async function saveGoal(updates: Partial<UserGoal>) {
    try {
      const updated = await upsertGoals(updates)
      store.setGoals(updated)
      store.setEditing(false)
      store.setNotify({ daily: updated.notify_daily, weekly: updated.notify_weekly, problems: updated.notify_problems })
      await generate()
    } catch {
      store.setEditing(false)
    }
  }

  const tabs: { id: Mode; label: string }[] = [
    { id: 'weekly',    label: 'Weekly plan' },
    { id: 'topic',     label: 'By topic' },
    { id: 'interview', label: 'Interview mode' },
  ]

  // Detect unified format (has summary key) vs old single-mode format
  const unified = store.roadmap as unknown as UnifiedRoadmap | null
  const isUnified = unified != null && 'summary' in unified
  const isOldFormat = store.roadmap != null && !isUnified

  return (
    <div className="oq-page oq-rm">
      <header className="oq-page-head">
        <div>
          <div className="oq-page-eyebrow oq-mono">roadmap</div>
          <h1 className="oq-page-title">
            {store.goals?.target_rating ? `Path to ${store.goals.target_rating}` : 'Your Roadmap'}
          </h1>
          <p className="oq-page-sub">
            AI rebuilds this plan from your activity and goal.
            <span className="oq-dim">
              {' '}{store.roadmap ? 'Personalized across weekly, topic, and interview views.' : 'Generate to get started.'}
            </span>
          </p>
        </div>
        <button className="oq-btn-ghost oq-btn-lg" onClick={generate}
          disabled={store.generating} style={{ flexShrink: 0 }}>
          {store.generating
            ? <><span className="oq-cursor-block">▌</span> Generating…</>
            : '↻ Regenerate'}
        </button>
      </header>

      {store.goals && <GoalCard goal={store.goals} />}

      {/* Prominent generating banner — shown whenever AI is working */}
      {store.generating && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 22px', marginBottom: 16,
          background: 'var(--accent-soft)',
          border: '1px solid oklch(0.72 0.16 305 / 0.35)',
          borderRadius: 'var(--radius)',
        }}>
          <span style={{ fontSize: 20, color: 'var(--accent)', animation: 'spin 1.2s linear infinite' }}>◇</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent-fg)' }}>
              Generating your roadmap…
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              AI is analyzing your stats and building a personalized plan. This takes 15–60 seconds.
            </div>
          </div>
        </div>
      )}

      {store.loaded && !store.goals && (
        <div className="oq-panel" style={{ padding: '22px 26px', marginBottom: 24, gap: 10 }}>
          <div className="oq-page-eyebrow oq-mono">no goal set</div>
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>
            Set a goal to unlock a personalized roadmap.
          </p>
          <button className="oq-btn-primary" style={{ marginTop: 6, alignSelf: 'flex-start' }}
            onClick={() => store.setEditing(true)}>
            ↑ Set goal
          </button>
        </div>
      )}

      {store.genError && (
        <div className="oq-flash-err" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          ⚠ {store.genError}
          <button onClick={() => store.setGenError('')}
            style={{ marginLeft: 'auto', color: 'inherit', opacity: 0.7, fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Old format banner — prompt user to regenerate */}
      {store.loaded && isOldFormat && (
        <div className="oq-panel" style={{
          padding: '14px 20px', marginBottom: 16, gap: 10,
          borderColor: 'var(--warn)', display: 'flex', alignItems: 'center',
        }}>
          <span style={{ color: 'var(--warn)', fontSize: 13 }}>
            ↻ Your saved roadmap uses the old format. Regenerate to unlock all three views.
          </span>
          <button className="oq-btn-primary" style={{ marginLeft: 'auto', flexShrink: 0 }}
            onClick={generate} disabled={store.generating}>
            {store.generating ? 'Generating…' : 'Regenerate now'}
          </button>
        </div>
      )}

      {/* Summary strip — only for unified roadmaps */}
      {isUnified && unified.summary && (
        <SummarySection data={unified.summary} />
      )}

      <div className="oq-mode-tabs">
        {tabs.map(t => (
          <button key={t.id}
            className={cx('oq-mode-tab', store.mode === t.id && 'is-active')}
            onClick={() => store.setMode(t.id)}>
            {t.label}
          </button>
        ))}
        <div className="oq-mode-spacer" />
      </div>

      {!store.loaded && <RoadmapSkeleton />}

      {store.loaded && !store.roadmap && (
        <div className="oq-panel" style={{ padding: '4rem 2rem', textAlign: 'center', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 28, color: 'var(--accent)' }}>↗</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No roadmap yet</div>
          <div style={{ color: 'var(--text-dim)', maxWidth: '44ch', fontSize: 13 }}>
            Click <strong>↻ Regenerate</strong> to create your personalized plan.
          </div>
          <button className="oq-btn-primary oq-btn-lg" style={{ marginTop: 8 }}
            onClick={generate} disabled={store.generating}>
            {store.generating ? 'Generating…' : '✦ Generate my roadmap'}
          </button>
        </div>
      )}

      {/* Unified roadmap views */}
      {store.loaded && isUnified && store.mode === 'weekly' && unified.weekly_mode?.weeks && (
        <WeeklyView weeks={unified.weekly_mode.weeks} />
      )}
      {store.loaded && isUnified && store.mode === 'topic' && unified.topic_mode?.topics && (
        <TopicView topics={unified.topic_mode.topics} />
      )}
      {store.loaded && isUnified && store.mode === 'interview' && unified.interview_mode && (
        <InterviewView data={unified.interview_mode} />
      )}

      {store.editing && (
        <GoalEditor goal={store.goals} onClose={() => store.setEditing(false)} onSave={saveGoal} />
      )}
    </div>
  )
}
