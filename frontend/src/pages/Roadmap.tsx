import { useEffect, useState } from 'react'
import { generateRoadmap, getRoadmap } from '../api/roadmap'
import { getGoals, upsertGoals } from '../api/profile'
import type { AnyRoadmap, WeeklyRoadmap, TopicRoadmap, InterviewRoadmap, RoadmapProblem, UserGoal } from '../types'

type Mode = 'weekly' | 'topic' | 'interview'

function ProblemLink({ p }: { p: RoadmapProblem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          {p.tags.slice(0, 4).map((t) => <span key={t} className="oq-tag">{t}</span>)}
        </div>
        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{p.title}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: 2 }}>{p.reason}</div>
      </div>
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="oq-btn-primary oq-btn-lg" style={{ flexShrink: 0, fontSize: '0.8125rem', padding: '0.375rem 1rem' }}>
        Solve ↗
      </a>
    </div>
  )
}

function WeeklyView({ data }: { data: WeeklyRoadmap }) {
  const [open, setOpen] = useState<number[]>([0])
  const toggle = (i: number) => setOpen(o => o.includes(i) ? o.filter(x => x !== i) : [...o, i])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {data.weeks.map((w, i) => (
        <div key={i} className="oq-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <button onClick={() => toggle(i)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text)' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>Week {w.week}: {w.theme}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{w.focus_topics.join(' · ')}</div>
            </div>
            <span style={{ color: 'var(--text-faint)', fontSize: '0.875rem' }}>{open.includes(i) ? '▲' : '▼'}</span>
          </button>
          {open.includes(i) && (
            <div style={{ padding: '0 1.25rem 1rem' }}>
              {w.problems.map((p, j) => <ProblemLink key={j} p={p} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TopicView({ data }: { data: TopicRoadmap }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
      {data.topics.map((topic, i) => (
        <div key={i} className="oq-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ fontWeight: 600 }}>{topic.name}</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
              {Math.round(topic.strength_score * 100)}%
            </span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-sunken)', borderRadius: 2, marginBottom: '0.75rem', overflow: 'hidden' }}>
            <div style={{ width: `${topic.strength_score * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', marginBottom: '0.75rem' }}>{topic.why}</p>
          {topic.problems.slice(0, 3).map((p, j) => <ProblemLink key={j} p={p} />)}
        </div>
      ))}
    </div>
  )
}

function InterviewView({ data }: { data: InterviewRoadmap }) {
  return (
    <div>
      {data.target_companies.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {data.target_companies.map(c => <span key={c} className="oq-tag">{c}</span>)}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {data.patterns.map((pattern, i) => (
          <div key={i} className="oq-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>{pattern.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-faint)' }}>
                {Math.round(pattern.frequency * 100)}% frequency
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-sunken)', borderRadius: 2, marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{ width: `${pattern.frequency * 100}%`, height: '100%', background: 'var(--accent-2)', borderRadius: 2 }} />
            </div>
            {pattern.problems.map((p, j) => <ProblemLink key={j} p={p} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Roadmap() {
  const [mode, setMode] = useState<Mode>('weekly')
  const [roadmap, setRoadmap] = useState<AnyRoadmap | null>(null)
  const [goals, setGoals] = useState<UserGoal | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [rm, g] = await Promise.allSettled([getRoadmap(), getGoals()])
      if (rm.status === 'fulfilled') { setRoadmap(rm.value.roadmap); setMode(rm.value.mode as Mode) }
      if (g.status === 'fulfilled') setGoals(g.value)
      setLoading(false)
    }
    void load()
  }, [])

  async function generate() {
    setGenerating(true)
    try {
      const rm = await generateRoadmap(mode)
      setRoadmap(rm)
    } finally {
      setGenerating(false)
    }
  }

  const tabs: Mode[] = ['weekly', 'topic', 'interview']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Roadmap</h1>
          <p style={{ color: 'var(--text-faint)', fontSize: '0.875rem' }}>AI-generated study plan based on your stats</p>
        </div>
        <button onClick={generate} disabled={generating} className="oq-btn-primary">
          {generating ? 'Generating…' : '✦ Generate'}
        </button>
      </div>

      {goals && (
        <div className="oq-panel" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Goal</div>
            <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{goals.goal_type.replace('_', ' ')}</div>
          </div>
          {goals.target_rating && (
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Target</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>{goals.target_rating}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setMode(t)} style={{
            padding: '0.5rem 1.25rem',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            background: mode === t ? 'var(--accent-soft)' : 'transparent',
            color: mode === t ? 'var(--accent-fg)' : 'var(--text-dim)',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.875rem',
            textTransform: 'capitalize',
          }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : !roadmap ? (
        <div className="oq-panel" style={{ textAlign: 'center', padding: '4rem 1.25rem' }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: '1rem' }}>No roadmap yet. Click "Generate" to create your personalized plan.</p>
        </div>
      ) : (
        <>
          {roadmap.mode === 'weekly' && <WeeklyView data={roadmap as WeeklyRoadmap} />}
          {roadmap.mode === 'topic' && <TopicView data={roadmap as TopicRoadmap} />}
          {roadmap.mode === 'interview' && <InterviewView data={roadmap as InterviewRoadmap} />}
        </>
      )}
    </div>
  )
}
