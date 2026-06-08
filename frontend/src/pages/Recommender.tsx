import { useCallback, useState } from 'react'
import { postRecommendations, isStructuredRecs } from '../api/recommendations'
import type { MLRecommendation, RecsProb, RecsMeta } from '../api/recommendations'
import {
  useRecommenderStore,
  availableTopics,
  filterStructured,
} from '../store/recommenderStore'

// "all" = every platform; individual strings = filter to one platform
const PLATFORMS = ['all', 'codeforces', 'leetcode']

const TOPIC_LABELS: Record<string, string> = {
  any:              'Any topic',
  dynamic_programming: 'Dynamic Programming',
  graphs:           'Graphs',
  greedy:           'Greedy',
  binary_search:    'Binary Search',
  two_pointers:     'Two Pointers',
  math:             'Math',
  strings:          'Strings',
  trees:            'Trees',
  data_structures:  'Data Structures',
  segment_tree:     'Segment Tree',
  sorting:          'Sorting',
  hash_tables:      'Hash Tables',
  number_theory:    'Number Theory',
  combinatorics:    'Combinatorics',
  geometry:         'Geometry',
  bit_manipulation: 'Bit Manipulation',
  graph_traversal:  'Graph Traversal',
  shortest_paths:   'Shortest Paths',
  backtracking:     'Backtracking',
  game_theory:      'Game Theory',
  stack:            'Stack',
  heap:             'Heap',
  sliding_window:   'Sliding Window',
  union_find:       'Union Find',
  trie:             'Trie',
  flows:            'Flows',
}

function topicLabel(slug: string): string {
  return TOPIC_LABELS[slug] ?? slug.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── Difficulty helpers ────────────────────────────────────────────────────────

function structuredDiffLabel(prob: RecsProb): string {
  if (prob.rating) return `CF ${prob.rating}`
  if (prob.difficulty) {
    const d = prob.difficulty.toLowerCase()
    return d.charAt(0).toUpperCase() + d.slice(1)
  }
  return '—'
}

function structuredDiffColor(prob: RecsProb): string {
  if (prob.rating) {
    const d = (prob.rating - 800) / 2700
    if (d < 0.35) return 'var(--ok)'
    if (d < 0.65) return 'var(--warn)'
    return 'var(--err)'
  }
  const d = (prob.difficulty ?? '').toLowerCase()
  if (d === 'easy') return 'var(--ok)'
  if (d === 'hard') return 'var(--err)'
  return 'var(--warn)'
}

function mlDiffLabel(rec: MLRecommendation): string {
  if (rec.cf_rating) return `CF ${rec.cf_rating}`
  if (rec.lc_difficulty) return rec.lc_difficulty
  return `${Math.round(rec.difficulty * 100)}%`
}

function mlDiffColor(rec: MLRecommendation): string {
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

// ── Problem cards ─────────────────────────────────────────────────────────────

function StructuredProbCard({
  prob,
  idx,
}: {
  prob: RecsProb & { platform: string }
  idx: number
}) {
  const isLC = prob.platform === 'leetcode'
  const pfBg    = isLC ? 'oklch(0.65 0.15 145 / 0.18)' : 'oklch(0.55 0.18 250 / 0.18)'
  const pfColor = isLC ? 'oklch(0.72 0.16 145)'         : 'oklch(0.72 0.18 250)'

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius)',
      padding: '14px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 7,
          background: 'var(--accent-soft)', color: 'var(--accent-fg)',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {idx + 1}
        </span>

        <a
          href={prob.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)',
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-fg)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
        >
          {prob.title}
        </a>

        <span style={{
          padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700,
          fontFamily: 'var(--font-mono)', background: pfBg, color: pfColor,
          flexShrink: 0, textTransform: 'uppercase',
        }}>
          {isLC ? 'LC' : 'CF'}
        </span>

        <span style={{
          fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
          color: structuredDiffColor(prob), flexShrink: 0,
        }}>
          {structuredDiffLabel(prob)}
        </span>

        <a
          href={prob.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '5px 12px', borderRadius: 'var(--radius-sm)',
            background: 'var(--accent)', color: 'var(--accent-on)',
            fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Solve ↗
        </a>
      </div>

      {(prob.tags ?? []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(prob.tags ?? []).map(tag => (
            <span key={tag} style={{
              padding: '2px 7px', borderRadius: 5,
              background: 'var(--bg-elev)', color: 'var(--text-dim)',
              fontSize: 11, fontFamily: 'var(--font-mono)',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {prob.reason && (
        <div style={{
          fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55,
          padding: '7px 10px', background: 'var(--bg-sunken)',
          borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-soft)',
          fontStyle: 'italic',
        }}>
          {prob.reason}
        </div>
      )}
    </div>
  )
}

function MLProbCard({ rec, idx }: { rec: MLRecommendation; idx: number }) {
  const pfBg    = rec.platform === 'codeforces' ? 'oklch(0.55 0.18 250 / 0.18)' : 'oklch(0.65 0.15 145 / 0.18)'
  const pfColor = rec.platform === 'codeforces' ? 'oklch(0.72 0.18 250)'         : 'oklch(0.72 0.16 145)'

  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius)', padding: '14px 18px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 7,
          background: 'var(--accent-soft)', color: 'var(--accent-fg)',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {idx + 1}
        </span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rec.title || rec.platform_id}
        </span>
        <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', background: pfBg, color: pfColor, flexShrink: 0, textTransform: 'uppercase' }}>
          {rec.platform === 'codeforces' ? 'CF' : 'LC'}
        </span>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: mlDiffColor(rec), flexShrink: 0 }}>
          {mlDiffLabel(rec)}
        </span>
        {rec.url && (
          <a href={rec.url} target="_blank" rel="noopener noreferrer" style={{
            padding: '5px 12px', borderRadius: 'var(--radius-sm)',
            background: 'var(--accent)', color: 'var(--accent-on)',
            fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
          }}>
            Solve ↗
          </a>
        )}
      </div>
      {(rec.tags ?? []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(rec.tags ?? []).map(tag => (
            <span key={tag} style={{ padding: '2px 7px', borderRadius: 5, background: 'var(--bg-elev)', color: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      {rec.reason && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55, padding: '7px 10px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-soft)', fontStyle: 'italic' }}>
          {rec.reason}
        </div>
      )}
    </div>
  )
}

// ── Meta panel ────────────────────────────────────────────────────────────────

function MetaPanel({ meta }: { meta: RecsMeta }) {
  const cfR = meta.codeforces_rating
  const lcS = meta.leetcode_solved

  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius)', padding: '14px 20px',
      marginBottom: 12, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center',
    }}>
      {meta.username && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {meta.username}
        </span>
      )}
      {cfR != null && (
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'oklch(0.72 0.18 250)' }}>
          CF {cfR}
        </span>
      )}
      {lcS != null && (
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'oklch(0.72 0.16 145)' }}>
          LC {lcS} solved
        </span>
      )}
      {(meta.next_best_topic ?? '') !== '' && (
        <span style={{
          padding: '3px 10px', borderRadius: 20,
          background: 'var(--accent-soft)', color: 'var(--accent-fg)',
          fontSize: 12, fontWeight: 700, border: '1px solid oklch(0.72 0.16 305 / 0.3)',
        }}>
          ✦ Focus: {topicLabel(meta.next_best_topic)}
        </span>
      )}
      {meta.generated_at && (
        <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
          {new Date(meta.generated_at).toLocaleString()}
        </span>
      )}
    </div>
  )
}

// ── Weak-topics banner ────────────────────────────────────────────────────────

function WeakTopicsBanner({
  meta,
  onDismiss,
}: {
  meta: RecsMeta
  onDismiss: () => void
}) {
  const weakTopics = meta.weak_topics ?? []
  const nextBest   = meta.next_best_topic ?? ''
  if (weakTopics.length === 0 && !nextBest) return null

  const weakDisplay = weakTopics.map(topicLabel).join(', ')

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', borderRadius: 'var(--radius)',
      background: 'oklch(0.72 0.16 305 / 0.07)',
      border: '1px solid oklch(0.72 0.16 305 / 0.25)',
      marginBottom: 12, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5,
    }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>💡</span>
      <span style={{ flex: 1 }}>
        {weakDisplay && (
          <>
            <span style={{ color: 'var(--text)' }}>Your weakest areas:</span>
            {' '}
            <span style={{ color: 'var(--err)' }}>{weakDisplay}</span>
          </>
        )}
        {weakDisplay && nextBest ? ' — ' : ''}
        {nextBest && (
          <>
            <span style={{ color: 'var(--text)' }}>Best next topic:</span>
            {' '}
            <span style={{ color: 'var(--accent-fg)', fontWeight: 600 }}>{topicLabel(nextBest)}</span>
          </>
        )}
      </span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-faint)', fontSize: 14, lineHeight: 1,
          padding: '0 2px', flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
      >
        ✕
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Recommender() {
  const store = useRecommenderStore()
  const { structured, recs, loading, error, loaded, topic, platform } = store

  const [bannerDismissed, setBannerDismissed] = useState(false)

  // Reset banner when new recommendations are loaded
  const resetBanner = () => setBannerDismissed(false)

  // Derive available topic keys and filtered problems from structured data
  const topics = structured ? availableTopics(structured) : ['any']
  const filteredProbs = structured ? filterStructured(structured, topic, platform) : []

  const load = useCallback(async () => {
    const s = () => useRecommenderStore.getState()
    s().setLoading(true)
    s().setError('')
    resetBanner()
    try {
      const data = await postRecommendations()
      if (isStructuredRecs(data)) {
        s().setStructured(data)
        s().setRecs([])
        // Auto-select next_best_topic on first load
        const best = data.meta.next_best_topic
        if (best) {
          const keys = availableTopics(data)
          const bestSlug = best.toLowerCase().replace(/\s+/g, '_')
          const match = keys.find(k => k.toLowerCase() === bestSlug)
            || keys.find(k => k.toLowerCase() === best.toLowerCase())
          if (match) s().setTopic(match)
        }
      } else {
        s().setRecs(Array.isArray(data) ? data : [])
        s().setStructured(null)
      }
      s().setLoaded(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load recommendations.'
      if (msg.toLowerCase().includes('platform') || msg.toLowerCase().includes('connect'))
        s().setError('No platform connected — go to Profile and connect Codeforces or LeetCode first.')
      else
        s().setError(msg || 'Failed to load. Make sure your platform is synced in Profile.')
    } finally {
      s().setLoading(false)
    }
  }, [])

  const isMLMode = loaded && !structured && recs.length > 0

  return (
    <div style={{ padding: '32px 36px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Problem Recommender
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
          AI-ranked problems calibrated to your level — pick a topic and platform to filter.
        </p>
      </div>

      {/* Meta panel (structured mode only) */}
      {structured && <MetaPanel meta={structured.meta} />}

      {/* Weak topics banner (structured mode, dismissible) */}
      {structured && !bannerDismissed && (
        <WeakTopicsBanner meta={structured.meta} onDismiss={() => setBannerDismissed(true)} />
      )}

      {/* Filter + load bar */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
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
            {topics.map(t => (
              <option key={t} value={t}>{topicLabel(t)}</option>
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
              <option key={p} value={p}>
                {p === 'all' ? 'All platforms' : p === 'leetcode' ? 'LeetCode' : 'Codeforces'}
              </option>
            ))}
          </select>
        </div>

        {structured && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', alignSelf: 'center', marginLeft: 4 }}>
            {filteredProbs.length} problem{filteredProbs.length !== 1 ? 's' : ''} — filters apply instantly
          </div>
        )}

        <div style={{ flex: 1 }} />

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
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              height: 76, borderRadius: 'var(--radius)',
              background: 'var(--panel)', border: '1px solid var(--line)',
              opacity: 0.4 + i * 0.1,
            }} />
          ))}
        </div>
      )}

      {/* First-visit empty state */}
      {!loading && !loaded && !error && (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          background: 'var(--panel)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 32, color: 'var(--accent)' }}>✦</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
            Get your personalized recommendations
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 420, lineHeight: 1.6 }}>
            The AI analyzes your rating, topic history, and weak areas to curate problems
            exactly where you'll improve fastest.
          </div>
          <button
            onClick={() => void load()}
            style={{
              marginTop: 4, padding: '10px 28px',
              background: 'var(--accent)', color: 'var(--accent-on)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ✦ Load Recommendations
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
            requires Codeforces or LeetCode connected and synced in Profile
          </div>
        </div>
      )}

      {/* Problem count header */}
      {!loading && structured && (
        <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
          {filteredProbs.length} problem{filteredProbs.length !== 1 ? 's' : ''}
          {filteredProbs.length > 0 && ' — click any title or "Solve ↗" to open on the platform'}
        </div>
      )}

      {/* Structured recs */}
      {!loading && structured && filteredProbs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredProbs.map((prob, i) => (
            <StructuredProbCard key={`${prob.platform}-${prob.url}-${i}`} prob={prob} idx={i} />
          ))}
        </div>
      )}

      {/* Structured — empty filter result */}
      {!loading && structured && filteredProbs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-faint)', fontSize: 13 }}>
          No problems found for this combination — try a different topic or platform.
        </div>
      )}

      {/* Legacy ML recs */}
      {!loading && isMLMode && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recs.map((rec, i) => (
              <MLProbCard key={`${rec.platform}-${rec.platform_id}`} rec={rec} idx={i} />
            ))}
          </div>
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
            {recs[0]?.scores
              ? 'ranked by CF·ALS + Content·LogReg + SASRec·Transformer + Difficulty + LightGBM ensemble'
              : 'ranked by AI — sync your profile to improve accuracy'}
          </div>
        </>
      )}

      {/* Loaded but fully empty */}
      {!loading && loaded && !structured && recs.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-faint)', fontSize: 13 }}>
          No recommendations returned — try syncing your profile and refreshing.
        </div>
      )}
    </div>
  )
}
