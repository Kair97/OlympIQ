import { useState, useCallback } from 'react'
import { getRecommendations } from '../api/recommendations'
import type { MLRecommendation } from '../api/recommendations'
import { useRecommenderStore } from '../store/recommenderStore'

const TOPICS = [
  'any', 'dynamic_programming', 'graphs', 'greedy', 'binary_search',
  'two_pointers', 'math', 'strings', 'trees', 'data_structures',
  'segment_tree', 'sorting', 'hash_tables', 'number_theory',
  'combinatorics', 'geometry', 'bit_manipulation', 'graph_traversal',
  'shortest_paths', 'backtracking', 'game_theory', 'stack', 'heap',
  'sliding_window', 'union_find', 'trie', 'flows',
]

const PLATFORMS = ['any', 'codeforces', 'leetcode']

function difficultyLabel(rec: MLRecommendation): string {
  if (rec.cf_rating) return `CF ${rec.cf_rating}`
  if (rec.lc_difficulty) return rec.lc_difficulty
  return `${Math.round(rec.difficulty * 100)}%`
}

function difficultyColor(rec: MLRecommendation): string {
  const d = rec.cf_rating
    ? (rec.cf_rating - 800) / 2700
    : rec.lc_difficulty === 'Easy' ? 0.2
    : rec.lc_difficulty === 'Medium' ? 0.55
    : rec.lc_difficulty === 'Hard' ? 0.85
    : rec.difficulty
  if (d < 0.35) return 'var(--ok)'
  if (d < 0.65) return 'var(--warn)'
  return 'var(--err)'
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 70, fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'var(--bg-sunken)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(value * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
      </div>
      <span style={{ width: 34, fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  )
}

function ProblemCard({ rec, idx }: { rec: MLRecommendation; idx: number }) {
  const [open, setOpen] = useState(false)
  const pfBg = rec.platform === 'codeforces' ? 'oklch(0.55 0.18 250 / 0.18)' : 'oklch(0.65 0.15 145 / 0.18)'
  const pfColor = rec.platform === 'codeforces' ? 'oklch(0.72 0.18 250)' : 'oklch(0.72 0.16 145)'

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius)',
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Rank badge */}
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--accent-soft)',
          color: 'var(--accent-fg)',
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {idx + 1}
        </span>

        {/* Title */}
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rec.title || rec.platform_id}
        </span>

        {/* Platform badge */}
        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', background: pfBg, color: pfColor, flexShrink: 0, textTransform: 'uppercase' }}>
          {rec.platform === 'codeforces' ? 'CF' : 'LC'}
        </span>

        {/* Difficulty */}
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: difficultyColor(rec), flexShrink: 0 }}>
          {difficultyLabel(rec)}
        </span>

        {/* Ensemble score */}
        {rec.scores && (
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-fg)', background: 'var(--accent-soft)', padding: '2px 7px', borderRadius: 6, flexShrink: 0 }}>
            {(rec.scores.ensemble * 100).toFixed(0)}
          </span>
        )}

        {/* Solve link */}
        {rec.url && (
          <a
            href={rec.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '5px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)', color: 'var(--accent-on)',
              fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Solve ↗
          </a>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 14, flexShrink: 0, padding: 2 }}
          title="Show model scores"
        >
          {open ? '▲' : '▼'}
        </button>
      </div>

      {/* Tags */}
      {rec.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {rec.tags.map(tag => (
            <span key={tag} style={{
              padding: '2px 8px', borderRadius: 6,
              background: 'var(--bg-elev)',
              color: 'var(--text-dim)',
              fontSize: 11, fontFamily: 'var(--font-mono)',
            }}>
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Reason (n8n / AI fallback) */}
      {rec.reason && !rec.scores && (
        <div style={{
          fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5,
          padding: '7px 10px', background: 'var(--bg-sunken)',
          borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-soft)',
        }}>
          {rec.reason}
        </div>
      )}

      {/* Model scores (expanded — ML only) */}
      {open && rec.scores && (
        <div style={{
          borderTop: '1px solid var(--line)',
          paddingTop: 12,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>ML model scores</div>
          <ScoreBar label="ensemble"    value={rec.scores.ensemble} />
          <ScoreBar label="content"     value={rec.scores.content} />
          <ScoreBar label="sequential"  value={rec.scores.sequential} />
          <ScoreBar label="difficulty"  value={rec.scores.difficulty} />
          <ScoreBar label="collab filt" value={rec.scores.cf} />
        </div>
      )}
    </div>
  )
}

export default function Recommender() {
  const store = useRecommenderStore()
  const { recs, loading, error, loaded, topic, platform } = store

  const load = useCallback(async () => {
    const s = () => useRecommenderStore.getState()
    s().setLoading(true)
    s().setError('')
    try {
      const { topic: t, platform: p } = s()
      const data = await getRecommendations({
        topic:    t !== 'any' ? t : undefined,
        platform: p !== 'any' ? p : undefined,
      })
      s().setRecs(Array.isArray(data) ? data : [])
      s().setLoaded(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load recommendations.'
      if (msg.toLowerCase().includes('platform') || msg.toLowerCase().includes('connect'))
        s().setError('No platform connected — go to Profile and connect Codeforces or LeetCode first.')
      else
        s().setError(msg || 'Failed to load recommendations. Make sure your platform is synced in Profile.')
    } finally {
      s().setLoading(false)
    }
  }, [])

  // No auto-load — user clicks the button to fetch recommendations

  return (
    <div style={{ padding: '32px 36px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Problem Recommender
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
          ML-ranked problems calibrated to your level — not too easy, not too hard.
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 20, padding: '14px 16px',
        background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)',
      }}>
        {/* Topic */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Topic</label>
          <select
            value={topic}
            onChange={e => store.setTopic(e.target.value)}
            style={{
              background: 'var(--bg-elev)', border: '1px solid var(--line)',
              color: 'var(--text)', borderRadius: 8, padding: '6px 10px',
              fontSize: 13, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}
          >
            {TOPICS.map(t => (
              <option key={t} value={t}>{t === 'any' ? 'Any topic' : t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Platform */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Platform</label>
          <select
            value={platform}
            onChange={e => store.setPlatform(e.target.value)}
            style={{
              background: 'var(--bg-elev)', border: '1px solid var(--line)',
              color: 'var(--text)', borderRadius: 8, padding: '6px 10px',
              fontSize: 13, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}
          >
            {PLATFORMS.map(p => (
              <option key={p} value={p}>{p === 'any' ? 'All platforms' : p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }} />

        {/* Refresh */}
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: '8px 18px', borderRadius: 'var(--radius-sm)',
            background: loading ? 'var(--bg-elev)' : 'var(--accent)',
            color: loading ? 'var(--text-faint)' : 'var(--accent-on)',
            border: 'none', cursor: loading ? 'default' : 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'opacity 0.15s',
          }}
        >
          {loading ? 'Loading…' : loaded ? '↻ Refresh' : '✦ Load'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius)',
          background: 'oklch(0.70 0.20 25 / 0.1)', border: '1px solid var(--err)',
          color: 'var(--err)', fontSize: 13, marginBottom: 16,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && recs.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              height: 72, borderRadius: 'var(--radius)',
              background: 'var(--panel)', border: '1px solid var(--line)',
              opacity: 0.5 + i * 0.1,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {/* First-visit empty state */}
      {!loading && !loaded && !error && (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'var(--panel)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 32, color: 'var(--accent)' }}>✦</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
            Get your personalized recommendations
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 400 }}>
            The ML model ranks problems from 18 000+ problems across Codeforces and LeetCode,
            calibrated to your exact rating and solved history.
          </div>
          <button
            onClick={() => void load()}
            style={{
              marginTop: 6, padding: '10px 28px',
              background: 'var(--accent)', color: 'var(--accent-on)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ✦ Load Recommendations
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
            requires Codeforces or LeetCode connected in Profile
          </div>
        </div>
      )}

      {/* Loaded but empty */}
      {!loading && loaded && recs.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-faint)', fontSize: 13 }}>
          No problems matched your filters — try a different topic or platform.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {recs.map((rec, i) => (
          <ProblemCard key={`${rec.platform}-${rec.platform_id}`} rec={rec} idx={i} />
        ))}
      </div>

      {/* ML badge */}
      {recs.length > 0 && (
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
          {recs[0]?.scores
            ? 'ranked by CF·ALS + Content·LogReg + SASRec·Transformer + Difficulty + LightGBM ensemble'
            : 'ranked by AI (ML model unavailable — sync your profile to activate)'}
        </div>
      )}
    </div>
  )
}
