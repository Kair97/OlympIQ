// shared/app.jsx — OlympIQ interactive prototype shell.
// Reads theme & layout from CSS variables; works inside any wrapper that
// defines them. Exposes window.mountOlympIQ(rootEl, opts).

const { useState, useEffect, useRef, useMemo, useCallback } = React;
const D = () => window.OLYMPIQ_DATA;

// ────────────────────────────── tiny utils ──────────────────────────────

function cx(...xs) { return xs.filter(Boolean).join(" "); }

function useTickStream(fullText, opts = {}) {
  const { stepMs = 14, chunk = 3 } = opts;
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);
  const stopRef = useRef(false);
  useEffect(() => {
    stopRef.current = false;
    setOut(""); setDone(false);
    let i = 0;
    const id = setInterval(() => {
      if (stopRef.current) { clearInterval(id); return; }
      i = Math.min(fullText.length, i + chunk);
      setOut(fullText.slice(0, i));
      if (i >= fullText.length) { clearInterval(id); setDone(true); }
    }, stepMs);
    return () => { stopRef.current = true; clearInterval(id); };
  }, [fullText, stepMs, chunk]);
  return [out, done];
}

// ─────────────────────────── syntax highlighter ──────────────────────────

const CPP_KW = new Set("auto break case char class const continue default delete do double else enum extern float for if inline int long namespace new operator private protected public return short signed sizeof static struct switch template this typedef typename union unsigned using virtual void volatile while bool true false nullptr".split(" "));
const CPP_STD = new Set("vector string map set unordered_map unordered_set pair queue stack deque priority_queue array tuple bitset cout cin endl size_t int64_t ios_base sync_with_stdio tie".split(" "));
const PY_KW  = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" "));
const PY_BI  = new Set("print range len map int str list tuple dict set sum min max abs sorted reversed enumerate zip input open".split(" "));

function tokenize(src, lang) {
  // Returns array of {t, k} where k ∈ {kw,std,num,str,com,pre,op,id,ws}
  const out = [];
  const re = /(\s+)|(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|(#\s*\w+)|([A-Za-z_][\w]*)|([{}()\[\];,.<>+\-*/=&|!?:^%~])|(.)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[1]) out.push({ t: m[1], k: "ws" });
    else if (m[2]) out.push({ t: m[2], k: "com" });
    else if (m[3]) out.push({ t: m[3], k: "str" });
    else if (m[4]) out.push({ t: m[4], k: "num" });
    else if (m[5]) out.push({ t: m[5], k: "pre" });
    else if (m[6]) {
      const w = m[6];
      let k = "id";
      if (lang === "cpp")    { if (CPP_KW.has(w)) k = "kw"; else if (CPP_STD.has(w)) k = "std"; }
      if (lang === "python") { if (PY_KW.has(w))  k = "kw"; else if (PY_BI.has(w))  k = "std"; }
      out.push({ t: w, k });
    }
    else if (m[7]) out.push({ t: m[7], k: "op" });
    else out.push({ t: m[0], k: "id" });
  }
  return out;
}

function CodeView({ code, lang, fontSize = 13 }) {
  const lines = code.split("\n");
  return (
    <pre className="oq-codeview" style={{ fontSize }}>
      {lines.map((ln, i) => {
        const toks = tokenize(ln, lang);
        return (
          <div className="oq-codeline" key={i}>
            <span className="oq-gutter">{String(i + 1).padStart(2, " ")}</span>
            <span className="oq-codecontent">
              {toks.length === 0 ? <span>&nbsp;</span> :
                toks.map((tk, j) => (
                  <span key={j} className={`tk-${tk.k}`}>{tk.t}</span>
                ))
              }
            </span>
          </div>
        );
      })}
    </pre>
  );
}

// ────────────────────────────── sidebar nav ──────────────────────────────

function SideNav({ page, onPage, direction }) {
  const items = [
    { id: "dashboard", label: "Dashboard", glyph: "◐" },
    { id: "analyzer", label: "Analyzer",  glyph: "▣" },
    { id: "roadmap",  label: "Roadmap",   glyph: "↗" },
    { id: "profile",  label: "Profile",   glyph: "○" },
  ];
  return (
    <nav className="oq-sidenav">
      <div className="oq-brand">
        <span className="oq-brand-mark">◇</span>
        <span className="oq-brand-name">OlympIQ</span>
        <span className="oq-brand-tag">{direction}</span>
      </div>
      <div className="oq-nav-section">
        <div className="oq-nav-label">workspace</div>
        {items.map(it => (
          <button
            key={it.id}
            onClick={() => onPage(it.id)}
            className={cx("oq-nav-item", page === it.id && "is-active")}
          >
            <span className="oq-nav-glyph">{it.glyph}</span>
            <span>{it.label}</span>
            {page === it.id && <span className="oq-nav-marker">›</span>}
          </button>
        ))}
      </div>
      <div className="oq-nav-section">
        <div className="oq-nav-label">connected</div>
        <div className="oq-conn">
          <span className="oq-dot oq-dot-ok"></span>
          <span>codeforces</span>
          <span className="oq-handle">@kael_solver</span>
        </div>
        <div className="oq-conn">
          <span className="oq-dot oq-dot-ok"></span>
          <span>leetcode</span>
          <span className="oq-handle">@kael</span>
        </div>
      </div>
      <div className="oq-nav-foot">
        <div className="oq-user">
          <div className="oq-avatar">K</div>
          <div>
            <div className="oq-user-name">kael.solver</div>
            <div className="oq-user-meta">Expert · 1847</div>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────── dashboard ──────────────────────────────

function Spark({ data, width = 220, height = 56, accent = "var(--accent)" }) {
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 4 - ((v - min) / span) * (height - 8);
    return [x, y];
  });
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = d + ` L${pts[pts.length-1][0]},${height} L${pts[0][0]},${height} Z`;
  return (
    <svg width={width} height={height} className="oq-spark">
      <path d={area} fill={accent} opacity="0.12" />
      <path d={d} fill="none" stroke={accent} strokeWidth="1.6" />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.5" fill={accent} />
    </svg>
  );
}

function PlatformCard({ name, p, accent }) {
  return (
    <div className="oq-platcard">
      <div className="oq-platcard-head">
        <div className="oq-platcard-name">{name}</div>
        <div className="oq-platcard-handle">@{p.handle}</div>
      </div>
      <div className="oq-platcard-grid">
        <div>
          <div className="oq-stat-num">{p.rating}</div>
          <div className="oq-stat-lbl">rating · peak {p.peak}</div>
        </div>
        <div>
          <div className="oq-stat-num">{p.solved}</div>
          <div className="oq-stat-lbl">problems · {p.contests} contests</div>
        </div>
      </div>
      <div className="oq-platcard-foot">
        <Spark data={p.history} accent={accent} />
        <div className="oq-rank-badge">{p.rank}</div>
      </div>
    </div>
  );
}

function TopicBars({ items }) {
  return (
    <div className="oq-topics">
      {items.map(t => (
        <div key={t.topic} className="oq-topic-row">
          <div className="oq-topic-name">{t.topic}</div>
          <div className="oq-topic-track">
            <div className="oq-topic-fill" style={{ width: (t.strength * 100).toFixed(0) + "%" }} />
          </div>
          <div className="oq-topic-num">{t.solved}</div>
        </div>
      ))}
    </div>
  );
}

function Heatmap({ grid }) {
  return (
    <div className="oq-heat">
      {grid.map((row, ri) => (
        <div className="oq-heat-row" key={ri}>
          {row.map((v, ci) => (
            <div key={ci} className={`oq-heat-cell heat-${v}`} title={`d${ri} h${ci}: ${v}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Dashboard({ onOpenProblem }) {
  const d = D().DASHBOARD;
  return (
    <div className="oq-page oq-dash">
      <header className="oq-page-head">
        <div>
          <div className="oq-page-eyebrow">overview · synced 2 min ago</div>
          <h1 className="oq-page-title">Welcome back, kael.</h1>
          <p className="oq-page-sub">
            You're 153 points from Candidate Master.
            <span className="oq-dim"> Three problems solved today, two to hit your goal.</span>
          </p>
        </div>
        <div className="oq-streak">
          <div className="oq-streak-num">{d.streak.current}</div>
          <div className="oq-streak-lbl">day streak<br/><span className="oq-dim">best · {d.streak.best}</span></div>
        </div>
      </header>

      <section className="oq-grid-2">
        <PlatformCard name="Codeforces" p={d.platforms.codeforces} accent="var(--accent)" />
        <PlatformCard name="LeetCode"   p={d.platforms.leetcode}   accent="var(--accent-2)" />
      </section>

      <section className="oq-grid-3">
        <div className="oq-panel">
          <div className="oq-panel-head">
            <h3>Topic mastery</h3>
            <span className="oq-dim">last 90 days</span>
          </div>
          <TopicBars items={d.byTopic} />
        </div>
        <div className="oq-panel">
          <div className="oq-panel-head">
            <h3>Activity</h3>
            <span className="oq-dim">7 days × 24 hours</span>
          </div>
          <Heatmap grid={d.activity} />
          <div className="oq-heat-legend">
            <span className="oq-dim">less</span>
            {[0,1,2,3,4].map(i => <div key={i} className={`oq-heat-cell heat-${i}`} />)}
            <span className="oq-dim">more</span>
          </div>
        </div>
        <div className="oq-panel">
          <div className="oq-panel-head">
            <h3>Recommended next</h3>
            <span className="oq-dim">tuned by AI</span>
          </div>
          <ul className="oq-reco">
            {d.recommended.map(r => (
              <li key={r.code} onClick={onOpenProblem}>
                <div>
                  <div className="oq-reco-title">{r.title}</div>
                  <div className="oq-reco-why">{r.why}</div>
                </div>
                <div className="oq-reco-rating">{r.rating}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────── analyzer ───────────────────────────────

function ProblemPane({ p }) {
  const L = D().PLATFORM_LINKS[p.source](p);
  return (
    <div className="oq-prob">
      <div className="oq-prob-head">
        <div>
          <div className="oq-prob-source">
            <span>{p.source}</span><span className="oq-dim"> · </span><span>{p.code}</span>
          </div>
          <h2 className="oq-prob-title">{p.title}</h2>
        </div>
        <div className={cx("oq-rating-pill", `r-${Math.min(35, Math.floor(p.rating/100))}`)}>{p.rating}</div>
      </div>
      <div className="oq-tags">
        {p.tags.map(t => <a key={t} href={L.tagSearch(t)} target="_blank" rel="noopener" className="oq-tag">{t}</a>)}
      </div>

      <div className="oq-actions">
        <a href={L.problem} target="_blank" rel="noopener" className="oq-btn-primary oq-btn-lg">
          Open on {p.source} ↗
        </a>
        <a href={L.editorial} target="_blank" rel="noopener" className="oq-btn-ghost oq-btn-lg">
          Editorial ↗
        </a>
        <a href={L.submit} target="_blank" rel="noopener" className="oq-btn-ghost oq-btn-lg">
          Submit ↗
        </a>
      </div>
      <div className="oq-actions-note oq-mono oq-dim">
        you solve on {p.source.toLowerCase()} · olympIQ analyzes only
      </div>

      <div className="oq-prob-section">
        <div className="oq-section-label">statement</div>
        <p className="oq-prob-text">{p.statement}</p>
      </div>
      <div className="oq-prob-section">
        <div className="oq-section-label">constraints</div>
        <ul className="oq-constraints">
          {p.constraints.map((c, i) => <li key={i}><span className="oq-mono">{c}</span></li>)}
        </ul>
      </div>
      <div className="oq-prob-section">
        <div className="oq-section-label">samples</div>
        <div className="oq-samples">
          {p.samples.map((s, i) => (
            <div className="oq-sample" key={i}>
              <div className="oq-sample-head"><span>input</span><span className="oq-dim">#{i+1}</span></div>
              <pre>{s.in}</pre>
              <div className="oq-sample-head"><span>output</span></div>
              <pre>{s.out}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RazborTab({ active, label, onClick }) {
  return <button className={cx("oq-razbor-tab", active && "is-active")} onClick={onClick}>{label}</button>;
}

function RazborPane({ phase, onAnalyze }) {
  // phase: idle | streaming-N | done
  const r = D().RAZBOR_STREAM;
  const [tab, setTab] = useState("all");
  const [revealedHints, setRevealedHints] = useState(0);

  // Decide which sections have appeared.
  // streaming-1 -> classification, 2 -> observations, 3 -> hints, 4 -> steps, 5 -> complexity, 6 -> similar
  const stage = useMemo(() => {
    if (phase === "idle") return 0;
    if (phase === "done") return 6;
    return parseInt(phase.split("-")[1], 10) || 0;
  }, [phase]);

  if (phase === "idle") {
    return (
      <div className="oq-razbor-empty">
        <div className="oq-razbor-empty-glyph">✦</div>
        <div className="oq-razbor-empty-title">No razbor yet</div>
        <div className="oq-razbor-empty-sub">
          Press <kbd>Analyze</kbd> to get a full breakdown — classification, observations,
          a progressive hint ladder, the worked algorithm, complexity, and related problems.
        </div>
        <button className="oq-btn-primary oq-razbor-empty-cta" onClick={onAnalyze}>
          ✦ Analyze this problem
        </button>
        <div className="oq-razbor-empty-meta oq-mono">
          <div><span className="oq-dim">model</span>  claude-sonnet-4</div>
          <div><span className="oq-dim">cost</span>   ~4.1k tokens</div>
          <div><span className="oq-dim">budget</span>  18 / 50 today</div>
        </div>
      </div>
    );
  }

  return (
    <div className="oq-razbor">
      <div className="oq-razbor-tabs">
        <RazborTab active={tab==="all"} label="All" onClick={() => setTab("all")} />
        <RazborTab active={tab==="hints"} label="Hints only" onClick={() => setTab("hints")} />
        <RazborTab active={tab==="solution"} label="Walkthrough" onClick={() => setTab("solution")} />
        <div className="oq-razbor-tab-spacer" />
        <span className="oq-razbor-status oq-mono">
          {phase === "done"
            ? <><span className="oq-dot oq-dot-ok"></span> done · 4.1k tok</>
            : <><span className="oq-dot oq-dot-busy"></span> streaming…</>}
        </span>
      </div>

      <div className="oq-razbor-scroll">
        {/* classification */}
        {stage >= 1 && (tab === "all" || tab === "solution") && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">01</span> Classification</div>
            <div className="oq-classify">
              <div className="oq-classify-row">
                <span className="oq-rs-key">type</span>
                <span className="oq-pill oq-pill-accent">{r.classification.type}</span>
              </div>
              <div className="oq-classify-row">
                <span className="oq-rs-key">difficulty</span>
                <span className="oq-mono">{r.classification.difficulty}</span>
              </div>
              <div className="oq-classify-row">
                <span className="oq-rs-key">confidence</span>
                <div className="oq-confidence">
                  <div className="oq-confidence-fill" style={{ width: (r.classification.confidence * 100) + "%" }} />
                </div>
                <span className="oq-mono">{Math.round(r.classification.confidence * 100)}%</span>
              </div>
            </div>
          </section>
        )}

        {/* observations */}
        {stage >= 2 && (tab === "all" || tab === "solution") && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">02</span> Key observations</div>
            <ol className="oq-rs-list">
              {r.observations.map((o, i) => <li key={i}>{o}</li>)}
            </ol>
          </section>
        )}

        {/* hints */}
        {stage >= 3 && (tab === "all" || tab === "hints") && (
          <section className="oq-rs">
            <div className="oq-rs-head">
              <span className="oq-rs-marker">03</span> Hint ladder
              <span className="oq-rs-aside oq-dim">{revealedHints}/3 revealed</span>
            </div>
            <div className="oq-hints">
              {r.hints.map((h, i) => {
                const open = i < revealedHints;
                return (
                  <div key={i} className={cx("oq-hint", open && "is-open")}>
                    <button
                      className="oq-hint-head"
                      onClick={() => setRevealedHints(open ? i : i + 1)}
                    >
                      <span className="oq-hint-level">Hint {h.level}</span>
                      <span className="oq-hint-toggle oq-mono">{open ? "[hide]" : "[reveal]"}</span>
                    </button>
                    <div className="oq-hint-body">
                      {open ? h.text : <span className="oq-dim oq-mono">{"·".repeat(48)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* steps */}
        {stage >= 4 && (tab === "all" || tab === "solution") && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">04</span> Algorithm — step by step</div>
            <ol className="oq-steps">
              {r.steps.map((s, i) => (
                <li key={i}>
                  <span className="oq-step-num oq-mono">{String(i+1).padStart(2,"0")}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* complexity */}
        {stage >= 5 && (tab === "all" || tab === "solution") && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">05</span> Complexity</div>
            <div className="oq-complexity">
              <div className="oq-cx">
                <div className="oq-cx-lbl">time</div>
                <div className="oq-cx-val oq-mono">{r.complexity.time}</div>
              </div>
              <div className="oq-cx">
                <div className="oq-cx-lbl">space</div>
                <div className="oq-cx-val oq-mono">{r.complexity.space}</div>
              </div>
              <div className="oq-cx oq-cx-note">{r.complexity.note}</div>
            </div>
          </section>
        )}

        {/* similar */}
        {stage >= 6 && (tab === "all" || tab === "solution") && (
          <section className="oq-rs">
            <div className="oq-rs-head"><span className="oq-rs-marker">06</span> Similar to practice</div>
            <ul className="oq-similar">
              {r.similar.map(s => (
                <li key={s.code}>
                  <div className="oq-similar-main">
                    <div className="oq-similar-code oq-mono">{s.code}</div>
                    <div className="oq-similar-title">{s.title}</div>
                  </div>
                  <div className="oq-similar-meta">
                    <div className="oq-similar-tags">{s.tags.join(" · ")}</div>
                    <div className={cx("oq-rating-pill", "small", `r-${Math.min(35, Math.floor(s.rating/100))}`)}>{s.rating}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {phase !== "idle" && phase !== "done" && (
          <div className="oq-stream-cursor"><span className="oq-cursor-block">▌</span></div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────── history sidebar ───────────────────────────

function HistorySidebar({ open, items, activeId, onPick, onClose }) {
  if (!open) return null;
  return (
    <aside className="oq-history">
      <div className="oq-history-head">
        <div>
          <div className="oq-history-eyebrow oq-mono">razbors / history</div>
          <h3 className="oq-history-title">Recent</h3>
        </div>
        <button className="oq-icon-btn" onClick={onClose} title="Hide">×</button>
      </div>
      <div className="oq-history-search">
        <span className="oq-mono oq-dim">/</span>
        <input placeholder="filter by title or tag…" />
      </div>
      <ul className="oq-history-list">
        {items.map(h => (
          <li key={h.id} className={cx(h.id === activeId && "is-active")} onClick={() => onPick(h.id)}>
            <div className="oq-history-row1">
              <div className="oq-history-name">{h.title}</div>
              <div className={cx("oq-verdict", "v-" + h.verdict)}>{h.verdict}</div>
            </div>
            <div className="oq-history-row2 oq-mono oq-dim">
              {h.code} · {h.rating} · {h.when}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

// ──────────────────────────────── analyzer ──────────────────────────────

function Analyzer({ historyOpen, onCloseHistory }) {
  const data = D();
  const [problemIdx, setProblemIdx] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [pasteUrl, setPasteUrl] = useState("");

  const problem = data.SAMPLE_PROBLEMS[problemIdx];
  const links = data.PLATFORM_LINKS[problem.source](problem);

  const onAnalyze = useCallback(() => {
    setPhase("streaming-1");
    let stage = 1;
    const id = setInterval(() => {
      stage += 1;
      if (stage > 6) { clearInterval(id); setPhase("done"); }
      else setPhase("streaming-" + stage);
    }, 650);
  }, []);

  return (
    <div className="oq-page oq-analyzer">
      <div className="oq-analyzer-bar">
        <div className="oq-urlbar">
          <span className="oq-mono oq-dim">razbor →</span>
          <input
            className="oq-url-input"
            value={pasteUrl || links.problem}
            onChange={e => setPasteUrl(e.target.value)}
            placeholder="paste any codeforces or leetcode url…"
          />
          <button
            className="oq-btn-primary"
            onClick={() => { setPasteUrl(""); setPhase("idle"); onAnalyze(); }}
          >
            ✦ Analyze
          </button>
        </div>
        <div className="oq-prob-switcher">
          <span className="oq-mono oq-dim oq-switch-label">samples ·</span>
          {data.SAMPLE_PROBLEMS.map((p, i) => (
            <button
              key={p.id}
              className={cx("oq-switch", i === problemIdx && "is-active")}
              onClick={() => { setProblemIdx(i); setPhase("idle"); setPasteUrl(""); }}
            >
              {p.code}
            </button>
          ))}
        </div>
      </div>
      <div className="oq-analyzer-grid">
        <div className="oq-col oq-col-prob">
          <ProblemPane p={problem} />
        </div>
        <div className="oq-col oq-col-razbor">
          <RazborPane phase={phase} onAnalyze={onAnalyze} />
        </div>
      </div>
      <HistorySidebar
        open={historyOpen}
        items={D().HISTORY}
        activeId={"h1"}
        onPick={() => {}}
        onClose={onCloseHistory}
      />
    </div>
  );
}

// ─────────────────────────────── status bar ─────────────────────────────

function StatusBar({ page, direction }) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const t = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="oq-status">
      <span className="oq-mono"><span className="oq-dot oq-dot-ok"></span> online</span>
      <span className="oq-dim">·</span>
      <span className="oq-mono">{page.toUpperCase()}</span>
      <span className="oq-dim">·</span>
      <span className="oq-mono oq-dim">cmd-k</span> search
      <span className="oq-dim">·</span>
      <span className="oq-mono oq-dim">cmd-/</span> hint
      <span className="oq-spacer" />
      <span className="oq-mono">build · {direction}</span>
      <span className="oq-dim">·</span>
      <span className="oq-mono">{t}</span>
    </div>
  );
}

// ─────────────────────────────── root app ──────────────────────────────

function App({ initialPage = "dashboard", directionLabel = "console", historyOpen, setHistoryOpen }) {
  const [page, setPage] = useState(initialPage);

  return (
    <div className="oq-app">
      <SideNav page={page} onPage={setPage} direction={directionLabel} />
      <main className="oq-main">
        {page === "dashboard" && <Dashboard onOpenProblem={() => setPage("analyzer")} />}
        {page === "analyzer"  && <Analyzer historyOpen={historyOpen} onCloseHistory={() => setHistoryOpen(false)} />}
        {page === "roadmap"   && <Roadmap />}
        {page === "profile"   && <Profile />}
      </main>
      <StatusBar page={page} direction={directionLabel} />
      {page === "analyzer" && !historyOpen && (
        <button className="oq-history-tab" onClick={() => setHistoryOpen(true)}>history ›</button>
      )}
    </div>
  );
}

// ─────────────────────────────── roadmap ────────────────────────────────

function GoalEditor({ goal, onClose, onSave }) {
  const data = D();
  const [kind, setKind] = useState(goal.kind);
  const [target, setTarget] = useState(goal.target);
  const [deadline, setDeadline] = useState(goal.deadline);
  return (
    <div className="oq-modal-backdrop" onClick={onClose}>
      <div className="oq-modal" onClick={e => e.stopPropagation()}>
        <div className="oq-modal-head">
          <div>
            <div className="oq-page-eyebrow">edit goal</div>
            <h3 className="oq-modal-title">What are you training for?</h3>
          </div>
          <button className="oq-icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="oq-goal-grid">
          {data.ROADMAP.goalOptions.map(opt => (
            <button
              key={opt.id}
              className={cx("oq-goal-opt", kind === opt.id && "is-active")}
              onClick={() => setKind(opt.id)}
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
            <span className="oq-form-lbl">Target</span>
            <input className="oq-input" value={target} onChange={e => setTarget(e.target.value)} />
          </label>
          <label>
            <span className="oq-form-lbl">Deadline</span>
            <input className="oq-input" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </label>
        </div>
        <div className="oq-modal-foot">
          <button className="oq-btn-ghost oq-btn-lg" onClick={onClose}>Cancel</button>
          <button className="oq-btn-primary oq-btn-lg" onClick={() => onSave({ kind, target, deadline })}>
            ✦ Regenerate plan
          </button>
        </div>
      </div>
    </div>
  );
}

function RoadmapProblem({ p }) {
  const L = D().PLATFORM_LINKS[p.source]({ ...p });
  return (
    <li className="oq-rm-prob">
      <div className="oq-rm-prob-main">
        <div className={cx("oq-rating-pill", "small", `r-${Math.min(35, Math.floor(p.rating/100))}`)}>{p.rating}</div>
        <div>
          <div className="oq-rm-prob-title">{p.title} <span className="oq-mono oq-dim">· {p.code}</span></div>
          <div className="oq-rm-prob-meta oq-mono oq-dim">
            {p.source.toLowerCase()} · {p.tags.join(" · ")}
            {p.est && <> · {p.est}</>}
          </div>
        </div>
      </div>
      {p.status === "stretch" && <span className="oq-pill oq-pill-warn">stretch</span>}
      <a href={L.problem} target="_blank" rel="noopener" className="oq-btn-ghost">Open ↗</a>
    </li>
  );
}

function WeeklyPlan({ weeks }) {
  const [openIdx, setOpenIdx] = useState(() => weeks.find(w => w.status === "current")?.idx ?? 6);
  return (
    <div className="oq-rm-weeks">
      {weeks.map(w => {
        const open = openIdx === w.idx;
        return (
          <div key={w.idx} className={cx("oq-rm-week", `is-${w.status}`, open && "is-open")}>
            <button className="oq-rm-week-head" onClick={() => setOpenIdx(open ? null : w.idx)}>
              <div className="oq-rm-week-idx oq-mono">W{String(w.idx).padStart(2, "0")}</div>
              <div className="oq-rm-week-info">
                <div className="oq-rm-week-theme">{w.theme}</div>
                <div className="oq-rm-week-meta oq-mono oq-dim">
                  {w.status === "current" ? "in progress" : w.status === "done" ? "complete" : "upcoming"}
                  {" · "}{w.done}/{w.total} solved
                </div>
              </div>
              <div className="oq-rm-week-track">
                <div className="oq-rm-week-fill" style={{ width: (w.done / w.total * 100) + "%" }} />
              </div>
              <span className="oq-rm-week-toggle oq-mono">{open ? "−" : "+"}</span>
            </button>
            {open && w.problems && (
              <ul className="oq-rm-prob-list">
                {w.problems.map(p => <RoadmapProblem key={p.code} p={p} />)}
              </ul>
            )}
            {open && !w.problems && (
              <div className="oq-rm-week-empty oq-mono oq-dim">
                {w.status === "done"
                  ? "✓ all problems from this week solved — review available"
                  : "problem set will be generated when you reach this week"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ByTopic({ topics }) {
  return (
    <div className="oq-rm-topics">
      {topics.map(t => (
        <div key={t.topic} className="oq-panel oq-rm-topic">
          <div className="oq-rm-topic-head">
            <div>
              <h4 className="oq-rm-topic-name">{t.topic}</h4>
              <div className="oq-rm-topic-why oq-dim">{t.why}</div>
            </div>
            <div className="oq-rm-topic-strength">
              <div className="oq-topic-track">
                <div className="oq-topic-fill" style={{ width: (t.strength * 100) + "%" }} />
              </div>
              <span className="oq-mono">{Math.round(t.strength * 100)}%</span>
            </div>
          </div>
          <div className="oq-section-label">recommended unsolved</div>
          <ul className="oq-rm-prob-list">
            {t.picks.map(p => <RoadmapProblem key={p.code} p={p} />)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function InterviewMode({ iv }) {
  return (
    <div className="oq-rm-iv">
      <div className="oq-panel oq-rm-iv-head">
        <div>
          <div className="oq-page-eyebrow">today · {iv.track}</div>
          <h3 className="oq-rm-iv-title">3 problems, ≈ 75 min</h3>
          <p className="oq-rm-iv-sub oq-dim">
            Patterns mixed across difficulty so each session touches recall, speed, and a new concept.
          </p>
        </div>
        <button className="oq-btn-primary oq-btn-lg">Start session</button>
      </div>
      <ul className="oq-rm-prob-list oq-rm-iv-list">
        {iv.today.map(p => (
          <li key={p.code} className="oq-rm-prob">
            <div className="oq-rm-prob-main">
              <div className={cx("oq-rating-pill", "small", `r-${Math.min(35, Math.floor(p.rating/100))}`)}>{p.rating}</div>
              <div>
                <div className="oq-rm-prob-title">{p.title} <span className="oq-mono oq-dim">· {p.code}</span></div>
                <div className="oq-rm-prob-meta oq-mono oq-dim">
                  pattern · {p.pattern} · {p.est}
                </div>
              </div>
            </div>
            <a
              href={D().PLATFORM_LINKS[p.source]({ ...p }).problem}
              target="_blank" rel="noopener"
              className="oq-btn-ghost"
            >Open ↗</a>
          </li>
        ))}
      </ul>
      <div className="oq-panel">
        <div className="oq-panel-head"><h3>Pattern coverage</h3><span className="oq-dim">FAANG · backend</span></div>
        <div className="oq-rm-patterns">
          {iv.patterns.map(p => (
            <div key={p.name} className="oq-rm-pattern">
              <div className="oq-rm-pattern-name">{p.name}</div>
              <div className="oq-topic-track">
                <div className="oq-topic-fill" style={{ width: (p.done / p.total * 100) + "%" }} />
              </div>
              <div className="oq-mono oq-rm-pattern-num">{p.done}/{p.total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotifyRow({ k, v, onToggle }) {
  return (
    <label className="oq-notify-row">
      <input type="checkbox" checked={v.on} onChange={() => onToggle(k)} />
      <div className="oq-notify-text">
        <div className="oq-notify-title">{v.text}</div>
        {v.time && <div className="oq-mono oq-dim oq-notify-meta">delivers at {v.time}</div>}
      </div>
    </label>
  );
}

function Roadmap() {
  const data = D();
  const [mode, setMode] = useState("weekly");
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState(data.ROADMAP.goal);
  const [notify, setNotify] = useState(data.ROADMAP.notify);

  const pct = Math.min(100, Math.max(0,
    ((goal.current - 1100) / (goal.target - 1100)) * 100
  ));

  return (
    <div className="oq-page oq-rm">
      <header className="oq-page-head">
        <div>
          <div className="oq-page-eyebrow oq-mono">roadmap · generated {data.ROADMAP.generatedAt}</div>
          <h1 className="oq-page-title">Path to {goal.label.replace(/^Reach\s+/i,"")}</h1>
          <p className="oq-page-sub">
            Claude rebuilds this plan every Monday from your last 90 days of
            activity. <span className="oq-dim">You're {goal.onTrack ? "on track" : "behind"} — current pace {goal.actualPace}/day, required {goal.requiredPace}/day.</span>
          </p>
        </div>
        <button className="oq-btn-ghost oq-btn-lg" onClick={() => setEditing(true)}>↻ Regenerate</button>
      </header>

      {/* GOAL CARD */}
      <section className="oq-panel oq-goal-card">
        <div className="oq-goal-card-l">
          <div className="oq-page-eyebrow oq-mono">current goal · {goal.kind}</div>
          <h2 className="oq-goal-title">{goal.label} ({goal.target})</h2>
          <div className="oq-goal-progress">
            <div className="oq-goal-track">
              <div className="oq-goal-fill" style={{ width: pct + "%" }} />
              <div className="oq-goal-fill-mark" style={{ left: pct + "%" }}>
                <span className="oq-mono">{goal.current}</span>
              </div>
            </div>
            <div className="oq-goal-bounds oq-mono oq-dim">
              <span>1100 · start</span>
              <span>{goal.target} · {goal.deadline}</span>
            </div>
          </div>
          <div className="oq-goal-stats">
            <div><span className="oq-mono oq-dim">days left</span><strong>{goal.daysLeft}</strong></div>
            <div><span className="oq-mono oq-dim">pace</span><strong>{goal.actualPace}/day</strong></div>
            <div><span className="oq-mono oq-dim">required</span><strong>{goal.requiredPace}/day</strong></div>
            <div><span className="oq-mono oq-dim">status</span>
              <strong className={goal.onTrack ? "oq-ok" : "oq-warn-fg"}>
                {goal.onTrack ? "on track" : "behind"}
              </strong>
            </div>
          </div>
        </div>
        <div className="oq-goal-card-r">
          <button className="oq-btn-ghost" onClick={() => setEditing(true)}>Edit goal</button>
          <div className="oq-notify-block">
            <div className="oq-section-label">notify me when</div>
            <NotifyRow k="daily"   v={notify.daily}   onToggle={k => setNotify(n => ({ ...n, [k]: { ...n[k], on: !n[k].on } }))} />
            <NotifyRow k="streak"  v={notify.streak}  onToggle={k => setNotify(n => ({ ...n, [k]: { ...n[k], on: !n[k].on } }))} />
            <NotifyRow k="contest" v={notify.contest} onToggle={k => setNotify(n => ({ ...n, [k]: { ...n[k], on: !n[k].on } }))} />
            <NotifyRow k="weekly"  v={notify.weekly}  onToggle={k => setNotify(n => ({ ...n, [k]: { ...n[k], on: !n[k].on } }))} />
          </div>
        </div>
      </section>

      {/* MODE TABS */}
      <div className="oq-mode-tabs">
        {[
          { id: "weekly",    label: "Weekly plan" },
          { id: "topic",     label: "By topic" },
          { id: "interview", label: "Interview mode" },
        ].map(t => (
          <button
            key={t.id}
            className={cx("oq-mode-tab", mode === t.id && "is-active")}
            onClick={() => setMode(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div className="oq-mode-spacer" />
        <span className="oq-mono oq-dim">tuned by {data.ROADMAP.model}</span>
      </div>

      {mode === "weekly"    && <WeeklyPlan weeks={data.ROADMAP.weeks} />}
      {mode === "topic"     && <ByTopic topics={data.ROADMAP.byTopicRecs} />}
      {mode === "interview" && <InterviewMode iv={data.ROADMAP.interview} />}

      {editing && (
        <GoalEditor
          goal={goal}
          onClose={() => setEditing(false)}
          onSave={(g) => { setGoal({ ...goal, ...g }); setEditing(false); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────── profile ────────────────────────────────

function Profile() {
  const data = D();
  const [u, setU] = useState(data.PROFILE.user);
  const [platforms, setPlatforms] = useState(data.PROFILE.platforms);
  const [pwd, setPwd] = useState({ cur: "", new: "", confirm: "" });
  const [twofa, setTwofa] = useState(false);
  const [connecting, setConnecting] = useState(null);

  const togglePlatform = (id) => {
    const p = platforms.find(x => x.id === id);
    if (p.connected) {
      setPlatforms(ps => ps.map(x => x.id === id ? { ...x, connected: false, handle: null, lastSync: null, rating: null } : x));
    } else {
      setConnecting(id);
    }
  };

  const confirmConnect = (id, handle) => {
    setPlatforms(ps => ps.map(x => x.id === id ? {
      ...x, connected: true, handle, lastSync: "just now",
      rating: 1200 + Math.floor(Math.random() * 600)
    } : x));
    setConnecting(null);
  };

  return (
    <div className="oq-page oq-prof">
      <header className="oq-page-head">
        <div>
          <div className="oq-page-eyebrow oq-mono">profile · settings</div>
          <h1 className="oq-page-title">Account</h1>
          <p className="oq-page-sub">
            Manage your identity, connected platforms, and notification rules.
            <span className="oq-dim"> Joined {u.joined} · timezone {u.timezone}.</span>
          </p>
        </div>
      </header>

      <section className="oq-prof-grid">
        {/* IDENTITY */}
        <div className="oq-panel oq-prof-card">
          <div className="oq-panel-head"><h3>Identity</h3><span className="oq-dim">visible to other users</span></div>
          <div className="oq-prof-identity">
            <div className="oq-prof-avatar">K</div>
            <button className="oq-btn-ghost">Upload</button>
            <button className="oq-btn-ghost">Remove</button>
          </div>
          <div className="oq-form">
            <label>
              <span className="oq-form-lbl">Display name</span>
              <input className="oq-input" value={u.displayName} onChange={e => setU({...u, displayName: e.target.value})} />
            </label>
            <label>
              <span className="oq-form-lbl">Username <span className="oq-mono oq-dim">olympiq.dev/u/</span></span>
              <input className="oq-input" value={u.username} onChange={e => setU({...u, username: e.target.value})} />
            </label>
            <label>
              <span className="oq-form-lbl">
                Email
                {u.emailVerified && <span className="oq-pill oq-pill-ok" style={{ marginLeft: 8 }}>verified</span>}
              </span>
              <input className="oq-input" value={u.email} onChange={e => setU({...u, email: e.target.value})} />
            </label>
            <label>
              <span className="oq-form-lbl">Country</span>
              <input className="oq-input" value={u.country} onChange={e => setU({...u, country: e.target.value})} />
            </label>
          </div>
          <div className="oq-form-foot">
            <button className="oq-btn-primary">Save changes</button>
            <span className="oq-mono oq-dim">last saved 4 min ago</span>
          </div>
        </div>

        {/* PASSWORD */}
        <div className="oq-panel oq-prof-card">
          <div className="oq-panel-head"><h3>Password &amp; security</h3><span className="oq-dim">private</span></div>
          <div className="oq-form">
            <label>
              <span className="oq-form-lbl">Current password</span>
              <input type="password" className="oq-input" value={pwd.cur} onChange={e => setPwd({...pwd, cur: e.target.value})} placeholder="••••••••" />
            </label>
            <label>
              <span className="oq-form-lbl">New password</span>
              <input type="password" className="oq-input" value={pwd.new} onChange={e => setPwd({...pwd, new: e.target.value})} placeholder="≥ 12 characters" />
            </label>
            <label>
              <span className="oq-form-lbl">Confirm new password</span>
              <input type="password" className="oq-input" value={pwd.confirm} onChange={e => setPwd({...pwd, confirm: e.target.value})} />
            </label>
          </div>
          <button className="oq-btn-primary">Change password</button>
          <div className="oq-prof-divider" />
          <label className="oq-switch-row">
            <input type="checkbox" checked={twofa} onChange={() => setTwofa(v => !v)} />
            <div>
              <div className="oq-switch-title">Two-factor authentication</div>
              <div className="oq-dim">TOTP via Authy, 1Password, or your password manager.</div>
            </div>
          </label>
        </div>

        {/* CONNECTED PLATFORMS */}
        <div className="oq-panel oq-prof-card oq-prof-card-wide">
          <div className="oq-panel-head">
            <h3>Connected platforms</h3>
            <span className="oq-dim">we pull stats from these every hour</span>
          </div>
          <ul className="oq-platforms">
            {platforms.map(p => (
              <li key={p.id} className={cx("oq-platform", p.connected && "is-connected")}>
                <div className="oq-platform-glyph" style={{ background: p.color }}>{p.name[0]}</div>
                <div className="oq-platform-info">
                  <div className="oq-platform-name">{p.name}</div>
                  {p.connected ? (
                    <div className="oq-mono oq-dim">@{p.handle} · {p.rating} · synced {p.lastSync}</div>
                  ) : (
                    <div className="oq-mono oq-dim">not connected — link to pull rating &amp; solved problems</div>
                  )}
                </div>
                {p.connected ? (
                  <div className="oq-platform-actions">
                    <button className="oq-btn-ghost">Sync now</button>
                    <button className="oq-btn-ghost oq-btn-danger" onClick={() => togglePlatform(p.id)}>Disconnect</button>
                  </div>
                ) : (
                  <button className="oq-btn-primary" onClick={() => togglePlatform(p.id)}>Connect</button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* SESSIONS */}
        <div className="oq-panel oq-prof-card oq-prof-card-wide">
          <div className="oq-panel-head">
            <h3>Active sessions</h3>
            <button className="oq-btn-ghost oq-btn-danger">Sign out everywhere else</button>
          </div>
          <ul className="oq-sessions">
            {data.PROFILE.sessions.map((s, i) => (
              <li key={i} className="oq-session">
                <div>
                  <div className="oq-session-device">{s.device} {s.current && <span className="oq-pill oq-pill-ok">this device</span>}</div>
                  <div className="oq-mono oq-dim">{s.where} · {s.when}</div>
                </div>
                {!s.current && <button className="oq-btn-ghost">Revoke</button>}
              </li>
            ))}
          </ul>
        </div>

        {/* DANGER ZONE */}
        <div className="oq-panel oq-prof-card oq-prof-card-wide oq-danger-card">
          <div className="oq-panel-head"><h3>Danger zone</h3><span className="oq-dim">cannot be undone</span></div>
          <div className="oq-danger-row">
            <div>
              <div className="oq-danger-title">Export your data</div>
              <div className="oq-dim">A zipped archive of every razbor, roadmap, and stat snapshot.</div>
            </div>
            <button className="oq-btn-ghost">Request export</button>
          </div>
          <div className="oq-danger-row">
            <div>
              <div className="oq-danger-title">Delete account</div>
              <div className="oq-dim">All data wiped after 30 days. You can sign back in to cancel.</div>
            </div>
            <button className="oq-btn-ghost oq-btn-danger">Delete account</button>
          </div>
        </div>
      </section>

      {connecting && (
        <ConnectModal
          platform={platforms.find(p => p.id === connecting)}
          onClose={() => setConnecting(null)}
          onConfirm={(h) => confirmConnect(connecting, h)}
        />
      )}
    </div>
  );
}

function ConnectModal({ platform, onClose, onConfirm }) {
  const [handle, setHandle] = useState("");
  return (
    <div className="oq-modal-backdrop" onClick={onClose}>
      <div className="oq-modal oq-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="oq-modal-head">
          <div>
            <div className="oq-page-eyebrow">connect</div>
            <h3 className="oq-modal-title">Link your {platform.name} account</h3>
          </div>
          <button className="oq-icon-btn" onClick={onClose}>×</button>
        </div>
        <p className="oq-dim" style={{ marginTop: 0 }}>
          Enter your public handle. We'll verify it by reading your profile — no
          password ever leaves your machine.
        </p>
        <label>
          <span className="oq-form-lbl">{platform.name} handle</span>
          <input
            autoFocus
            className="oq-input"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            placeholder={platform.name === "AtCoder" ? "tourist" : "username"}
          />
        </label>
        <div className="oq-modal-foot">
          <button className="oq-btn-ghost oq-btn-lg" onClick={onClose}>Cancel</button>
          <button className="oq-btn-primary oq-btn-lg" disabled={!handle.trim()} onClick={() => onConfirm(handle.trim())}>
            Connect →
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────── mount ────────────────────────────────

window.mountOlympIQ = function (rootEl, opts = {}) {
  const root = ReactDOM.createRoot(rootEl);
  function Wrap() {
    const [historyOpen, setHistoryOpen] = useState(opts.historyOpen !== false);
    // Allow parent (canvas) to broadcast tweaks via postMessage
    useEffect(() => {
      function onMsg(e) {
        const m = e.data;
        if (!m || typeof m !== "object") return;
        if (m.kind === "olympiq:tweak") {
          if ("historyOpen" in m) setHistoryOpen(m.historyOpen);
          if ("theme" in m) {
            document.documentElement.dataset.theme = m.theme;
          }
        }
      }
      window.addEventListener("message", onMsg);
      return () => window.removeEventListener("message", onMsg);
    }, []);
    return (
      <App
        initialPage={opts.initialPage || "analyzer"}
        directionLabel={opts.directionLabel || "console"}
        historyOpen={historyOpen}
        setHistoryOpen={setHistoryOpen}
      />
    );
  }
  root.render(<Wrap />);
};
