# OlympIQ — AI-Powered Olympiad Training Platform
## Project Instructions for Claude Code

---

## What we are building

OlympIQ is a web platform for competitive programming students (olympiad participants).
Students connect their Codeforces and LeetCode accounts, and the platform:

- Analyzes their current skill level, rating history, weak topics, and solved problem distribution
- Generates a personalized AI study roadmap with weekly, topic-based, and interview-mode views
- Recommends unsolved problems tailored to the user's exact solved history and current rating
- Explains any competitive programming problem in full educational detail (razbor) — **no code editor; users learn the approach, then solve on the original platform**
- Tracks progress over time with historical stat snapshots
- Notifies users about recommended problems and milestones based on their goals

**The goal:** Make the journey from beginner to legend-level competitive programmer faster and more structured than anything currently available on Codeforces or LeetCode.

---

## Vault protocol

The vault at `OlympIQ_vault/` is the fastest way to load project context — prefer it over re-reading code.

| Task | Read in order |
|------|--------------|
| Backend work | `06 - Active Issues.md` → `Backend/04 - Backend.md` |
| Frontend work | `06 - Active Issues.md` → `Frontend/05 - Frontend.md` |
| Architecture / DB | `03 - Architecture.md` |
| Full orientation | All notes `00 - Index.md` through `07 - Decisions Log.md` |

---

## Brain update protocol — MANDATORY after every task

**This is not optional. After finishing any piece of work — fix, feature, improvement — you MUST write to the vault. No exceptions.**

### What to update and where

| Event | Where to write |
|-------|---------------|
| Bug fixed | Add a row to `06 - Active Issues.md` "Recently Fixed" table: date, what broke, exact fix |
| New bug or blocker discovered | Add to `06 - Active Issues.md` "In Progress" section immediately |
| Feature completed | Update `01 - Project Status.md` — mark step done, update "Files modified", update "Next tasks" |
| Architectural decision made | Add entry to `07 - Decisions Log.md` with the decision and WHY |
| "Gotcha" discovered (API quirk, env issue, library behavior) | Add to `06 - Active Issues.md` "Watch List" |
| Session ends | Append a bullet to `Sessions/README.md` with: date, what was done, what was fixed, what's next |

### What counts as "every fk thing"

- A 500 was caused by X → write the root cause and fix
- An env var was wrong → write the correct format
- An API returns data in unexpected shape → write the shape
- A CSS class was missing → write what was added and why
- A workflow pattern was discovered → write it so it's never rediscovered
- Anything that took more than 5 minutes to debug → write it

### The goal

The vault is a brain. Each session it gets smarter. Claude reads the brain at the start of every session. If you write the lesson, Claude will never repeat that mistake. If you don't write it, Claude will make the same mistake next time.

**Read vault at start → Do work → Write lessons to vault → Next session is smarter.**

### ⚠️ NON-NEGOTIABLE RULE

After EVERY response where you changed code, fixed a bug, added a feature, or discovered anything new:
1. Update `OlympIQ_vault/06 - Active Issues.md` — add to Recently Fixed or Watch List
2. Update `OlympIQ_vault/01 - Project Status.md` — sync modified files and next tasks
3. If it was a session with multiple changes, add one line to `OlympIQ_vault/Sessions/README.md`

If you skip this, the user will ask the same question again next session. Do not skip it.

---

## n8n AI Agents

Two production agents. Both use `When Last Node Finishes` mode. Backend unwraps `[{"output":"..."}]` envelope automatically.

| Agent | Webhook URL | Input format |
|-------|-------------|-------------|
| Problem Analyzer | `https://kair97.app.n8n.cloud/webhook/olympiq-problem-analysis` | `{ "problem_url": "string" }` |
| Roadmap Generator | `https://kair97.app.n8n.cloud/webhook/coding-roadmap` | See payload builder in `callN8NRoadmap()` |

**Analyzer** — called from `ai_service.go:AnalyzeProblem()` when `N8N_ANALYZER_URL` is set in `.env`
**Roadmap** — called from `ai_service.go:GenerateRoadmap()` when `N8N_ROADMAP_URL` is set in `.env`

Both fall back to Gemini if the env var is empty.

User data for roadmap is fetched live from Codeforces API + alfa-leetcode-api before the n8n call — the payload always contains real stats, never hardcoded sample data.

---

## Design system

Build the React + TypeScript + Tailwind frontend **matching the design in `OlympIQ - Atelier (standalone).html`**. Use the source files in `shared/` and `atelier.html` as your reference for component structure, CSS variable names, and visual treatment. Follow `HANDOFF.md` for the port plan.

### Design tokens (Atelier direction — copy exactly)

```css
/* Fonts */
--font-ui:   "Inter", system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;

/* Dark theme (default) */
--bg:        oklch(0.20 0.012 270);
--bg-sunken: oklch(0.17 0.010 270);
--bg-elev:   oklch(0.26 0.014 270);
--panel:     oklch(0.23 0.012 270);

--line:        oklch(0.32 0.012 270 / 0.55);
--line-strong: oklch(0.42 0.014 270 / 0.8);

--text:       oklch(0.96 0.006 90);
--text-dim:   oklch(0.78 0.010 90);
--text-faint: oklch(0.58 0.012 90);

--accent:      oklch(0.72 0.16 305);   /* purple-violet */
--accent-2:    oklch(0.72 0.20 25);    /* warm complement */
--accent-soft: oklch(0.72 0.16 305 / 0.14);
--accent-fg:   oklch(0.92 0.08 305);
--accent-on:   oklch(0.18 0.01 280);

--ok:   oklch(0.76 0.15 150);
--warn: oklch(0.78 0.15 75);
--err:  oklch(0.70 0.20 25);

--radius:    12px;
--radius-sm: 8px;
--radius-lg: 16px;
```

Three themes: `dark` (default), `dim`, `light`. Toggle via `data-theme` on `<html>`.

### Visual style rules
- App shell: 248px fixed sidebar + fluid main content area, IDE-like layout
- All panels: `background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);`
- Active nav item: `background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent);`
- Buttons: ghost (`oq-btn-ghost`) and primary (`oq-btn-primary`) — exact classes from Atelier CSS
- Typography: Inter for all UI text; JetBrains Mono for handles, ratings, tags, monospace labels
- Status bar: full-width footer row with colored dot indicators for service health
- **No code editor anywhere in the application** — the Analyzer is a read-and-learn tool only

---

## Tech stack

### Backend
- **Language:** Go (Golang)
- **Framework:** Fiber v2
- **Database:** PostgreSQL 16
- **ORM:** sqlc (type-safe SQL) + golang-migrate for migrations
- **Cache:** Redis 7
- **Auth:** JWT RS256 — access token 15 min TTL, refresh token 7 days, httpOnly cookies
- **AI:** Claude API (Anthropic) via Go HTTP client
- **External APIs:** Codeforces REST API, alfa-leetcode-api (self-hosted or public)
- **Logging:** Zap (structured JSON)
- **Config:** godotenv, never hardcoded secrets

### Frontend
- **Framework:** React 18 + TypeScript
- **Styling:** Tailwind CSS v3 + Atelier CSS variable system
- **State:** Zustand
- **HTTP:** Axios with interceptors for token refresh
- **Routing:** React Router v6
- **Build:** Vite

### Infrastructure
- Docker + Docker Compose (7 services)
- Nginx (reverse proxy, TLS termination)
- Prometheus + Grafana
- Multi-stage Dockerfiles

---

## Project structure

```
olympiq/
├── backend/
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── config/config.go
│   │   ├── middleware/
│   │   │   ├── auth.go
│   │   │   ├── ratelimit.go
│   │   │   ├── cors.go
│   │   │   ├── logger.go
│   │   │   └── recover.go
│   │   ├── handlers/
│   │   │   ├── auth.go
│   │   │   ├── profile.go
│   │   │   ├── accounts.go
│   │   │   ├── stats.go
│   │   │   ├── roadmap.go
│   │   │   ├── recommendations.go
│   │   │   └── analyzer.go
│   │   ├── services/
│   │   │   ├── auth_service.go
│   │   │   ├── profile_service.go
│   │   │   ├── codeforces_service.go
│   │   │   ├── leetcode_service.go
│   │   │   ├── ai_service.go
│   │   │   ├── recommendation_service.go
│   │   │   └── stats_service.go
│   │   ├── repository/
│   │   │   ├── user_repo.go
│   │   │   ├── platform_repo.go
│   │   │   ├── stats_repo.go
│   │   │   ├── roadmap_repo.go
│   │   │   ├── goals_repo.go
│   │   │   └── analyses_repo.go
│   │   ├── models/
│   │   │   ├── user.go
│   │   │   ├── platform.go
│   │   │   ├── stats.go
│   │   │   ├── roadmap.go
│   │   │   ├── goals.go
│   │   │   └── analysis.go
│   │   └── metrics/prometheus.go
│   ├── db/migrations/
│   ├── Dockerfile
│   └── go.mod
├── frontend/
│   ├── public/
│   └── src/
│       ├── pages/
│       │   ├── Landing.tsx
│       │   ├── Register.tsx
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Profile.tsx
│       │   ├── Roadmap.tsx
│       │   ├── Analyzer.tsx
│       │   └── About.tsx
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   └── StatusBar.tsx
│       │   ├── ui/
│       │   └── features/
│       │       ├── PlatformCard.tsx
│       │       ├── TopicBars.tsx
│       │       ├── HeatMap.tsx
│       │       ├── RoadmapWeek.tsx
│       │       ├── RoadmapTopic.tsx
│       │       ├── InterviewMode.tsx
│       │       ├── GoalModal.tsx
│       │       ├── RecommendedProblems.tsx
│       │       ├── ProblemLink.tsx
│       │       ├── RazborPanel.tsx
│       │       ├── PlatformConnect.tsx
│       │       └── AnalysisHistory.tsx
│       ├── store/
│       │   ├── authStore.ts
│       │   ├── statsStore.ts
│       │   ├── roadmapStore.ts
│       │   └── analyzerStore.ts
│       ├── api/
│       ├── hooks/
│       └── types/
├── nginx/nginx.conf
├── monitoring/
│   ├── prometheus.yml
│   └── grafana/dashboards/
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.example
```

---

## Database schema

```sql
-- 001_create_users.up.sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 002_create_platform_accounts.up.sql
CREATE TABLE platform_accounts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform       TEXT NOT NULL CHECK (platform IN ('codeforces', 'leetcode')),
    handle         TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ,
    UNIQUE(user_id, platform)
);

-- 003_create_user_stats.up.sql
CREATE TABLE user_stats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL,
    rating          INT,
    rank            TEXT,
    max_rating      INT,
    problems_solved INT,
    contest_count   INT,
    raw_data        JSONB,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 004_create_user_goals.up.sql
CREATE TABLE user_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_type       TEXT NOT NULL,  -- 'rating' | 'interview' | 'topic_mastery'
    target_rating   INT,
    target_date     DATE,
    notify_daily    BOOLEAN NOT NULL DEFAULT false,
    notify_weekly   BOOLEAN NOT NULL DEFAULT false,
    notify_problems BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 005_create_roadmaps.up.sql
CREATE TABLE roadmaps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content      JSONB NOT NULL,
    mode         TEXT NOT NULL DEFAULT 'weekly',  -- 'weekly' | 'topic' | 'interview'
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 006_create_analyses.up.sql
CREATE TABLE analyses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_url   TEXT NOT NULL,
    problem_title TEXT,
    platform      TEXT,  -- 'codeforces' | 'leetcode' | 'other'
    analysis_text TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 007_create_refresh_tokens.up.sql
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_platform_accounts_user_id ON platform_accounts(user_id);
CREATE INDEX idx_user_stats_user_id        ON user_stats(user_id);
CREATE INDEX idx_user_goals_user_id        ON user_goals(user_id);
CREATE INDEX idx_roadmaps_user_id          ON roadmaps(user_id);
CREATE INDEX idx_analyses_user_id          ON analyses(user_id);
CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
```

---

## API routes

All routes prefixed `/api/v1`.

```
# Auth
POST   /auth/register          → { email, username, password }
POST   /auth/login             → sets httpOnly cookies (access + refresh tokens)
POST   /auth/logout            → invalidates refresh token
POST   /auth/refresh           → rotates access token using refresh token

# Profile  [auth required]
GET    /profile                → { id, email, username, created_at }
PUT    /profile                → update username and/or email
PUT    /profile/password       → { current_password, new_password, confirm_password }
DELETE /profile                → delete account + all data

# Platform accounts  [auth required]
POST   /accounts/connect       → { platform: "codeforces"|"leetcode", handle: "string" }
DELETE /accounts/:platform     → disconnect and remove stats for that platform
POST   /accounts/sync          → trigger full re-sync for all connected platforms
GET    /stats                  → latest aggregated stats for the user

# Goals  [auth required]
GET    /goals                  → current goals + notification preferences
PUT    /goals                  → { goal_type, target_rating, target_date, notify_* }

# Roadmap  [auth required]
POST   /roadmap/generate       → { mode: "weekly"|"topic"|"interview" } — calls Claude, stores result
GET    /roadmap                → latest stored roadmap

# Recommendations  [auth required]
GET    /recommendations        → AI-curated unsolved problems
                                 query: ?topic=dp&mode=interview&limit=10

# Problem Analyzer  [auth required]
POST   /analyze                → { problem_url: "https://..." } — calls Claude, stores result
GET    /analyses               → paginated list  (?page=1&limit=20)
GET    /analyses/:id           → single saved analysis

# System
GET    /health                 → liveness (public)
GET    /ready                  → readiness: DB + Redis check (public)
GET    /metrics                → Prometheus metrics
```

---

## External API integrations

### Codeforces REST API

Base URL: `https://codeforces.com/api`
No auth required for public data. Rate limit: max 1 request per 2 seconds. Cache all responses in Redis for 1 hour.

#### Endpoints used and what we extract

**1. `GET /user.info?handles={handle}`**
Returns a `User` object. Fields we use:
```
handle, rating, rank, maxRating, maxRank, contribution,
lastOnlineTimeSeconds, registrationTimeSeconds, avatar
```
Used when: user connects their Codeforces account (validate handle exists + get initial stats).

**2. `GET /user.rating?handle={handle}`**
Returns a list of `RatingChange` objects (full contest history). Fields we use:
```
contestId, contestName, rank, ratingUpdateTimeSeconds, oldRating, newRating
```
Used when: rendering rating history chart on Dashboard; calculating rating delta and trend.

**3. `GET /user.status?handle={handle}&from=1&count=500`**
Returns a list of `Submission` objects sorted by descending id. Fields we use:
```
id, creationTimeSeconds,
problem.contestId, problem.index, problem.name, problem.rating, problem.tags,
verdict  (we only count verdict == "OK")
```
Used when: building the solved-problem list for the recommendation engine and roadmap generation; computing topic coverage and weak-topic detection.

#### How to construct a problem URL from a submission
```
https://codeforces.com/contest/{problem.contestId}/problem/{problem.index}
```

#### How to detect solved problems
Filter submissions where `verdict == "OK"`. Deduplicate by `{contestId}/{index}` — a problem is solved once regardless of how many times the user submitted.

#### Topic / tag mapping from Codeforces tags
Tags returned by the API (e.g. `dp`, `graphs`, `greedy`, `math`, `binary search`, `two pointers`, `data structures`, `implementation`) map directly to our roadmap topics. Build a frequency map: `{ tag → solved_count }`.

---

### LeetCode API (alfa-leetcode-api)

We use the **alfa-leetcode-api** open-source proxy. Self-host it as a Docker service, or use the public instance at `https://alfa-leetcode-api.onrender.com`.

Add to Docker Compose:
```yaml
leetcode-api:
  image: alfaarghya/alfa-leetcode-api:2.0.4
  ports:
    - "3002:3000"
  restart: unless-stopped
```

Set env var: `LEETCODE_API_URL=http://leetcode-api:3000`

Cache all responses in Redis for 1 hour.

#### Endpoints used and what we extract

**1. `GET /{username}/profile`** — Full profile in one call
```json
{
  "username": "string",
  "ranking": 12345,
  "reputation": 100,
  "totalSolved": 234,
  "totalSubmissions": [...],
  "easySolved": 80, "mediumSolved": 120, "hardSolved": 34,
  "acceptanceRate": "62.5%",
  "contributionPoints": 10,
  "postViewCount": 500
}
```
Used when: user connects their LeetCode account; stats sync.

**2. `GET /{username}/solved`** — Solved counts by difficulty
```json
{
  "solvedProblem": 234,
  "easySolved": 80,
  "mediumSolved": 120,
  "hardSolved": 34
}
```
Used when: Dashboard stat cards.

**3. `GET /{username}/contest`** — Contest participation
```json
{
  "contestAttend": 15,
  "contestRating": 1823,
  "contestGlobalRanking": 45000,
  "totalParticipants": 300000,
  "contestTopPercentage": 15.0
}
```
Used when: Displaying contest rank on Platform stat card.

**4. `GET /{username}/acSubmission?limit=100`** — Last 100 accepted submissions
```json
{
  "submission": [
    {
      "title": "Two Sum",
      "titleSlug": "two-sum",
      "timestamp": "1700000000",
      "statusDisplay": "Accepted",
      "lang": "python3"
    }
  ]
}
```
Used when: Building solved-problem list for recommendation engine; submission heatmap.

**5. `GET /{username}/skill`** — Skill topic breakdown
```json
{
  "data": {
    "advanced": [{ "tagName": "Dynamic Programming", "problemsSolved": 45 }],
    "intermediate": [{ "tagName": "Binary Search", "problemsSolved": 30 }],
    "fundamental": [{ "tagName": "Array", "problemsSolved": 80 }]
  }
}
```
Used when: Topic skill bars on Dashboard; weak-topic detection for AI roadmap.

**6. `GET /{username}/calendar`** — Submission calendar (heatmap data)
```json
{
  "submissionCalendar": { "1700000000": 3, "1700086400": 1 }
}
```
Used when: Rendering the heatmap on Dashboard.

#### How to construct a LeetCode problem URL from titleSlug
```
https://leetcode.com/problems/{titleSlug}/
```

---

## Feature specifications

### Analyzer (Razbor) — no code editor, external links only

The Analyzer is a **read-and-learn** tool. There is no code editor, no submission, no run button.

**UI layout — 2 columns:**
- **Left — Problem pane:** title, source badge, rating pill, tags, problem statement, input/output samples, constraints
- **Right — Razbor panel:** AI analysis with tabbed sections

**Problem pane requirements:**
- `oq-actions` button row prominently placed below the title:
  - `<a href="{original_url}" target="_blank" rel="noopener">Solve on Codeforces ↗</a>` — styled as `oq-btn-primary oq-btn-lg`
  - `<a href="{original_url}" target="_blank" rel="noopener">Solve on LeetCode ↗</a>` — if LC problem
- Tags as `<a>` elements linking to the platform's tag search page
- Analysis history sidebar (past analyses with search)

**Razbor panel output sections (rendered from Claude JSON response):**
1. **Classification** — problem type pill, difficulty confidence bar
2. **Key Observations** — bullet list
3. **Algorithm Approach** — description + collapsible progressive hints
4. **Step-by-Step Solution Logic** — numbered steps, no code
5. **Time & Space Complexity** — two-column grid
6. **Common Mistakes** — bullet list
7. **Similar Problems** — list, each with external link button to the platform URL

---

### Roadmap — three modes + goal system

Three view modes via `oq-mode-tabs`:

**1. Weekly Plan (`mode=weekly`)**
- Collapsible week accordions with theme, progress bar, and problem list
- Each problem: title, tags, difficulty pill, **"Solve ↗"** external link, **"Analyze"** button

**2. By Topic (`mode=topic`)**
- Grid of topic cards: topic name, why recommended, skill strength bar, problem list
- Each problem has platform link + analyze button

**3. Interview Prep (`mode=interview`)**
- Curated set targeting SWE interview patterns
- Pattern frequency bars
- Each problem has platform link + analyze button

**Goal card (top of Roadmap page):**
- Current rating → target rating progress bar with milestone marker
- Stats: solved this week, streak, time remaining, topics mastered
- Notification toggles: daily problems, weekly digest, level-up alerts
- "Set Goals" → `GoalModal` (goal type, target rating, target date)

**Recommended problems widget (on Dashboard + Roadmap):**
- From `GET /recommendations`
- Each item: problem title, why recommended, difficulty, platform, **"Solve ↗"** external link

---

### Profile — account settings + platform management

Two-column grid (`oq-prof-grid`) with cards:

**Identity card (full width):** avatar with initials, inline edit for username and email → `PUT /profile`

**Change password card:** current password + new password + confirm → `PUT /profile/password`
- Validate: new ≥ 8 chars, new ≠ current, confirm matches new

**Connected platforms card (full width):**
Each platform row (`oq-platform`):
- Connected: shows handle, "Sync" button → `POST /accounts/sync`, "Disconnect" button with danger style → `DELETE /accounts/:platform` + confirmation modal
- Not connected: handle text input + "Connect" button → `POST /accounts/connect`
- Platforms: Codeforces, LeetCode

**Notification preferences card:** checkboxes synced to goals API

**Danger zone card (`oq-danger-card`):** Delete Account — requires typing username to confirm

---

## Claude AI prompts

These are the exact system and user prompts for each AI feature. Pass them verbatim from `ai_service.go`.

### 1. Roadmap Generation

**System prompt:**
```
You are OlympIQ Coach, an expert competitive programming mentor with deep knowledge of Codeforces, LeetCode, and competitive programming pedagogy.

Your task is to generate a highly personalized study roadmap based on the student's real statistics. You must analyze what they have already solved, identify their genuine weak areas, and prescribe specific next steps.

Rules:
- Be specific, not generic. Do not recommend topics the student has already mastered.
- Every problem recommendation must include a real, working URL on Codeforces or LeetCode.
- Difficulty must be calibrated: for Codeforces problems, recommend problems 100-200 rating points above the student's current level for learning, and at their level for confidence building.
- Explain WHY each topic or problem is recommended for this specific student.
- Return ONLY valid JSON matching the schema below. No markdown, no explanation text, no code fences.

JSON schema for mode="weekly":
{
  "mode": "weekly",
  "generated_at": "ISO8601",
  "goal_summary": "string — one sentence describing the plan goal",
  "weeks": [
    {
      "week": 1,
      "theme": "string",
      "focus_topics": ["string"],
      "problems": [
        {
          "title": "string",
          "platform": "codeforces" | "leetcode",
          "url": "string — full URL",
          "rating": integer | null,
          "difficulty": "easy" | "medium" | "hard" | null,
          "tags": ["string"],
          "reason": "string — 1 sentence, personalized to this student"
        }
      ]
    }
  ]
}

JSON schema for mode="topic":
{
  "mode": "topic",
  "generated_at": "ISO8601",
  "topics": [
    {
      "name": "string",
      "why": "string — why this topic needs work",
      "strength_score": 0.0-1.0,
      "problems": [ ...same problem schema as above... ]
    }
  ]
}

JSON schema for mode="interview":
{
  "mode": "interview",
  "generated_at": "ISO8601",
  "target_companies": ["string"],
  "patterns": [
    {
      "name": "string",
      "frequency": 0.0-1.0,
      "problems": [ ...same problem schema as above... ]
    }
  ]
}
```

**User message (assembled in Go):**
```
Generate a {mode} roadmap for this student.

== STUDENT STATISTICS ==
Codeforces Handle: {handle or "not connected"}
Codeforces Rating: {rating} ({rank})
Codeforces Max Rating: {max_rating} ({max_rank})
Codeforces Contests Participated: {contest_count}

Solved problems by topic (from last 500 submissions):
{for each tag: "  - {tag}: {solved_count} problems solved"}

Recent rating trajectory (last 5 contests):
{for each: "  - {contest_name}: {old_rating} → {new_rating} (rank #{rank})"}

LeetCode Handle: {handle or "not connected"}
LeetCode Ranking: #{ranking}
LeetCode Solved: {total} total ({easy} easy / {medium} medium / {hard} hard)
LeetCode Contest Rating: {contest_rating}

LeetCode skill breakdown:
{for each skill category: "  - {tagName}: {problemsSolved} solved"}

== STUDENT GOALS ==
Goal type: {goal_type}
Target rating: {target_rating or "not set"}
Target date: {target_date or "not set"}

== INSTRUCTIONS ==
Mode: {mode}
Generate a focused, realistic plan. Be specific about which problems to solve and why.
Every problem URL must be real and directly accessible.
```

---

### 2. Problem Analyzer (Razbor)

**System prompt:**
```
You are OlympIQ Razbor, an expert competitive programming instructor who specializes in teaching algorithmic thinking.

Your role is to provide a deep educational breakdown of competitive programming problems — helping students understand the approach, not just the answer. You never provide a complete working solution or final code. Instead, you teach the reasoning process.

Rules:
- Never write a complete solution or full working code.
- Hints must be progressive — each hint reveals a little more, not the full answer.
- Similar problems must have real, working URLs.
- All ratings are Codeforces difficulty scale (800–3500) or LeetCode difficulty (easy/medium/hard).
- Return ONLY valid JSON matching the schema below. No markdown, no explanation text, no code fences.

JSON schema:
{
  "problem_title": "string",
  "platform": "codeforces" | "leetcode" | "other",
  "problem_url": "string",
  "classification": {
    "type": "string — e.g. Dynamic Programming, Graph Theory, Greedy",
    "subtype": "string — e.g. Knapsack, Shortest Path, Exchange Argument",
    "difficulty_label": "string — Codeforces rating or LC Easy/Medium/Hard",
    "confidence": 0.0-1.0
  },
  "key_observations": ["string — each is one insight needed to solve the problem"],
  "algorithm_approach": {
    "summary": "string — 2-3 sentences describing the high-level approach",
    "hints": [
      { "level": 1, "text": "string — gentle nudge, reveals nothing" },
      { "level": 2, "text": "string — points toward the right data structure or technique" },
      { "level": 3, "text": "string — describes the approach clearly but not the implementation" }
    ]
  },
  "solution_steps": [
    "string — step 1: what to do conceptually",
    "string — step 2: ...",
    "..."
  ],
  "complexity": {
    "time": "string — e.g. O(n log n)",
    "space": "string — e.g. O(n)",
    "note": "string — explain why, edge cases, potential TLE pitfalls"
  },
  "common_mistakes": ["string — each is a concrete mistake students make on this problem"],
  "similar_problems": [
    {
      "title": "string",
      "platform": "codeforces" | "leetcode",
      "url": "string — full URL",
      "rating": integer | null,
      "tags": ["string"],
      "similarity_reason": "string — why this problem is good follow-up practice"
    }
  ]
}
```

**User message (assembled in Go):**
```
Analyze this competitive programming problem:

URL: {problem_url}

{if problem statement scraped or provided:}
== PROBLEM STATEMENT ==
{problem_text — max 8000 chars, sanitized}

Provide a complete educational razbor. Do not write any working solution code.
```

---

### 3. Problem Recommendations

**System prompt:**
```
You are OlympIQ Recommender, a competitive programming coach who selects the most effective next problems for a student to practice.

Your goal is to identify unsolved problems that will produce the maximum learning improvement for this specific student — filling gaps, reinforcing weak areas, and slightly stretching their comfort zone.

Rules:
- Never recommend problems the student has already solved (the solved list is provided).
- Difficulty calibration: mix 60% at current level (for confidence) and 40% slightly above (for growth).
- Every problem URL must be real and directly accessible on Codeforces or LeetCode.
- The reason field must be specific to this student — reference their actual stats.
- Return ONLY a valid JSON array. No markdown, no explanation text, no code fences.

JSON schema:
[
  {
    "title": "string",
    "platform": "codeforces" | "leetcode",
    "url": "string — full URL",
    "rating": integer | null,
    "difficulty": "easy" | "medium" | "hard" | null,
    "tags": ["string"],
    "reason": "string — specific 1-sentence explanation referencing this student's stats"
  }
]
```

**User message (assembled in Go):**
```
Recommend 10 unsolved problems for this student.

== STUDENT PROFILE ==
Codeforces Rating: {rating} ({rank})
Codeforces Solved Topics: {tag → count map as text}
LeetCode Solved: {easy}/{medium}/{hard}
LeetCode Weak Topics: {lowest skill tags}

== FILTER (DO NOT RECOMMEND THESE — already solved) ==
Codeforces solved: {list of "contestId/index" strings, comma-separated}
LeetCode solved: {list of titleSlug strings, comma-separated}

== REQUEST ==
Topic filter: {topic or "any"}
Mode: {mode or "general"}
Return exactly 10 problems.
```

---

### Assembling the student context payload (Go helper)

Create `ai_service.go` with a `buildStudentContext(userID)` function that:
1. Fetches latest `user_stats` snapshots for all connected platforms from PostgreSQL
2. Fetches `user_goals` for the user
3. Fetches the solved problem list from the cached Codeforces `user.status` response (Redis key: `cf:status:{handle}`) and LeetCode `acSubmission` response (Redis key: `lc:acsub:{handle}`)
4. Builds the tag frequency map from CF submissions where `verdict == "OK"`
5. Returns a `StudentContext` struct used by all three AI features

This function is called before every Claude API request to ensure the AI always has fresh, real data.

---

## Codeforces service — implementation notes

File: `internal/services/codeforces_service.go`

```go
// Fetch order on sync:
// 1. GET /user.info?handles={handle}           → store rating, rank, maxRating, avatar
// 2. GET /user.rating?handle={handle}           → store contest history in raw_data JSONB
// 3. GET /user.status?handle={handle}&count=500 → store solved list; build tag map

// Redis cache keys:
// "cf:info:{handle}"   TTL 1h
// "cf:rating:{handle}" TTL 1h
// "cf:status:{handle}" TTL 1h

// Rate limiting: enforce 1 request per 2 seconds to CF API using a Go time.Sleep
// or a Redis-based token bucket per backend instance.

// Error handling:
// CF API returns { "status": "FAILED", "comment": "..." } for bad handles.
// Check status field before parsing result. Return typed errors.
```

---

## LeetCode service — implementation notes

File: `internal/services/leetcode_service.go`

```go
// Base URL from env: LEETCODE_API_URL (default: http://leetcode-api:3000)

// Fetch order on sync:
// 1. GET /{handle}/profile            → ranking, totalSolved, easy/medium/hard counts
// 2. GET /{handle}/contest            → contestRating, contestAttend, contestTopPercentage  
// 3. GET /{handle}/acSubmission?limit=100 → last 100 accepted (for solved list + heatmap)
// 4. GET /{handle}/skill              → topic breakdown for weak-area detection
// 5. GET /{handle}/calendar           → submissionCalendar for heatmap

// Redis cache keys:
// "lc:profile:{handle}"  TTL 1h
// "lc:contest:{handle}"  TTL 1h
// "lc:acsub:{handle}"    TTL 1h
// "lc:skill:{handle}"    TTL 1h
// "lc:calendar:{handle}" TTL 1h

// Error handling: alfa-leetcode-api returns HTTP 404 for invalid usernames.
// Wrap all HTTP calls with retry (max 2 retries, 500ms backoff).
```

---

## Security requirements

1. Passwords hashed with bcrypt cost 12.
2. JWT RS256. Access TTL: 15 min. Refresh TTL: 7 days.
3. All tokens in httpOnly, Secure, SameSite=Strict cookies — never readable by JavaScript.
4. Rate limiting via Redis: 10 req/min on `/auth/*`; 60 req/min on all others.
5. Input validation on every field with go-playground/validator.
6. Parameterized SQL only — zero string concatenation in queries.
7. CORS restricted to exact `FRONTEND_URL`.
8. Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin`, `Content-Security-Policy: default-src 'self'`.
9. Errors to client: never expose stack traces, internal paths, or SQL errors. Log full detail internally.
10. All secrets via env vars. `.env` in `.gitignore`.
11. Docker: non-root users. No privileged mode.
12. Nginx: HTTP → HTTPS redirect. TLS at proxy.
13. AI input: sanitize URLs and text before sending to Claude. Max 10,000 chars.
14. Password change: verify current password before accepting new one.
15. Platform disconnect: confirm modal required, then revoke all cached data for that handle.

---

## Prometheus metrics

```go
var (
    httpRequestsTotal   = prometheus.NewCounterVec(...)   // labels: method, path, status
    httpRequestDuration = prometheus.NewHistogramVec(...) // labels: endpoint
    aiRequestsTotal     = prometheus.NewCounterVec(...)   // labels: type (roadmap|analysis|recommendations)
    aiRequestDuration   = prometheus.NewHistogram(...)    // Claude API latency
    cfSyncTotal         = prometheus.NewCounterVec(...)   // labels: handle, status
    lcSyncTotal         = prometheus.NewCounterVec(...)   // labels: handle, status
    activeUsersGauge    = prometheus.NewGauge(...)        // current active sessions
    dbConnectionsGauge  = prometheus.NewGauge(...)        // DB pool size
)
```

---

## Docker Compose services

```yaml
services:
  backend:      # Go Fiber API — port 8080
  frontend:     # React (Nginx static) — port 3000
  postgres:     # PostgreSQL 16
  redis:        # Redis 7 Alpine
  leetcode-api: # alfa-leetcode-api:2.0.4 — port 3002
  nginx:        # Reverse proxy — ports 80, 443
  prometheus:   # port 9090
  grafana:      # port 3001
```

All services: `healthcheck`, `restart: unless-stopped`, named volumes, non-root user.

---

## Environment variables (.env.example)

```env
# App
APP_ENV=development
APP_PORT=8080
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgres://olympiq:password@postgres:5432/olympiq?sslmode=disable

# Redis
REDIS_URL=redis://redis:6379

# JWT  (generate: openssl genrsa -out private.pem 2048 && openssl rsa -in private.pem -pubout -out public.pem)
JWT_PRIVATE_KEY=<RSA private key base64>
JWT_PUBLIC_KEY=<RSA public key base64>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=168h

# Claude AI
ANTHROPIC_API_KEY=<your Anthropic API key>
CLAUDE_MODEL=claude-sonnet-4-20250514

# External APIs
LEETCODE_API_URL=http://leetcode-api:3000
# CODEFORCES_API_KEY=<optional, for authenticated CF endpoints>
# CODEFORCES_API_SECRET=<optional>

# Monitoring
GRAFANA_ADMIN_PASSWORD=<strong password>
```

---

## Testing requirements

### Backend (Go)
- Unit tests for all service functions, table-driven
- Integration tests for all API endpoints using `httptest`
- End-to-end: register → login → protected route → token refresh → logout
- Password change: correct current password succeeds; wrong current password returns 401
- Platform connect: validates handle with real API mock; duplicate connect returns 409
- Platform disconnect: removes account and clears Redis cache for that handle
- Rate limiting: 11th auth request in 1 minute returns 429
- Codeforces service: mock `user.info`, `user.rating`, `user.status` HTTP responses
- LeetCode service: mock `/{handle}/profile`, `/{handle}/acSubmission` responses
- AI service: mock Claude API; verify prompt contains student stats; verify JSON parsing
- Recommendation engine: given fixture solved-list, verify no already-solved problems returned
- Tool: testify. Minimum 80% coverage.

### Frontend (React)
- Vitest + React Testing Library
- All form validation: register, login, connect account, change password
- Protected routes redirect unauthenticated users
- Stats cards render correctly from mock API responses
- Roadmap mode switching renders correct component
- Analyzer page: assert NO textarea/CodeMirror/editor element; assert presence of external solve link
- Profile: connect flow shows handle input; disconnect flow shows confirmation modal

```bash
cd backend  && go test ./... -v -cover
cd frontend && npm run test
```

---

## Code quality rules

1. **Go:** `golangci-lint` before every commit. Zero errors.
2. **Go:** All exported functions have godoc comments.
3. **TypeScript:** strict mode. No `any` types.
4. No commented-out code in final output.
5. No `TODO` comments unless linked to a GitHub issue.
6. Every function does one thing. Max 50 lines.
7. All Go errors handled. `_ = err` forbidden except in `defer` close with logging.
8. All API responses:

```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null,    "error": "human-readable message" }
```

---

## Build and run

```bash
# 1. Clone
git clone <repo> && cd olympiq

# 2. Configure
cp .env.example .env
# Set: ANTHROPIC_API_KEY, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, GRAFANA_ADMIN_PASSWORD

# 3. Generate JWT keys
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
# Base64-encode and paste into .env

# 4. Build and start
docker-compose up --build

# 5. Run migrations
docker-compose exec backend ./migrate up

# 6. Access
# Frontend:     http://localhost:3000
# API:          http://localhost:8080/api/v1
# LeetCode API: http://localhost:3002
# Grafana:      http://localhost:3001  (admin / GRAFANA_ADMIN_PASSWORD)
# Prometheus:   http://localhost:9090
```

---

## Build order — step by step

Build in this exact order. Each step must have passing tests before advancing.

1.  Docker Compose skeleton — postgres + redis + leetcode-api + backend with `/health` and `/ready`
2.  Database migrations — all 7 tables + indexes
3.  Auth system — register, login, logout, refresh, change password + full tests
4.  Profile endpoints — get, update username/email, delete + tests
5.  Platform accounts — connect + disconnect endpoints + tests
6.  Codeforces service — `user.info`, `user.rating`, `user.status` + Redis caching + tests
7.  LeetCode service — profile, contest, acSubmission, skill, calendar + Redis caching + tests
8.  Stats sync handler — orchestrates CF + LC services; stores snapshots + tests
9.  Student context builder — `buildStudentContext()` aggregates all data for AI calls + tests
10. Claude AI service — base HTTP client, prompt assembly, JSON response validation + tests
11. Roadmap generation — weekly/topic/interview modes + goals API + tests
12. Recommendation engine — calls Claude with solved-list filter + tests
13. Problem analyzer — razbor endpoint + analysis history + tests
14. React frontend — auth pages (register, login) matching Atelier design
15. React frontend — app shell (sidebar, status bar, theme toggle)
16. React frontend — dashboard (platform cards, topic bars, heatmap, recommended problems)
17. React frontend — roadmap page (mode tabs, goal card, all three views, external links)
18. React frontend — analyzer page (2-column, NO editor, solve buttons, razbor panel, history)
19. React frontend — profile page (identity edit, password change, platform connect/disconnect, danger zone)
20. Nginx config + production Docker Compose + TLS setup
21. Prometheus metrics + Grafana dashboard
22. Full README with setup, architecture diagram, and API reference

**Do not skip steps. Do not advance until the current step has passing tests.**
