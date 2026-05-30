# OlympIQ — frontend handoff brief

This package is the canonical **Atelier** direction of the OlympIQ design,
exported from a hi-fi interactive prototype. Drop it into your repo and ask
Claude Code to port it into your real stack (React 18 + TypeScript + Tailwind
+ Zustand + React Router v6 + Vite, per the project's `CLAUDE.md`).

---

## What's in this folder

| File | Purpose |
|------|---------|
| `OlympIQ - Atelier (standalone).html` | A single-file, self-contained build of the design. Open it in a browser to see the target UX with no setup. Use this as the **pixel reference** while porting. |
| `atelier.html` | The direction shell — sets CSS variables (colors, radii, typography), then mounts the React app. |
| `shared/app.jsx` | All React components for every page (Dashboard, Analyzer, Roadmap, Profile) plus the sidebar, status bar, history drawer, and modals. |
| `shared/app.css` | The full stylesheet — uses CSS variables for theming so the Atelier shell can override colors/radii/spacing without touching component code. |
| `shared/data.jsx` | Sample data (problems, history, AI razbor, dashboard stats, roadmap, profile). Replace with real API calls during port. |

The prototype uses **inline JSX via Babel-in-the-browser** so you can read it
without a build step. In the ported codebase this becomes proper TSX files
under `frontend/src/`.

---

## Routes (matches the project `CLAUDE.md`)

```
/                  → Landing (not in this prototype — design later)
/login, /register  → Auth forms (not in this prototype)
/dashboard         → Dashboard.tsx
/analyzer          → Analyzer.tsx     (problem detail + AI razbor)
/roadmap           → Roadmap.tsx      (goal, weekly plan, by-topic, interview mode)
/profile           → Profile.tsx      (identity, password, platforms, sessions)
```

The sidebar in `app.jsx` already navigates between these four screens —
match its labels and order exactly.

---

## Design system

### Type
- **UI**: Inter, weights 400 / 500 / 600 / 700 (via Google Fonts)
- **Mono**: JetBrains Mono, weights 400 / 500 / 600
- Use mono for: eyebrows, handles, code, ratings, status chips, metadata.

### Color tokens (CSS variables — copy verbatim into your Tailwind config)

Defined in `atelier.html`'s `<style>` block. Three themes: `dark` (default),
`dim`, `light`. Apply via `<html data-theme="…">`.

| Token | Role |
|-------|------|
| `--bg`, `--bg-sunken`, `--bg-elev`, `--panel` | Surfaces, dark→light layering |
| `--line`, `--line-strong` | Dividers, borders |
| `--text`, `--text-dim`, `--text-faint` | Primary / secondary / tertiary text |
| `--accent` (violet) | Primary interactive color |
| `--accent-2` (warm red-orange) | Highlight & gradient stop |
| `--accent-soft` | Accent at ~14% — backgrounds for selected states |
| `--accent-fg` | Foreground when sitting on `accent-soft` |
| `--accent-on` | Foreground when sitting on solid `accent` |
| `--ok`, `--warn`, `--err` | Status colors (verdicts, validation) |
| `--radius`, `--radius-sm`, `--radius-lg` | 12px / 8px / 16px (Atelier) |

For Tailwind: expose these as `colors.bg`, `colors.accent`, `borderRadius.DEFAULT`, etc. Don't hardcode hex values in components.

### Layout
- App shell: 248px sidenav + flexible main + footer status bar.
- Page padding: 36px 42px 42px (Atelier).
- Panels: 1px solid `--line`, `--radius` corners, subtle inset highlight + drop shadow.
- Eyebrows are mono, 11px, uppercase, 0.18em tracking.

---

## Component checklist (port these in this order)

1. **Layout shell** — `Sidebar`, `StatusBar`, `<main>` wrapper.
2. **Sidebar nav** — workspace items (Dashboard / Analyzer / Roadmap / Profile), Connected accounts list, User chip at the bottom.
3. **Dashboard** — `PlatformCard` (Codeforces / LeetCode), `Spark` SVG sparkline, `TopicBars`, `Heatmap` (7×24), `RecommendedList`, `StreakCard`.
4. **Analyzer** —
   - URL bar (paste any CF/LC link) + sample problem switcher.
   - `ProblemPane` — title, rating pill, tags (clickable → platform tag-search), **prominent Open / Editorial / Submit buttons that deep-link to the source platform** (see `PLATFORM_LINKS` in `shared/data.jsx`), statement, constraints, samples.
   - `RazborPane` — empty state with "✦ Analyze" CTA, then streamed sections: **classification → key observations → hint ladder (progressive reveal) → step-by-step → complexity → similar problems**.
   - `HistorySidebar` (toggleable) — past razbors with AC/WA/TLE verdict pills.
   - **Important: there is no code editor.** OlympIQ analyzes, the user solves on the source platform.
5. **Roadmap** —
   - `GoalCard` — current goal label/target, progress bar with marker, days-left / pace / required / status, **notify-me rules** (daily, streak, contest, weekly digest).
   - `GoalEditor` modal — pick goal kind (Rating · Contest · Interview · Topic mastery), set target + deadline, "Regenerate plan".
   - Mode tabs: `WeeklyPlan` (12 weeks, expandable, current auto-open, recommended unsolved problems with "Open ↗"), `ByTopic` (cards with strength meter + reasoning + picks), `InterviewMode` (today's mixed-pattern set, "Start session", pattern-coverage bars).
6. **Profile** —
   - `Identity` form (display name, username, email + verified pill, country).
   - `PasswordSecurity` — current/new/confirm, change-password button, 2FA toggle.
   - `ConnectedPlatforms` — list of Codeforces / LeetCode / AtCoder / CodeChef with connect/disconnect; `ConnectModal` for the handle entry.
   - `ActiveSessions` — list with revoke + "sign out everywhere else".
   - `DangerZone` — export data, delete account.

---

## State management

Use **Zustand** stores (matches `CLAUDE.md`):

- `useAuthStore` — user, tokens, login/logout/refresh.
- `useStatsStore` — Codeforces + LeetCode snapshots, last-synced timestamps.
- `useRoadmapStore` — current goal, weeks, byTopic recs, interviewMode, notify prefs.
- `useAnalyzerStore` — current problem, streaming state, history list, paste URL.
- `useUIStore` — theme (`dark | dim | light`), `historyOpen` boolean, persisted to localStorage.

---

## API wiring (replace prototype data)

The prototype hardcodes everything in `shared/data.jsx`. Wire to the real
backend at these endpoints (all `/api/v1`, see project `CLAUDE.md`):

| Component | Endpoint(s) |
|-----------|-------------|
| Sidebar user + handles | `GET /profile`, `GET /accounts` |
| Dashboard stats | `GET /stats` (force-refresh via `POST /accounts/sync`) |
| Analyzer "✦ Analyze" | `POST /analyze` with `{ problem_url }` — **stream the response** if backend supports SSE; otherwise reveal sections sequentially in the client. |
| Analyzer history | `GET /analyses?page=&limit=` |
| Roadmap | `GET /roadmap`, `POST /roadmap/generate` |
| Profile platforms | `POST /accounts/connect`, `DELETE /accounts/:platform` |
| Profile password | (custom — add `PUT /profile/password` if missing) |

---

## Theming hook

```ts
// hooks/useTheme.ts
export function useTheme() {
  const theme = useUIStore(s => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}
```

Call once in your root layout. Then everything just reads CSS vars.

---

## Things to keep faithful

- Sidebar **width 248px**, dashed/solid divider treatment between sections,
  the `◇` brand mark with the violet→red gradient.
- Eyebrow + title + sub pattern at the top of every page.
- Rating pill colors keyed by hundreds (1100s green → 2800s red — see
  `.oq-rating-pill.r-XX` rules in `app.css`).
- Mono is used for: eyebrows, handles, code values, file labels, key/value
  metadata, time deltas, status text. Don't substitute Inter there.
- Buttons:
  - **Primary** — filled `--accent`, mono not required.
  - **Ghost** — `--bg-elev` background, mono text 11.5px, line border.
  - **Lg variant** — same shape, bigger padding/font (for the Open ↗ row).
- The Open / Editorial / Submit row should always be **above the fold** on the problem pane.

---

## Things you can drop / change

- The deck/canvas wrappers (`design-canvas.jsx`, `tweaks-panel.jsx`) are
  prototype-only — do not port them.
- The Babel-in-browser scripts and the script-tag JSX loading model
  obviously go away once you have Vite + TSX.
- Sample data in `data.jsx` is illustrative — real shapes should match your
  Go DTOs.
- The Console direction (sharp/terminal flavor) is left in the repo for
  comparison; **only Atelier is the chosen direction.** Delete `console.html`
  when you're confident.

---

## Getting started prompt for Claude Code

> "Build the React + TypeScript + Tailwind frontend matching the design in
> `OlympIQ - Atelier (standalone).html`. Use the source files in
> `shared/` and `atelier.html` as your reference for component structure,
> CSS variable names, and visual treatment. Follow the page order
> Dashboard → Analyzer → Roadmap → Profile. Don't include a code editor in
> the Analyzer — users solve on the source platform. The standalone HTML
> file shows the exact target UX; match it pixel-for-pixel."
