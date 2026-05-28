import { useEffect, useState, type FormEvent } from 'react'
import { analyzeProblem, listAnalyses } from '../api/analyzer'
import type { Analysis, AnalysisContent } from '../types'

function RazborPanel({ content }: { content: AnalysisContent }) {
  const [openHint, setOpenHint] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Classification */}
      <div className="oq-panel">
        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Classification</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="oq-tag">{content.classification.type}</span>
          <span className="oq-tag">{content.classification.subtype}</span>
          <span className="oq-tag">{content.classification.difficulty_label}</span>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginBottom: 4 }}>
            Confidence: {Math.round(content.classification.confidence * 100)}%
          </div>
          <div style={{ height: 6, background: 'var(--bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${content.classification.confidence * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
          </div>
        </div>
      </div>

      {/* Key Observations */}
      <div className="oq-panel">
        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Key Observations</h3>
        <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {content.key_observations.map((obs, i) => (
            <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>{obs}</li>
          ))}
        </ul>
      </div>

      {/* Algorithm Approach */}
      <div className="oq-panel">
        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Algorithm Approach</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>{content.algorithm_approach.summary}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {content.algorithm_approach.hints.map((hint) => (
            <div key={hint.level}>
              <button onClick={() => setOpenHint(openHint === hint.level ? null : hint.level)} style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.875rem', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.8125rem', width: '100%', textAlign: 'left' }}>
                💡 Hint {hint.level} {openHint === hint.level ? '▲' : '▼'}
              </button>
              {openHint === hint.level && (
                <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', marginTop: 4, fontSize: '0.875rem', color: 'var(--text)' }}>
                  {hint.text}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Solution Steps */}
      <div className="oq-panel">
        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Step-by-Step Solution Logic</h3>
        <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {content.solution_steps.map((step, i) => (
            <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>{step}</li>
          ))}
        </ol>
      </div>

      {/* Complexity */}
      <div className="oq-panel">
        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Complexity</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Time</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{content.complexity.time}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Space</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{content.complexity.space}</div>
          </div>
        </div>
        {content.complexity.note && <p style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>{content.complexity.note}</p>}
      </div>

      {/* Common Mistakes */}
      {content.common_mistakes.length > 0 && (
        <div className="oq-panel">
          <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Common Mistakes</h3>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {content.common_mistakes.map((m, i) => <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>{m}</li>)}
          </ul>
        </div>
      )}

      {/* Similar Problems */}
      {content.similar_problems.length > 0 && (
        <div className="oq-panel">
          <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Similar Problems</h3>
          {content.similar_problems.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.625rem 0', borderBottom: '1px solid var(--line)' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{p.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: 2 }}>{p.similarity_reason}</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4 }}>
                  {p.tags.slice(0, 3).map(t => <span key={t} className="oq-tag">{t}</span>)}
                </div>
              </div>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="oq-btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', flexShrink: 0 }}>
                Solve ↗
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Analyzer() {
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [current, setCurrent] = useState<AnalysisContent | null>(null)
  const [currentURL, setCurrentURL] = useState('')
  const [history, setHistory] = useState<Analysis[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    listAnalyses().then(r => setHistory(r.items ?? [])).catch(() => {})
  }, [])

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setAnalyzing(true)
    setError('')
    try {
      const result = await analyzeProblem(url.trim())
      if (result.analysis) {
        setCurrent(result.analysis)
        setCurrentURL(url.trim())
        const updated = await listAnalyses()
        setHistory(updated.items ?? [])
      }
    } catch {
      setError('Analysis failed. Check the URL and try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  const platform = currentURL.includes('leetcode') ? 'LeetCode' : currentURL.includes('codeforces') ? 'Codeforces' : null

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Problem Analyzer</h1>
      <p style={{ color: 'var(--text-faint)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Paste a Codeforces or LeetCode problem URL to get a deep educational breakdown — no solution code, just the reasoning.
      </p>

      <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <input
          className="oq-input"
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://codeforces.com/problemset/problem/1/A"
          style={{ flex: 1 }}
        />
        <button className="oq-btn-primary" type="submit" disabled={analyzing || !url.trim()} style={{ flexShrink: 0 }}>
          {analyzing ? 'Analyzing…' : '✦ Analyze'}
        </button>
      </form>

      {error && (
        <div style={{ background: 'var(--err)', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: current ? '1fr 1.2fr' : '1fr', gap: '1.5rem' }}>
        {current && (
          <div>
            {/* Problem pane */}
            <div className="oq-panel" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {platform && (
                  <>
                    <a href={currentURL} target="_blank" rel="noopener noreferrer" className="oq-btn-primary oq-btn-lg">
                      Solve on {platform} ↗
                    </a>
                  </>
                )}
              </div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>{current.problem_title}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {current.classification.type && <span className="oq-tag">{current.classification.type}</span>}
                <span className="oq-tag">{current.classification.difficulty_label}</span>
              </div>
            </div>

            {/* Analysis history */}
            {history.length > 0 && (
              <div className="oq-panel">
                <h3 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.75rem' }}>Analysis History</h3>
                {history.slice(0, 8).map(a => (
                  <div key={a.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--line)', fontSize: '0.8125rem' }}>
                    <a href={a.problem_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>
                      {a.problem_title ?? a.problem_url}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {current && <RazborPanel content={current} />}

        {!current && history.length > 0 && (
          <div className="oq-panel">
            <h3 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.75rem' }}>Past Analyses</h3>
            {history.map(a => (
              <div key={a.id} style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--line)' }}>
                <a href={a.problem_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', textDecoration: 'none', fontWeight: 500, fontSize: '0.875rem' }}>
                  {a.problem_title ?? a.problem_url}
                </a>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: 2 }}>
                  {new Date(a.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
