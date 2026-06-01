---
title: Frontend State
type: reference
last_updated: 2026-05-30
---

# Frontend State

All files under `frontend/src/`.

---

## Pages (`pages/`)

| File | Route | Size | Status |
|------|-------|------|--------|
| `Landing.tsx` | `/` | 6.5KB | ✅ |
| `Login.tsx` | `/login` | 2.9KB | ✅ |
| `Register.tsx` | `/register` | 3.6KB | ✅ |
| `Dashboard.tsx` | `/dashboard` | 17.6KB | ✅ Full stats, sparkline, heatmap, topic bars |
| `Roadmap.tsx` | `/roadmap` | 22KB | ✅ Mode tabs, goal card, weekly/topic/interview |
| `Analyzer.tsx` | `/analyzer` | 25.3KB | 🔄 Modified — in progress |
| `Profile.tsx` | `/profile` | 21KB | ✅ Identity, password, platforms, danger zone |

---

## Layout components (`components/layout/`)

| File | Purpose | Status |
|------|---------|--------|
| `AppShell.tsx` | 248px sidebar + fluid main, theme toggle | ✅ |
| `Sidebar.tsx` | Nav links, active state with accent-soft + inset shadow | ✅ |
| `StatusBar.tsx` | Full-width footer, service health dots | ✅ |

Other: `ErrorBoundary.tsx` at `components/` root.

---

## Stores (`store/`)

| File | State managed | Status |
|------|--------------|--------|
| `authStore.ts` | user, isAuthenticated, login/logout actions | ✅ |
| `statsStore.ts` | platform stats, sync status | ✅ |
| `roadmapStore.ts` | roadmap data, mode, generate action | ✅ |
| `analyzerStore.ts` | analysis result, history, analyze action | ✅ |

---

## Key frontend rules (from design system)

- **No code editor anywhere** — Analyzer is read-and-learn only; no `<textarea>`, no CodeMirror
- Solve buttons must be `<a href="{url}" target="_blank" rel="noopener">` — never `<button>` with navigation
- Panel class: `background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);`
- Active nav: `background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent);`
- Monospace elements (handles, ratings, tags): use `font-family: var(--font-mono)`
- TypeScript: strict mode, no `any` types

---

## Analyzer page spec (current in-progress)

Two-column layout:
- **Left — Problem pane:** title, source badge, rating pill, tags, problem statement, input/output, constraints
  - Prominent `oq-actions` row: "Solve on Codeforces ↗" or "Solve on LeetCode ↗" as `oq-btn-primary oq-btn-lg`
- **Right — Razbor panel:** tabbed sections rendered from Claude JSON
  1. Classification (type pill, confidence bar)
  2. Key Observations (bullet list)
  3. Algorithm Approach (summary + collapsible progressive hints)
  4. Step-by-Step Solution Logic (numbered steps, no code)
  5. Time & Space Complexity (two-column grid)
  6. Common Mistakes (bullet list)
  7. Similar Problems (list with external links)
- **Left sidebar:** Analysis history with search

---

## Axios / API conventions

- Base URL from env: `VITE_API_URL` (proxied through Nginx to `:8080`)
- All requests include credentials (`withCredentials: true`) for cookie auth
- 401 interceptor triggers token refresh then retries
- All responses follow: `{ success, data, error }` shape

---

## Related notes

[[03 - Architecture]] · [[04 - Backend]] · [[04-Frontend-Deep]] · [[06 - Active Issues]] · [[07 - Decisions Log]]
