---
title: Frontend Deep Dive
type: brain
last_updated: 2026-05-31
---

# Frontend Deep Dive

---

## Every Page: Route, What It Renders, Key State

### Landing (`/`)
- **File:** `src/pages/Landing.tsx`
- **Route:** Public
- **Renders:** Marketing page with hero, feature grid, CTA buttons → /register and /login
- **State:** None (stateless)

### Register (`/register`)
- **File:** `src/pages/Register.tsx`
- **Route:** Public
- **Renders:** Registration form: email, username, password
- **Key behavior:** On success → navigate to `/login`; on error → shows inline message
- **API call:** `POST /auth/register`

### Login (`/login`)
- **File:** `src/pages/Login.tsx`
- **Route:** Public
- **Renders:** Login form: email, password
- **Key behavior:** On success → sets user in authStore → navigate to `/dashboard`
- **CRITICAL:** Login 401 must NOT trigger Axios interceptor refresh. `isAuthRoute` guard in `client.ts` prevents this.
- **API call:** `POST /auth/login`

### Dashboard (`/dashboard`)
- **File:** `src/pages/Dashboard.tsx`
- **Route:** Protected (inside AppShell)
- **Renders:** Platform cards (CF + LC), topic bars, activity heatmap, recommended problems panel
- **Key state:** Local `data: DashboardData | null`, `loading: boolean`
- **On mount:** `getDashboard()` → sets data; sets `cfRating` in statsStore
- **Empty state:** If no platforms connected → shows "Connect platforms" CTA → navigate to /profile
- **Skeleton loader:** Shows during loading

### Roadmap (`/roadmap`)
- **File:** `src/pages/Roadmap.tsx`
- **Route:** Protected
- **Renders:** Mode tabs (weekly/topic/interview), goal card, roadmap content for selected mode
- **Key state:** `useRoadmapStore` — roadmap, mode, goals, generating, genError, loaded
- **On mount:** If not `loaded`, fetches `/roadmap` and `/goals`
- **Generation:** `POST /roadmap/generate {mode}` → polls store → re-renders
- **3 view components:** `WeeklyView`, `TopicView`, `InterviewView`
- **Problem rows:** Each has external "Open ↗" link (target="_blank")

### Analyzer (`/analyzer`)
- **File:** `src/pages/Analyzer.tsx`
- **Route:** Protected
- **Key state:** `useAnalyzerStore` — history, currentContent, currentURL, tab, revealedHints, historyOpen, analyzing, error
- **Layout:** Resizable 2-column grid (left: problem pane, right: razbor pane)
  - Drag divider adjusts `splitPct` (25%–75% clamped)
  - `mousedown/mousemove/mouseup` on `window` reference
- **Left pane:** Shows `SampleProblemPane` if no analysis loaded, `ProblemPane` if analysis loaded
- **Right pane:** `RazborPane` — tabs: All / Hints only / Walkthrough
- **Sample problems:** 3 hardcoded problems (1842B, 1923D, LeetCode House Robber) shown before any analysis
- **History sidebar:** `HistorySidebar` — overlays right side, shows past analyses with search + pagination
- **NO code editor** — analyze button only, no textarea, no CodeMirror, no run button

### Profile (`/profile`)
- **File:** `src/pages/Profile.tsx`
- **Route:** Protected
- **Renders:** Identity edit (username/email), password change, platform connect/disconnect, danger zone
- **Platform connect flow:** Input handle → `POST /accounts/connect` → trigger sync → refresh stats
- **Platform disconnect flow:** Confirmation modal → `DELETE /accounts/:platform`
- **Danger zone:** Type username to confirm → `DELETE /profile` → logout

---

## Every Zustand Store: State Shape and Actions

### authStore (`store/authStore.ts`)
```typescript
interface AuthState {
  user: User | null       // null = not authenticated
  loading: boolean        // true during AppShell initial refresh check
  setUser: (user: User | null) => void
  setLoading: (v: boolean) => void
}
```
Initial: `{user: null, loading: true}`

### statsStore (`store/statsStore.ts`)
```typescript
interface StatsState {
  stats: UserStats[]
  accounts: PlatformAccount[]
  cfRating: number | null
  setStats: (s: UserStats[]) => void
  setAccounts: (a: PlatformAccount[]) => void
  setCfRating: (r: number | null) => void
}
```
`cfRating` is used by Sidebar to show user's current rating badge.

### roadmapStore (`store/roadmapStore.ts`)
```typescript
interface RoadmapState {
  roadmap: AnyRoadmap | null
  mode: 'weekly' | 'topic' | 'interview'
  goals: UserGoal | null
  notify: { daily: boolean; weekly: boolean; problems: boolean }
  loaded: boolean          // skip re-fetch on revisit
  generating: boolean
  genError: string
  editing: boolean
  // Actions:
  setRoadmap(r, mode?)
  setMode(m)
  setGoals(g)
  setNotify(n)
  setLoaded(v)
  setGenerating(v)
  setGenError(e)
  setEditing(v)
}
```

### analyzerStore (`store/analyzerStore.ts`)
```typescript
interface AnalyzerState {
  history: Analysis[]         // list of past analyses (from /analyses)
  currentContent: AnalysisContent | null
  currentURL: string
  activeId: string | null     // which history item is active
  tab: 'all' | 'hints' | 'solution'
  revealedHints: number       // how many hints shown (0-3)
  historyOpen: boolean
  historySearch: string
  analyzing: boolean
  error: string
  // Actions:
  setHistory(h)
  setCurrentContent(c, url, id?)    // also resets tab and revealedHints
  setTab(t)
  setRevealedHints(n)
  setHistoryOpen(v)
  setHistorySearch(s)
  setAnalyzing(v)
  setError(e)
  reset()                    // clears currentContent, url, activeId, error
}
```

---

## Axios Client Setup

**File:** `src/api/client.ts`

```typescript
const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,       // sends httpOnly cookies
  headers: { 'Content-Type': 'application/json' },
})
```

**401 Interceptor (token refresh):**
```typescript
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    const isAuthRoute = original?.url?.startsWith('/auth/')  // CRITICAL guard
    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      // ... queue-based refresh with isRefreshing flag
      // On refresh success: retry original request
      // On refresh failure: window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

**Queue pattern:** Multiple simultaneous 401s queue up (`refreshQueue`) and all retry after one refresh succeeds. Prevents parallel refresh races.

**API helpers exported:**
- `get<T>(path, params?)` → unwraps `r.data.data`
- `post<T>(path, body?)` → unwraps `r.data.data`
- `put<T>(path, body?)` → unwraps `r.data.data`
- `del<T>(path)` → unwraps `r.data.data`

---

## The isAuthRoute Guard (Critical)

**Problem it solves:** When `POST /auth/login` returns 401 (wrong password), the 401 interceptor would normally try to refresh the token. That refresh would also fail (user not logged in), then do `window.location.href = '/login'`, causing a full page reload and clearing the login form.

**The guard:**
```typescript
const isAuthRoute = original?.url?.startsWith('/auth/')
if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
  // ... do refresh
}
```

With this guard, 401 from `/auth/login`, `/auth/register`, `/auth/refresh` passes through as a normal rejected promise. The login form shows the error message without reloading.

**Do NOT remove this guard.**

---

## How AppShell Works

**File:** `src/components/layout/AppShell.tsx`

On mount (empty deps array):
1. Calls `refresh()` → `POST /auth/refresh` to renew access token from refresh cookie
2. On success: `setUser(u)` → user is authenticated
3. On failure: `setUser(null)` → `navigate('/login')`
4. `setLoading(false)` in both cases

While loading: shows centered spinner.
After loading if user is null: returns null (route guard — shows nothing briefly before redirect).
After loading if user exists: renders `<Sidebar> + <main><Outlet/></main> + <StatusBar>`.

**Theme toggle:** `localStorage.getItem('theme') ?? 'dark'` → `document.documentElement.setAttribute('data-theme', theme)`.

**CRITICAL:** The `useEffect` has empty deps `[]`. Never add `navigate`, `setUser`, or `setLoading` as dependencies — causes infinite loop where every render triggers another refresh call.

---

## How Analyzer Page Works

**2-column layout:**
- `containerRef` on the outer flex div
- `splitPct` state (0–100%) drives `width: ${splitPct}%` on left column
- Drag divider: `onMouseDown` → attach `mousemove`/`mouseup` to `window` → update `splitPct` clamped to [25, 75]
- Hover turns divider from `--line` to `--accent` color

**Sample problems:**
- `SAMPLE_PROBLEMS` array hardcoded with 3 problems (Codeforces 1842B, 1923D, LeetCode 198)
- Shown in `SampleProblemPane` when `!store.currentContent`
- Switcher buttons at top change `sampleIdx`
- "Analyze" button on sample runs `handleSampleAnalyze` → sets `currentURL = sample.url` then calls `handleAnalyze`

**Analysis flow:**
1. User pastes URL → sets `store.currentURL`
2. Clicks "Analyze" or presses Enter
3. `handleAnalyze`: validates URL, sets `analyzing = true`
4. `analyzeProblem(url)` → `POST /analyze` → returns `{id, analysis: AnalysisContent}`
5. `listAnalyses()` → refreshes history
6. `setCurrentContent(result.analysis, url, items[0]?.id)` → shows ProblemPane + RazborPane

**Error handling in analyzer:**
- "quota" / "rate limit" → AI quota message
- "parse" / "Gemini" / "AI response" → key/model message
- "url" / "URL" → invalid URL message
- Catch-all → general failure message

**Razbor tabs:**
- `all`: shows everything (classification, observations, hints, approach, steps, complexity, mistakes, similar)
- `hints`: shows only the hint ladder (section 03)
- `solution`: shows everything except hints

**History sidebar:**
- Shows list of past analyses with search filter
- Click → `getAnalysis(id)` → load content
- Pagination: "load more" → `listAnalyses(page+1, 20)` → append to store.history

---

## How Roadmap Page Works

**3 modes:**
- `weekly`: Shows `WeeklyView` with collapsible `WeekItem` accordions
- `topic`: Shows `TopicView` with topic cards and strength bars
- `interview`: Shows `InterviewView` with pattern frequency bars

**Goal card:** Shows current goal (goal_type, target_rating, notify prefs). "Set Goals" button opens `GoalModal`.

**Mode switching:**
- Tabs at top: `setMode(m)` in store
- Does NOT re-fetch from server — uses cached `store.roadmap`
- Roadmap JSON includes a `mode` field; if current `store.mode` differs from `store.roadmap.mode`, show "Generate {mode} plan" prompt

**Generation flow:**
1. User clicks "Generate" (or mode-specific "Generate {mode} plan")
2. `setGenerating(true)`, `setGenError('')`
3. `POST /roadmap/generate {mode: store.mode}`
4. On success: `setRoadmap(parsedResponse, mode)`, `setLoaded(true)`
5. On error: `setGenError(message)`

**Problem rows:** Each `ProblemRow` renders `<a href={p.url} target="_blank">Open ↗</a>` — always an external link. No internal routing for problems.

---

## Related notes

[[00-Master-Context]] · [[05 - Frontend]] · [[02-Backend-Deep]] · [[03 - Architecture]] · [[06-Errors-Bible]]
