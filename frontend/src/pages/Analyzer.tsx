import { useEffect, useCallback, useState, type FormEvent } from 'react'
import axios from 'axios'
import { analyzeProblem, listAnalyses, getAnalysis } from '../api/analyzer'
import { useAnalyzerStore } from '../store/analyzerStore'
import type { AnalysisContent } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────────

function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

function detectPlatform(url: string): 'codeforces' | 'leetcode' | 'other' {
  if (url.includes('codeforces.com')) return 'codeforces'
  if (url.includes('leetcode.com'))   return 'leetcode'
  return 'other'
}

function ratingPillClass(rating: number | null | undefined, difficulty?: string | null) {
  if (difficulty) {
    const d = difficulty.toLowerCase()
    if (d === 'easy' || d === 'medium' || d === 'hard') return `oq-rating-pill small ${d}`
  }
  if (!rating) return 'oq-rating-pill small'
  return `oq-rating-pill small r-${Math.min(35, Math.floor(rating / 100))}`
}

function tagSearchURL(tag: string, platform: string) {
  if (platform === 'codeforces')
    return `https://codeforces.com/problemset?tags=${encodeURIComponent(tag)}`
  if (platform === 'leetcode')
    return `https://leetcode.com/tag/${encodeURIComponent(tag.toLowerCase().replace(/\s+/g, '-'))}/`
  return '#'
}

function editorialURL(url: string, platform: string) {
  if (platform === 'leetcode') {
    const slug = url.split('/problems/')[1]?.replace(/\/$/, '')
    return slug ? `https://leetcode.com/problems/${slug}/editorial/` : url
  }
  return url
}

// ── RazborPane ────────────────────────────────────────────────────────────────

function RazborPane({ model }: { model: string }) {
  const {
    currentContent: r, analyzing, tab, revealedHints,
    setTab, setRevealedHints,
  } = useAnalyzerStore()

  if (analyzing) {
    return (
      <div className="oq-razbor">
        <div className="oq-razbor-empty">
          <div className="oq-razbor-empty-glyph" style={{ animation: 'pulse 1.2s infinite' }}>✦</div>
          <div className="oq-razbor-empty-title">Analyzing…</div>
          <div className="oq-razbor-empty-sub">
            Gemini is breaking down the problem — this takes 15–30 seconds.
          </div>
          <div className="oq-stream-cursor" style={{ marginTop: 12 }}>
            <span className="oq-cursor-block">▌</span>
          </div>
          <div className="oq-razbor-empty-meta oq-mono">
            <div><span className="oq-dim">model</span>{"  "}{model}</div>
          </div>
        </div>
      </div>
    )
  }

  if (!r) {
    return (
      <div className="oq-razbor">
        <div className="oq-razbor-empty">
          <div className="oq-razbor-empty-glyph">✦</div>
          <div className="oq-razbor-empty-title">No razbor yet</div>
          <div className="oq-razbor-empty-sub">
            Paste a Codeforces or LeetCode problem URL above, then press{' '}
            <kbd>✦ Analyze</kbd> to get a full educational breakdown.
          </div>
          <div className="oq-razbor-empty-meta oq-mono">
            <div><span className="oq-dim">model</span>{"  "}{model}</div>
            <div><span className="oq-dim">supports</span>{"  "}codeforces · leetcode</div>
            <div><span className="oq-dim">no code</span>{"  "}you solve on the source platform</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="oq-razbor">
      <div className="oq-razbor-tabs">
        {(['all', 'hints', 'solution'] as const).map(t => (
          <button
            key={t}
            className={cx('oq-razbor-tab', tab === t && 'is-active')}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All' : t === 'hints' ? 'Hints only' : 'Walkthrough'}
          </button>
        ))}
        <div className="oq-razbor-tab-spacer" />
        <span className="oq-razbor-status oq-mono">
          <span className="oq-dot oq-dot-ok" /> done · {model}
        </span>
      </div>

      <div className="oq-razbor-scroll">
        {/* 01 Classification */}
        {(tab === 'all' || tab === 'solution') && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">01</span> Classification</div>
            <div className="oq-classify">
              <div className="oq-classify-row">
                <span className="oq-rs-key">type</span>
                <span className="oq-pill oq-pill-accent">{r.classification.type}</span>
                {r.classification.subtype && (
                  <span className="oq-pill" style={{ marginLeft: 4 }}>{r.classification.subtype}</span>
                )}
              </div>
              <div className="oq-classify-row">
                <span className="oq-rs-key">difficulty</span>
                <span className="oq-mono">{r.classification.difficulty_label}</span>
              </div>
              <div className="oq-classify-row">
                <span className="oq-rs-key">confidence</span>
                <div className="oq-confidence">
                  <div className="oq-confidence-fill" style={{ width: `${r.classification.confidence * 100}%` }} />
                </div>
                <span className="oq-mono" style={{ fontSize: 11 }}>
                  {Math.round(r.classification.confidence * 100)}%
                </span>
              </div>
            </div>
          </section>
        )}

        {/* 02 Key observations */}
        {(tab === 'all' || tab === 'solution') && r.key_observations.length > 0 && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">02</span> Key observations</div>
            <ol className="oq-rs-list">
              {r.key_observations.map((obs, i) => <li key={i}>{obs}</li>)}
            </ol>
          </section>
        )}

        {/* 03 Hint ladder */}
        {(tab === 'all' || tab === 'hints') && r.algorithm_approach.hints.length > 0 && (
          <section className="oq-rs">
            <div className="oq-rs-head">
              <span className="oq-rs-marker">03</span> Hint ladder
              <span className="oq-rs-aside oq-dim">
                {revealedHints}/{r.algorithm_approach.hints.length} revealed
              </span>
            </div>
            <div className="oq-hints">
              {r.algorithm_approach.hints.map((h, i) => {
                const open = i < revealedHints
                return (
                  <div key={i} className={cx('oq-hint', open && 'is-open')}>
                    <button
                      className="oq-hint-head"
                      onClick={() => setRevealedHints(open ? i : i + 1)}
                    >
                      <span className="oq-hint-level">Hint {h.level}</span>
                      <span className="oq-hint-toggle">{open ? '[hide]' : '[reveal]'}</span>
                    </button>
                    <div className="oq-hint-body">
                      {open ? h.text : <span className="oq-dim oq-mono">{'·'.repeat(40)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 04 Approach summary */}
        {(tab === 'all' || tab === 'solution') && r.algorithm_approach.summary && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">04</span> Approach</div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0, lineHeight: 1.6 }}>
              {r.algorithm_approach.summary}
            </p>
          </section>
        )}

        {/* 05 Step-by-step */}
        {(tab === 'all' || tab === 'solution') && r.solution_steps.length > 0 && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">05</span> Algorithm — step by step</div>
            <ol className="oq-steps">
              {r.solution_steps.map((s, i) => (
                <li key={i}>
                  <span className="oq-step-num oq-mono">{String(i + 1).padStart(2, '0')}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 06 Complexity */}
        {(tab === 'all' || tab === 'solution') && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">06</span> Complexity</div>
            <div className="oq-complexity">
              <div className="oq-cx">
                <div className="oq-cx-lbl">time</div>
                <div className="oq-cx-val oq-mono">{r.complexity.time}</div>
              </div>
              <div className="oq-cx">
                <div className="oq-cx-lbl">space</div>
                <div className="oq-cx-val oq-mono">{r.complexity.space}</div>
              </div>
              {r.complexity.note && (
                <div className="oq-cx oq-cx-note">{r.complexity.note}</div>
              )}
            </div>
          </section>
        )}

        {/* 07 Common mistakes */}
        {(tab === 'all' || tab === 'solution') && r.common_mistakes.length > 0 && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">07</span> Common mistakes</div>
            <ul className="oq-rs-list">
              {r.common_mistakes.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </section>
        )}

        {/* 08 Similar problems */}
        {(tab === 'all' || tab === 'solution') && r.similar_problems.length > 0 && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">08</span> Similar to practice</div>
            <ul className="oq-similar">
              {r.similar_problems.map((s, i) => (
                <li key={i}>
                  <div className="oq-similar-main">
                    <div className="oq-similar-code oq-mono">{s.platform}</div>
                    <div className="oq-similar-title">{s.title}</div>
                  </div>
                  <div className="oq-similar-meta">
                    <div className="oq-similar-tags">{s.tags.slice(0, 2).join(' · ')}</div>
                    {s.rating && <div className={ratingPillClass(s.rating)}>{s.rating}</div>}
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                       className="oq-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>
                      Solve ↗
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

// ── Problem pane ──────────────────────────────────────────────────────────────

function ProblemPane({ content, url }: { content: AnalysisContent; url: string }) {
  const platform = detectPlatform(url)
  const platformLabel = platform === 'codeforces' ? 'Codeforces'
                      : platform === 'leetcode'   ? 'LeetCode'
                      : 'Platform'

  return (
    <div className="oq-prob">
      <div className="oq-prob-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="oq-prob-source oq-mono">
            {platformLabel}
            <span className="oq-dim"> · </span>
            {content.platform}
          </div>
          <h2 className="oq-prob-title">{content.problem_title}</h2>
        </div>
        <div className={ratingPillClass(null, content.classification.difficulty_label)}>
          {content.classification.difficulty_label}
        </div>
      </div>

      {/* Tags */}
      <div className="oq-tags">
        {[content.classification.type, content.classification.subtype]
          .filter(Boolean)
          .map((t, i) => (
            <a key={i} href={tagSearchURL(t!, platform)} target="_blank" rel="noopener" className="oq-tag">
              {t}
            </a>
          ))}
      </div>

      {/* Primary action buttons */}
      <div className="oq-actions">
        <a href={url} target="_blank" rel="noopener noreferrer" className="oq-btn-primary oq-btn-lg">
          Solve on {platformLabel} ↗
        </a>
        <a href={editorialURL(url, platform)} target="_blank" rel="noopener noreferrer"
           className="oq-btn-ghost oq-btn-lg">
          Editorial ↗
        </a>
        {platform === 'codeforces' && (
          <a href={url.replace('/problem/', '/submit/')} target="_blank" rel="noopener noreferrer"
             className="oq-btn-ghost oq-btn-lg">
            Submit ↗
          </a>
        )}
      </div>
      <div className="oq-actions-note oq-mono oq-dim">
        you solve on {platformLabel.toLowerCase()} · olympiq analyzes only
      </div>

      {/* Key observations preview */}
      {content.key_observations.length > 0 && (
        <div className="oq-prob-section">
          <div className="oq-section-label">key observations</div>
          <ul className="oq-constraints">
            {content.key_observations.slice(0, 3).map((obs, i) => (
              <li key={i}><span className="oq-mono" style={{ fontFamily: 'inherit', fontSize: 13 }}>{obs}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* Approach */}
      {content.algorithm_approach.summary && (
        <div className="oq-prob-section">
          <div className="oq-section-label">approach</div>
          <p className="oq-prob-text" style={{ fontSize: 13, lineHeight: 1.6 }}>
            {content.algorithm_approach.summary}
          </p>
        </div>
      )}
    </div>
  )
}

// ── History sidebar ───────────────────────────────────────────────────────────

function HistorySidebar() {
  const {
    historyOpen, history, activeId, historySearch,
    setHistoryOpen, setHistorySearch, setCurrentContent, setHistory,
  } = useAnalyzerStore()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  if (!historyOpen) return null

  const filtered = history.filter(h =>
    !historySearch ||
    (h.problem_title ?? h.problem_url).toLowerCase().includes(historySearch.toLowerCase()) ||
    (h.platform ?? '').toLowerCase().includes(historySearch.toLowerCase())
  )

  async function handleSelect(id: string, problemUrl: string) {
    if (loadingId) return
    setLoadingId(id)
    try {
      const result = await getAnalysis(id)
      if (result?.analysis) {
        setCurrentContent(result.analysis, result.problem_url ?? problemUrl, id)
      }
    } catch {
      // silently fail — keep existing content shown
    } finally {
      setLoadingId(null)
    }
  }

  async function loadMore() {
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const result = await listAnalyses(nextPage, 20)
      const newItems = result.items ?? []
      setHistory([...useAnalyzerStore.getState().history, ...newItems])
      setPage(nextPage)
      setHasMore(newItems.length === 20)
    } catch {
      // ignore
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <aside className="oq-history">
      <div className="oq-history-head">
        <div>
          <div className="oq-history-eyebrow oq-mono">razbors / history</div>
          <h3 className="oq-history-title">Recent</h3>
        </div>
        <button className="oq-icon-btn" onClick={() => setHistoryOpen(false)} title="Hide">×</button>
      </div>
      <div className="oq-history-search">
        <span className="oq-mono oq-dim">/</span>
        <input
          value={historySearch}
          onChange={e => setHistorySearch(e.target.value)}
          placeholder="filter by title or platform…"
          style={{ background: 'transparent', outline: 'none', border: 'none', flex: 1, fontSize: 12, color: 'var(--text)' }}
        />
      </div>
      <ul className="oq-history-list">
        {filtered.map(h => (
          <li
            key={h.id}
            className={cx(h.id === activeId && 'is-active', loadingId === h.id && 'is-loading')}
            onClick={() => handleSelect(h.id, h.problem_url)}
            style={{ opacity: loadingId && loadingId !== h.id ? 0.5 : 1, cursor: loadingId ? 'wait' : 'pointer' }}
          >
            <div className="oq-history-row1">
              <div className="oq-history-name">
                {loadingId === h.id
                  ? <span className="oq-dim oq-mono" style={{ fontSize: 11 }}>loading…</span>
                  : (h.problem_title ?? 'Unknown')
                }
              </div>
              <div className="oq-verdict" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', color: 'var(--text-faint)', flexShrink: 0 }}>
                {(h.platform ?? 'cf').toUpperCase()}
              </div>
            </div>
            <div className="oq-history-row2 oq-mono oq-dim">
              {new Date(h.created_at).toLocaleDateString()} · {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li style={{ color: 'var(--text-faint)', fontSize: 12, fontFamily: 'var(--font-mono)', padding: '16px 10px' }}>
            {history.length === 0 ? 'no analyses yet — analyze your first problem' : 'no matches'}
          </li>
        )}
        {!historySearch && hasMore && filtered.length > 0 && (
          <li style={{ padding: '10px 10px 6px' }}>
            <button
              onClick={e => { e.stopPropagation(); loadMore() }}
              disabled={loadingMore}
              style={{ width: '100%', padding: '5px 0', background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: loadingMore ? 'wait' : 'pointer' }}
            >
              {loadingMore ? 'loading…' : 'load more'}
            </button>
          </li>
        )}
      </ul>
    </aside>
  )
}

// ── Main Analyzer ─────────────────────────────────────────────────────────────

export default function Analyzer() {
  const store = useAnalyzerStore()
  const model = 'gemini-2.0-flash'

  // Prefetch config for future use
  useEffect(() => {
    axios.get('/api/v1/config').catch(() => {})
  }, [])

  // Load history once on mount (if not already loaded)
  useEffect(() => {
    if (store.history.length === 0) {
      listAnalyses().then(r => store.setHistory(r.items ?? [])).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnalyze = useCallback(async (e?: FormEvent) => {
    e?.preventDefault()
    const target = store.currentURL.trim()
    if (!target || store.analyzing) return

    const platform = detectPlatform(target)
    if (platform === 'other' && !target.startsWith('http')) {
      store.setError('Please paste a full URL starting with https://')
      return
    }

    store.setAnalyzing(true)
    store.setError('')
    try {
      const result = await analyzeProblem(target)
      if (result.analysis) {
        const updated = await listAnalyses()
        const items = updated.items ?? []
        store.setHistory(items)
        store.setCurrentContent(result.analysis, target, items[0]?.id ?? null)
      }
    } catch (e: unknown) {
      const msg = (e as any)?.response?.data?.error ?? ''
      if (msg.includes('quota') || msg.includes('rate limit')) {
        store.setError('AI quota exceeded — update your GEMINI_API_KEY in .env and restart Docker.')
      } else if (msg.includes('parse') || msg.includes('AI response')) {
        store.setError('AI response error — your GEMINI_API_KEY may be invalid. Get one at aistudio.google.com/apikey')
      } else if (msg.includes('url') || msg.includes('URL')) {
        store.setError('Invalid URL — paste a full Codeforces (codeforces.com) or LeetCode (leetcode.com) problem link.')
      } else {
        store.setError('Analysis failed — check your URL and Gemini API key, then try again.')
      }
    } finally {
      store.setAnalyzing(false)
    }
  }, [store])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAnalyze()
  }, [handleAnalyze])

  return (
    <div className="oq-page oq-analyzer" style={{ position: 'relative' }}>
      {/* URL bar */}
      <div className="oq-analyzer-bar">
        <div className="oq-urlbar">
          <span className="oq-mono oq-dim" style={{ fontSize: 11, flexShrink: 0 }}>razbor →</span>
          <input
            className="oq-url-input"
            value={store.currentURL}
            onChange={e => { store.setError(''); useAnalyzerStore.setState({ currentURL: e.target.value }) }}
            onKeyDown={handleKeyDown}
            placeholder="paste any codeforces.com or leetcode.com problem URL…"
          />
          <button
            className="oq-btn-primary"
            disabled={store.analyzing || !store.currentURL.trim()}
            onClick={() => handleAnalyze()}
            style={{ flexShrink: 0 }}
          >
            {store.analyzing
              ? <><span className="oq-cursor-block">▌</span> Analyzing…</>
              : '✦ Analyze'}
          </button>
        </div>

        {/* Platform badge — shows which platform was detected */}
        {store.currentURL && (
          <div className="oq-mono oq-dim" style={{ fontSize: 11, flexShrink: 0 }}>
            {detectPlatform(store.currentURL) === 'codeforces' && (
              <span style={{ color: 'var(--accent)' }}>● Codeforces</span>
            )}
            {detectPlatform(store.currentURL) === 'leetcode' && (
              <span style={{ color: 'var(--accent-2)' }}>● LeetCode</span>
            )}
          </div>
        )}
      </div>

      {/* Error banner */}
      {store.error && (
        <div style={{
          padding: '8px 18px',
          background: 'color-mix(in oklch, var(--err) 12%, transparent)',
          borderBottom: '1px solid color-mix(in oklch, var(--err) 30%, transparent)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11.5,
          color: 'var(--err)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          ⚠ {store.error}
          <button
            onClick={() => store.setError('')}
            style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: 14, cursor: 'pointer' }}
          >×</button>
        </div>
      )}

      {/* 2-column grid */}
      <div className="oq-analyzer-grid" style={{ flex: 1, minHeight: 0 }}>
        {/* Left: Problem pane */}
        <div className="oq-col oq-col-prob">
          {store.currentContent
            ? <ProblemPane content={store.currentContent} url={store.currentURL} />
            : (
              <div style={{ padding: '40px 28px', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                <div style={{ fontSize: 24, color: 'var(--accent)', marginBottom: 12 }}>▣</div>
                <div style={{ marginBottom: 8 }}>paste a problem URL and press <strong>✦ Analyze</strong></div>
                <div style={{ color: 'var(--text-faint)', opacity: 0.7 }}>
                  works with codeforces.com · leetcode.com
                </div>
              </div>
            )
          }
        </div>

        {/* Right: Razbor pane */}
        <div className="oq-col oq-col-razbor" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <RazborPane model={model} />
        </div>
      </div>

      {/* History sidebar overlay */}
      <HistorySidebar />

      {/* History tab (when sidebar closed) */}
      {!store.historyOpen && (
        <button className="oq-history-tab" onClick={() => store.setHistoryOpen(true)}>
          history{store.history.length > 0 ? ` (${store.history.length})` : ''} ›
        </button>
      )}
    </div>
  )
}
