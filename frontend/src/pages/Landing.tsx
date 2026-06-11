import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfile } from '../api/profile'
import { useAuthStore } from '../store/authStore'

// ── Scroll reveal — adds .is-in when an .oq-reveal element enters the viewport ──

// `ready` must be true only once the actual page content is in the DOM —
// during the session-check spinner there are no .oq-reveal elements yet, and
// an observer armed at that point would leave every section at opacity 0.
function useScrollReveal(ready: boolean) {
  useEffect(() => {
    if (!ready) return
    const els = Array.from(document.querySelectorAll('.oq-reveal'))
    if (els.length === 0) return
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [ready])
}

// ── Count-up number — animates 0 → value when it scrolls into view ──

function CountUp({ to, suffix = '', prefix = '' }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLElement>(null)
  const [val, setVal] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        if (reduced) { setVal(to); return }
        const start = performance.now()
        const dur = 1300
        const tick = (now: number) => {
          const p = Math.min((now - start) / dur, 1)
          const eased = 1 - Math.pow(1 - p, 3)
          setVal(Math.round(to * eased))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [to])

  return <strong ref={ref}>{prefix}{val.toLocaleString()}{suffix}</strong>
}

// ── Terminal demo — types a razbor session line by line, loops forever ──

const TERM_LINES: { text: string; cls: string }[] = [
  { text: '$ olympiq analyze codeforces.com/problemset/1842/C', cls: 't-acc' },
  { text: '→ fetching problem statement … ok', cls: 't-dim' },
  { text: '→ classification: Dynamic Programming · prefix optimization', cls: '' },
  { text: '→ difficulty: 1500 · confidence 92%', cls: '' },
  { text: '→ key observation: equal endpoints define deletable segments', cls: '' },
  { text: '→ generating progressive hints … 3 levels ready', cls: 't-dim' },
  { text: '→ similar problems: 4 found, sorted by relevance', cls: 't-dim' },
  { text: '✓ razbor ready — the approach, never the spoiler code', cls: 't-ok' },
]

function TerminalDemo() {
  const [chars, setChars] = useState(0)
  const total = TERM_LINES.reduce((n, l) => n + l.text.length, 0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) { setChars(total); return }
    const id = setInterval(() => {
      setChars(c => {
        if (c >= total) return c // finished — hold final frame
        return c + 1
      })
    }, 28)
    return () => clearInterval(id)
  }, [total])

  // Slice the full script into rendered lines based on typed char count
  let remaining = chars
  const rendered = TERM_LINES.map(line => {
    const take = Math.max(0, Math.min(line.text.length, remaining))
    remaining -= take
    return { ...line, shown: line.text.slice(0, take), done: take === line.text.length }
  })

  return (
    <div className="oq-l-term" aria-hidden="true">
      <div className="oq-l-term-head">
        <span className="oq-l-term-dot d-r" />
        <span className="oq-l-term-dot d-y" />
        <span className="oq-l-term-dot d-g" />
        <span className="oq-l-term-title">olympiq — razbor session</span>
      </div>
      <div className="oq-l-term-body">
        {rendered.map((l, i) =>
          l.shown ? (
            <div key={i} className={l.cls}>
              {l.shown}
              {!l.done && <span className="oq-cursor-block">▌</span>}
            </div>
          ) : null,
        )}
        {chars >= total && <span className="oq-cursor-block">▌</span>}
      </div>
    </div>
  )
}

// ── SVG icon set (Lucide-style, consistent 1.8 stroke) ──

const ic = {
  width: 17, height: 17, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round', strokeLinejoin: 'round',
} as const

const ICONS = {
  target: (
    <svg {...ic}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
  ),
  trend: (
    <svg {...ic}><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></svg>
  ),
  flame: (
    <svg {...ic}><path d="M12 3c1 3-1 4.5-2 6-1.2 1.8-1.5 3.6-.5 5.5A5.5 5.5 0 0 0 17.5 13c0-2-1-3.5-2-5-.6 1-1.3 1.6-2 2 .5-2.4 0-5-1.5-7z" /></svg>
  ),
  bell: (
    <svg {...ic}><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10.3 19a2 2 0 0 0 3.4 0" /></svg>
  ),
  briefcase: (
    <svg {...ic}><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></svg>
  ),
  bulb: (
    <svg {...ic}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 1 4 10.5c-.7.6-1 1.5-1 2.5h-6c0-1-.3-1.9-1-2.5A6 6 0 0 1 12 3z" /></svg>
  ),
}

// ── Static content ──

const CAPABILITIES = [
  { icon: ICONS.target, title: 'Weak-topic detection', sub: 'Your solved history is mapped tag by tag. The gaps become your plan — not someone else’s generic list.' },
  { icon: ICONS.trend, title: 'Rating trajectory analysis', sub: 'Last 24 contests, delta by delta. The AI knows whether you’re climbing, stuck, or tilting.' },
  { icon: ICONS.flame, title: 'Activity calendar & streaks', sub: 'A 36-week GitHub-style heatmap of every submission, plus your current solving streak.' },
  { icon: ICONS.bell, title: 'Goals & notifications', sub: 'Set a target rating and date. Get daily problems, weekly digests, and level-up alerts.' },
  { icon: ICONS.briefcase, title: 'Interview prep mode', sub: 'A separate track built around SWE interview patterns — sliding window, two pointers, BFS grids.' },
  { icon: ICONS.bulb, title: 'Progressive hints', sub: 'Three levels: a nudge, a direction, an approach. You decide how much help you take.' },
]

const STEPS = [
  { title: 'Create an account', sub: 'Email, username, password. No card, no trial timer — 30 seconds.' },
  { title: 'Link your handles', sub: 'Connect Codeforces and LeetCode. We pull your full public history: ratings, contests, every accepted submission.' },
  { title: 'AI builds your plan', sub: 'Three agents analyze your level and gaps, then assemble a roadmap calibrated 100–200 points above where you are.' },
  { title: 'Solve & track', sub: 'Every problem links to the original platform. You solve there — your dashboard updates here.' },
]

const GOALS = [
  { title: 'Kill "what should I solve next?"', sub: 'The hardest part of competitive programming isn’t the math — it’s the navigation. Every session should start with a concrete, justified next problem. We make that decision for you, with reasons.' },
  { title: 'Teach the approach, never spoil', sub: 'A pasted solution teaches nothing. Razbor explains classification, observations, and complexity — then sends you back to the judge to earn the AC yourself.' },
  { title: 'From first AC to Candidate Master', sub: 'Structured training shouldn’t be a privilege of students with private coaches. We’re building the coach that scales to everyone.' },
]

const FAQ = [
  { q: 'Is OlympIQ free?', a: 'Yes. Create an account, connect your handles, and the analyzer, roadmap, and recommender are all available. No card required.' },
  { q: 'Do I need both Codeforces and LeetCode?', a: 'No — one is enough. Connect whichever you train on; the AI builds its picture from what’s available. With both connected, recommendations get noticeably sharper.' },
  { q: 'Will it show me solutions?', a: 'Never. That’s a hard rule in the system. Razbor gives you the problem type, the key observations, progressive hints, and the complexity analysis — but the code is yours to write. You solve on the original platform.' },
  { q: 'How does the AI know my level?', a: 'It reads your real data: current and max rating, your last 500 Codeforces submissions, contest history, and your LeetCode skill breakdown. Plans are generated from that snapshot — never from a template.' },
  { q: 'Is my data safe?', a: 'We only read public competitive-programming profiles — the same data anyone can see on your CF page. Passwords are bcrypt-hashed, sessions use httpOnly cookies, and you can delete your account and all data at any time.' },
]

const MARQUEE_TOPICS = [
  'dynamic programming', 'graphs', 'binary search', 'greedy', 'two pointers',
  'data structures', 'number theory', 'combinatorics', 'dfs & bfs', 'shortest paths',
  'bitmasks', 'segment trees', 'strings', 'math', 'constructive algorithms',
]

// ── Page ──

export default function Landing() {
  const { user, setUser } = useAuthStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Session check via GET /profile — never /auth/refresh here (it rotates the
    // token and is rate-limited to 10/min; the 401 interceptor refreshes once).
    // The landing always renders: logged-in visitors just get a "Dashboard"
    // button in the nav instead of being forced away from the page.
    if (user) { setChecking(false); return }
    getProfile()
      .then(u => setUser(u))
      .catch(() => {})
      .finally(() => setChecking(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useScrollReveal(!checking || !!user)

  if (checking && !user) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
          <span style={{ color: 'var(--accent)', marginRight: 8 }}>◇</span>loading…
        </div>
      </div>
    )
  }

  const marquee = [...MARQUEE_TOPICS, ...MARQUEE_TOPICS]

  return (
    <div className="oq-landing">

      {/* ── Nav ── */}
      <nav className="oq-landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--accent)', fontSize: 20 }}>◇</span>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>OlympIQ</span>
        </div>
        <div className="oq-l-nav-links">
          <a className="oq-l-nav-link" href="#features">Features</a>
          <a className="oq-l-nav-link" href="#how">How it works</a>
          <a className="oq-l-nav-link" href="#about">About</a>
          <a className="oq-l-nav-link" href="#faq">FAQ</a>
          {user ? (
            <Link to="/dashboard" className="oq-btn-primary">Dashboard →</Link>
          ) : (
            <>
              <Link to="/login" className="oq-btn-ghost">Sign in</Link>
              <Link to="/register" className="oq-btn-primary">Start for free →</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="oq-l-hero">
        <div className="oq-l-grid-bg" />
        <div className="oq-l-orb" style={{ width: 420, height: 420, top: -120, left: '8%', background: 'var(--accent)' }} />
        <div className="oq-l-orb" style={{ width: 360, height: 360, top: 60, right: '4%', background: 'var(--accent-2)', animationDelay: '-7s' }} />

        <div className="oq-l-hero-inner">
          <div>
            <div className="oq-l-badge">
              <span className="oq-dot oq-dot-busy" />
              AI coach · live on Codeforces &amp; LeetCode
            </div>
            <h1 className="oq-l-h1">
              Stop guessing.<br />
              Train like it&apos;s <span className="oq-l-grad-text">engineered.</span>
            </h1>
            <p className="oq-l-sub">
              OlympIQ reads your entire competitive-programming history — every rating change,
              every accepted submission — and turns it into a personal, problem-by-problem
              training plan. Built for the student who knows <em>how</em> to practice,
              but not <em>what to do next</em>.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/register" className="oq-btn-primary oq-btn-lg">Start training free →</Link>
              <a href="#features" className="oq-btn-ghost oq-btn-lg">Explore the platform ↓</a>
            </div>

            <div className="oq-l-stats">
              <div className="oq-l-stat">
                <CountUp to={10000} suffix="+" />
                <span>problems indexed</span>
              </div>
              <div className="oq-l-stat">
                <CountUp to={37} />
                <span>topics tracked</span>
              </div>
              <div className="oq-l-stat">
                <CountUp to={3} />
                <span>AI agents</span>
              </div>
              <div className="oq-l-stat">
                <strong>&lt;30s</strong>
                <span>to first roadmap</span>
              </div>
            </div>
          </div>

          <TerminalDemo />
        </div>
      </header>

      {/* ── Topic marquee ── */}
      <div className="oq-l-marquee" aria-hidden="true">
        <div className="oq-l-marquee-track">
          {marquee.map((t, i) => (
            <span key={i}><b>#</b> {t}</span>
          ))}
        </div>
      </div>

      {/* ── Capabilities ── */}
      <section id="features" className="oq-l-section oq-l-section-pad">
        <div className="oq-l-center oq-reveal">
          <div className="oq-l-eyebrow">the platform</div>
          <h2 className="oq-l-h2">Everything between you and your next rank</h2>
          <p className="oq-l-lead">
            One dashboard replaces the spreadsheet, the bookmarked blog posts, and the
            &quot;just solve more problems&quot; advice.
          </p>
        </div>

        <div className="oq-l-caps">
          {CAPABILITIES.map((c, i) => (
            <div key={c.title} className="oq-l-cap oq-reveal" style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
              <div className="oq-l-cap-icon">{c.icon}</div>
              <h4>{c.title}</h4>
              <p>{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Deep dives ── */}
      <section className="oq-l-section">
        {/* Razbor */}
        <div className="oq-l-row">
          <div className="oq-reveal">
            <div className="oq-l-row-kicker">01 · razbor</div>
            <h3>Understand any problem — without spoiling it</h3>
            <p>
              Paste a Codeforces or LeetCode URL. The analyzer classifies the problem,
              surfaces the key observations, and walks you through the solution logic
              step by step. The one thing it will never give you: the code.
            </p>
            <ul>
              <li><span className="oq-l-check">✓</span> Problem type, subtype, and calibrated difficulty</li>
              <li><span className="oq-l-check">✓</span> Three levels of progressive hints — you control the spoiler depth</li>
              <li><span className="oq-l-check">✓</span> Time &amp; space complexity with TLE pitfalls</li>
              <li><span className="oq-l-check">✓</span> Similar problems for follow-up practice, with links</li>
            </ul>
            <Link to="/register" className="oq-btn-ghost">Try the analyzer →</Link>
          </div>
          <div className="oq-l-row-media oq-reveal" style={{ transitionDelay: '120ms' }}>
            <div className="oq-l-mock" aria-hidden="true">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span className="oq-pill oq-pill-accent">Dynamic Programming</span>
                <span className="oq-rating-pill r-15 small">1500</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>confidence 92%</span>
              </div>
              <div className="oq-confidence" style={{ maxWidth: 'none', marginBottom: 16 }}>
                <div className="oq-confidence-fill" style={{ width: '92%' }} />
              </div>
              {['Hint 1 — a gentle nudge', 'Hint 2 — the right structure', 'Hint 3 — the approach'].map((h, i) => (
                <div key={h} className="oq-l-mock-row">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: i === 0 ? 'var(--accent)' : 'var(--text-faint)' }}>
                    {i === 0 ? '−' : '+'}
                  </span>
                  <div className="oq-l-mock-title">
                    {h}
                    {i === 0 && <div className="oq-l-mock-sub">think about what happens at the segment endpoints…</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Roadmap */}
        <div className="oq-l-row is-flip">
          <div className="oq-reveal">
            <div className="oq-l-row-kicker">02 · roadmap</div>
            <h3>A plan that knows what you solved last week</h3>
            <p>
              Set a target — 1900 by September, or interview-ready by spring. The AI reads
              your live stats and lays out the weeks: themes, focus topics, and specific
              problems, each one 100–200 rating points above your comfort zone.
            </p>
            <ul>
              <li><span className="oq-l-check">✓</span> Weekly, by-topic, and interview-prep views</li>
              <li><span className="oq-l-check">✓</span> Every problem has a personalized one-line reason</li>
              <li><span className="oq-l-check">✓</span> Progress bars, streaks, and milestone tracking</li>
              <li><span className="oq-l-check">✓</span> Regenerates as your rating moves</li>
            </ul>
            <Link to="/register" className="oq-btn-ghost">Build your roadmap →</Link>
          </div>
          <div className="oq-l-row-media oq-reveal" style={{ transitionDelay: '120ms' }}>
            <div className="oq-l-mock" aria-hidden="true">
              {[
                { w: 'Week 1', theme: 'Binary search on answer', pct: 100, state: 'done' },
                { w: 'Week 2', theme: 'DP on prefixes', pct: 60, state: 'current' },
                { w: 'Week 3', theme: 'Graphs: BFS layers', pct: 0, state: '' },
                { w: 'Week 4', theme: 'Two pointers + sorting', pct: 0, state: '' },
              ].map(r => (
                <div key={r.w} className="oq-l-mock-row" style={r.state === 'current' ? { borderColor: 'color-mix(in oklch, var(--accent) 45%, var(--line))' } : undefined}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: r.state === 'current' ? 'var(--accent)' : 'var(--text-faint)', width: 48, flexShrink: 0 }}>{r.w}</span>
                  <div className="oq-l-mock-title">
                    {r.theme}
                    <div className="oq-topic-track" style={{ marginTop: 6 }}>
                      <div className="oq-topic-fill" style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: r.pct === 100 ? 'var(--ok)' : 'var(--text-faint)', flexShrink: 0 }}>
                    {r.pct === 100 ? '✓ done' : `${r.pct}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommender */}
        <div className="oq-l-row">
          <div className="oq-reveal">
            <div className="oq-l-row-kicker">03 · recommender</div>
            <h3>Ten problems. Zero you&apos;ve already solved.</h3>
            <p>
              The recommender filters against your full accepted-submission history, then
              picks unsolved problems that target your weakest tags — 60% at your level
              for confidence, 40% above it for growth.
            </p>
            <ul>
              <li><span className="oq-l-check">✓</span> Already-solved problems are filtered out, always</li>
              <li><span className="oq-l-check">✓</span> Filter by topic and platform in one click</li>
              <li><span className="oq-l-check">✓</span> Each pick explains <em>why it&apos;s for you</em>, referencing your stats</li>
            </ul>
            <Link to="/register" className="oq-btn-ghost">Get recommendations →</Link>
          </div>
          <div className="oq-l-row-media oq-reveal" style={{ transitionDelay: '120ms' }}>
            <div className="oq-l-mock" aria-hidden="true">
              {[
                { t: 'Maximum Subarray Sum II', why: 'your dp tag is 40% below peers at 1500', r: '1600', cls: 'r-16' },
                { t: 'Edge Disjoint Paths', why: 'graphs is your weakest area — 12 solved', r: '1700', cls: 'r-17' },
                { t: 'Two Pointer Partition', why: 'confidence pick at your current level', r: '1400', cls: 'r-14' },
              ].map(p => (
                <div key={p.t} className="oq-l-mock-row">
                  <div className="oq-l-mock-title">
                    {p.t}
                    <div className="oq-l-mock-sub">{p.why}</div>
                  </div>
                  <span className={`oq-rating-pill small ${p.cls}`}>{p.r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="oq-l-section oq-l-section-pad">
        <div className="oq-l-center oq-reveal">
          <div className="oq-l-eyebrow">how it works</div>
          <h2 className="oq-l-h2">From sign-up to a real plan in four steps</h2>
        </div>
        <div className="oq-l-steps">
          {STEPS.map((s, i) => (
            <div key={s.title} className="oq-l-step oq-reveal" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="oq-l-step-num">{i + 1}</div>
              <h4>{s.title}</h4>
              <p>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Rank journey */}
        <div className="oq-l-ladder oq-reveal" style={{ transitionDelay: '120ms' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 650 }}>The journey we&apos;re built for</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>codeforces rating scale</div>
          </div>
          <div className="oq-l-ladder-track" />
          <div className="oq-l-ranks">
            <div className="oq-l-rank r-newbie"><b>Newbie</b><span>&lt; 1200</span></div>
            <div className="oq-l-rank r-pupil"><b>Pupil</b><span>1200+</span></div>
            <div className="oq-l-rank r-specialist"><b>Specialist</b><span>1400+</span></div>
            <div className="oq-l-rank r-expert"><b>Expert</b><span>1600+</span></div>
            <div className="oq-l-rank r-cm"><b>Candidate Master</b><span>1900+</span></div>
            <div className="oq-l-rank r-master"><b>Master</b><span>2100+</span></div>
            <div className="oq-l-rank r-gm"><b>Grandmaster</b><span>2400+</span></div>
          </div>
        </div>
      </section>

      {/* ── About / mission ── */}
      <section id="about" className="oq-l-section oq-l-section-pad">
        <div className="oq-l-center oq-reveal">
          <div className="oq-l-eyebrow">about olympiq</div>
          <h2 className="oq-l-h2">Built by competitive programmers,<br />for competitive programmers</h2>
          <p className="oq-l-lead">
            Every strong competitive programmer hits the same wall: the plateau where
            &quot;solve more problems&quot; stops working. Coaches solve it with curated problem
            sets and honest feedback — but coaches don&apos;t scale. OlympIQ is our answer:
            an AI training system with the judgment of a coach and the patience of a machine,
            reading your real Codeforces and LeetCode data instead of guessing.
          </p>
        </div>

        <div className="oq-l-goals">
          {GOALS.map((g, i) => (
            <div key={g.title} className="oq-l-goal oq-reveal" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="oq-l-goal-num">goal / 0{i + 1}</div>
              <h4>{g.title}</h4>
              <p>{g.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="oq-l-section oq-l-section-pad">
        <div className="oq-l-center oq-reveal">
          <div className="oq-l-eyebrow">faq</div>
          <h2 className="oq-l-h2">Questions, answered</h2>
        </div>
        <div className="oq-l-faq oq-reveal" style={{ transitionDelay: '90ms' }}>
          {FAQ.map(f => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <div className="oq-l-faq-body">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="oq-l-cta oq-reveal">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, color: 'var(--accent)', marginBottom: 18 }}>◇</div>
        <h2>Your next rating starts with the next problem.</h2>
        <p>Connect your Codeforces account and get a personalized plan in under 30 seconds.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="oq-btn-primary oq-btn-lg">Create your free account →</Link>
          <Link to="/login" className="oq-btn-ghost oq-btn-lg">I already have one</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="oq-l-footer">
        <div className="oq-l-footer-grid">
          <div className="oq-l-footer-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ color: 'var(--accent)', fontSize: 18 }}>◇</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>OlympIQ</span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.7, maxWidth: '32ch' }}>
              AI-powered training for competitive programmers.
              Analyze, plan, and climb — from your first AC to Candidate Master.
            </p>
          </div>
          <div className="oq-l-footer-col">
            <h5>Product</h5>
            <a href="#features">Problem Analyzer</a>
            <a href="#features">AI Roadmap</a>
            <a href="#features">Recommender</a>
            <a href="#how">How it works</a>
          </div>
          <div className="oq-l-footer-col">
            <h5>Platforms</h5>
            <a href="https://codeforces.com" target="_blank" rel="noopener noreferrer">Codeforces ↗</a>
            <a href="https://leetcode.com" target="_blank" rel="noopener noreferrer">LeetCode ↗</a>
          </div>
          <div className="oq-l-footer-col">
            <h5>Account</h5>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Create account</Link>
          </div>
        </div>
        <div className="oq-l-footer-bottom">
          <span>© 2026 OlympIQ — built for competitive programmers</span>
          <span>codeforces · leetcode · ai workflows</span>
        </div>
      </footer>
    </div>
  )
}
