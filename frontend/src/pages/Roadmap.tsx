import { useEffect, useState } from 'react'
import { generateRoadmap, getRoadmap } from '../api/roadmap'
import { getGoals, upsertGoals } from '../api/profile'
import { useRoadmapStore } from '../store/roadmapStore'
import { useStatsStore } from '../store/statsStore'
import type { WeeklyRoadmap, TopicRoadmap, InterviewRoadmap, RoadmapProblem, UserGoal } from '../types'

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

// ── Weekly plan ───────────────────────────────────────────────────────────────

function WeekItem({ w, defaultOpen }: { w: WeeklyRoadmap['weeks'][0]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cx('oq-rm-week', defaultOpen && 'is-current', open && 'is-open')}>
      <button className="oq-rm-week-head" onClick={() => setOpen(v => !v)}>
        <div className="oq-rm-week-idx oq-mono">W{String(w.week).padStart(2, '0')}</div>
        <div>
          <div className="oq-rm-week-theme">{w.theme}</div>
          <div className="oq-rm-week-meta">{w.focus_topics.slice(0, 3).join(' · ')}</div>
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

function WeeklyView({ data }: { data: WeeklyRoadmap }) {
  return (
    <div className="oq-rm-weeks">
      {data.weeks.map((w, i) => <WeekItem key={i} w={w} defaultOpen={i === 0} />)}
    </div>
  )
}

// ── By topic ──────────────────────────────────────────────────────────────────

function TopicView({ data }: { data: TopicRoadmap }) {
  return (
    <div className="oq-rm-topics">
      {data.topics.map((topic, i) => (
        <div key={i} className="oq-panel oq-rm-topic">
          <div className="oq-rm-topic-head">
            <div>
              <h4 className="oq-rm-topic-name">{topic.name}</h4>
              <div className="oq-rm-topic-why">{topic.why}</div>
            </div>
            <div className="oq-rm-topic-strength">
              <div className="oq-topic-track">
                <div className="oq-topic-fill" style={{ width: `${topic.strength_score * 100}%` }} />
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

function InterviewView({ data }: { data: InterviewRoadmap }) {
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
          <p className="oq-rm-iv-sub">
            Patterns mixed across difficulty — recall, speed, and one new concept per session.
          </p>
        </div>
        <button className="oq-btn-primary oq-btn-lg">Start session</button>
      </div>
      {data.patterns.map((pattern, i) => (
        <div key={i} className="oq-panel" style={{ gap: 14 }}>
          <div className="oq-panel-head">
            <h3>{pattern.name}</h3>
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
          <div><span>target</span><strong className="oq-ok">{target}</strong></div>
          <div><span>status</span><strong className="oq-ok">on track</strong></div>
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

  // Load once — skip on revisit because store persists in memory
  useEffect(() => {
    if (store.loaded) return
    async function load() {
      const [rm, g] = await Promise.allSettled([getRoadmap(), getGoals()])
      if (rm.status === 'fulfilled' && rm.value?.roadmap) {
        store.setRoadmap(rm.value.roadmap, rm.value.mode as Mode)
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
    store.setGenerating(true)
    store.setGenError('')
    try {
      const rm = await generateRoadmap(store.mode)
      store.setRoadmap(rm, store.mode)
    } catch (e: unknown) {
      const msg = (e as any)?.response?.data?.error ?? ''
      if (msg.includes('quota') || msg.includes('rate'))
        store.setGenError('AI quota exceeded — update your GEMINI_API_KEY and restart Docker.')
      else if (msg.includes('parse') || msg.includes('AI'))
        store.setGenError('AI response error — check GEMINI_API_KEY in .env')
      else
        store.setGenError('Failed to generate — connect a platform account first, then try again.')
    } finally {
      store.setGenerating(false)
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

  const generatedAt = store.roadmap
    ? new Date((store.roadmap as any).generated_at).toLocaleDateString()
    : null

  return (
    <div className="oq-page oq-rm">
      <header className="oq-page-head">
        <div>
          <div className="oq-page-eyebrow oq-mono">
            roadmap{generatedAt ? ` · generated ${generatedAt}` : ''}
          </div>
          <h1 className="oq-page-title">
            {store.goals?.target_rating ? `Path to ${store.goals.target_rating}` : 'Your Roadmap'}
          </h1>
          <p className="oq-page-sub">
            AI rebuilds this plan from your activity and goal.
            <span className="oq-dim">
              {' '}{store.roadmap ? 'Personalized — one week at a time.' : 'Generate to get started.'}
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

      <div className="oq-mode-tabs">
        {tabs.map(t => (
          <button key={t.id}
            className={cx('oq-mode-tab', store.mode === t.id && 'is-active')}
            onClick={() => store.setMode(t.id)}>
            {t.label}
          </button>
        ))}
        <div className="oq-mode-spacer" />
        <span className="oq-mono oq-dim" style={{ fontSize: 11, padding: '0 12px' }}>gemini-2.0-flash</span>
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

      {store.loaded && store.roadmap && store.mode === 'weekly' && store.roadmap.mode === 'weekly' && (
        <WeeklyView data={store.roadmap as WeeklyRoadmap} />
      )}
      {store.loaded && store.roadmap && store.mode === 'topic' && store.roadmap.mode === 'topic' && (
        <TopicView data={store.roadmap as TopicRoadmap} />
      )}
      {store.loaded && store.roadmap && store.mode === 'interview' && store.roadmap.mode === 'interview' && (
        <InterviewView data={store.roadmap as InterviewRoadmap} />
      )}
      {store.loaded && store.roadmap && store.roadmap.mode !== store.mode && (
        <div className="oq-panel" style={{ padding: '3rem 2rem', textAlign: 'center', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 24, color: 'var(--accent)' }}>↗</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No {store.mode} roadmap yet</div>
          <div style={{ color: 'var(--text-dim)', maxWidth: '44ch', fontSize: 13 }}>
            Your saved roadmap is in <strong>{store.roadmap.mode}</strong> mode.
            Generate a fresh one for <strong>{store.mode}</strong>.
          </div>
          <button className="oq-btn-primary oq-btn-lg" style={{ marginTop: 8 }}
            onClick={generate} disabled={store.generating}>
            {store.generating ? 'Generating…' : `✦ Generate ${store.mode} roadmap`}
          </button>
        </div>
      )}

      {store.editing && (
        <GoalEditor goal={store.goals} onClose={() => store.setEditing(false)} onSave={saveGoal} />
      )}
    </div>
  )
}
