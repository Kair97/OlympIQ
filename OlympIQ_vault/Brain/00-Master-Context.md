---
title: Master Context
type: brain
last_updated: 2026-05-31
---

# OlympIQ — Master Context

> Read this at the start of every session. This is the single source of truth.

---

## What the project is

OlympIQ is an AI-powered competitive programming training platform. Students connect Codeforces and LeetCode accounts; the platform analyzes their skill level and generates personalized study roadmaps, problem recommendations, and educational problem breakdowns (razbor). No code editor — users solve on the original platforms; OlympIQ only analyzes and guides.

The AI layer is Google Gemini (direct REST) or n8n webhook agents (Gemini or OpenAI inside n8n). n8n is preferred when N8N_* env vars are set.

---

## Complete tech stack with versions

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend language | Go | 1.25 |
| Backend framework | Fiber v2 | v2.52.5 |
| Database | PostgreSQL | 16 |
| DB driver | pgx/v5 + pgxpool | v5.6.0 |
| DB migrations | golang-migrate | v4.19.1 |
| Cache | Redis | 7-alpine |
| Auth | JWT RS256 | golang-jwt/jwt v5.3.1 |
| Password hash | bcrypt | cost 12 |
| Validation | go-playground/validator | v10.30.2 |
| Logging | zap | v1.27.0 |
| Config | godotenv | v1.5.1 |
| AI — direct | Gemini REST API | gemini-2.5-flash (configurable) |
| AI — agent | n8n cloud webhooks | kair97.app.n8n.cloud |
| CF API | Public REST | codeforces.com/api |
| LC API | alfa-leetcode-api proxy | v2.0.4 |
| Frontend framework | React + TypeScript | React 19, TS 6.0 |
| Frontend build | Vite | v8.0 |
| Frontend styling | Tailwind CSS + Atelier CSS vars | v3.4 |
| HTTP client | Axios | v1.16 |
| State | Zustand | v5.0 |
| Routing | React Router v7 | v7.16 |
| Reverse proxy | Nginx | alpine |
| Metrics | Prometheus | latest |
| Dashboards | Grafana | latest |
| Containerization | Docker Compose | v3.9 |

---

## ALL API Routes

Base path: `/api/v1`

### Public (no auth)

| Method | Path | Body / Params | Response |
|--------|------|--------------|----------|
| GET | `/health` | — | `{status:"ok"}` |
| GET | `/ready` | — | DB + Redis ping |
| GET | `/config` | — | `{model: string}` |

### Auth (`/auth/*`) — rate limited 10 req/min

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/auth/register` | `{email, username, password}` | `{id, email, username}` + cookies |
| POST | `/auth/login` | `{email, password}` | `{id, email, username}` + cookies |
| POST | `/auth/logout` | — | clears cookies |
| POST | `/auth/refresh` | — (reads refresh_token cookie) | `{id, email, username}` + new cookies |

### Protected — rate limited 60 req/min, requires `access_token` cookie

| Method | Path | Body / Params | Response |
|--------|------|--------------|----------|
| GET | `/profile` | — | `{id, email, username, created_at}` |
| PUT | `/profile` | `{username?, email?}` | `{id, email, username}` |
| PUT | `/profile/password` | `{current_password, new_password, confirm_password}` | null |
| DELETE | `/profile` | — | null (deletes account) |
| GET | `/sessions` | — | list of refresh tokens |
| DELETE | `/sessions` | — | revoke all (sign out everywhere) |
| DELETE | `/sessions/:id` | — | revoke one session |
| GET | `/dashboard` | — | `{codeforces: CFDashboard, leetcode: LCDashboard}` |
| GET | `/accounts` | — | list of PlatformAccount |
| POST | `/accounts/connect` | `{platform, handle}` | PlatformAccount |
| DELETE | `/accounts/:platform` | — | null + clears Redis cache |
| POST | `/accounts/sync` | — | `{message: "sync completed"}` |
| GET | `/stats` | — | latest UserStats array |
| GET | `/ai/test` | — | `{status: "ok", response: string}` |
| GET | `/goals` | — | UserGoal or null |
| PUT | `/goals` | `{goal_type, target_rating?, target_date?, notify_daily, notify_weekly, notify_problems}` | UserGoal |
| POST | `/roadmap/generate` | `{mode: "weekly"|"topic"|"interview"}` | parsed roadmap JSON |
| GET | `/roadmap` | — | `{roadmap, mode, generated_at}` or null |
| GET | `/recommendations` | `?topic=&mode=&limit=10` | array of RoadmapProblem |
| POST | `/analyze` | `{problem_url}` | `{id, analysis: AnalysisContent}` |
| GET | `/analyses` | `?page=1&limit=20` | `{items, total, page, limit}` |
| GET | `/analyses/:id` | — | `{id, problem_url, analysis, created_at}` |

---

## ALL DB Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, gen_random_uuid() |
| email | TEXT | UNIQUE NOT NULL |
| username | TEXT | UNIQUE NOT NULL |
| password_hash | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

### platform_accounts
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users(id) CASCADE |
| platform | TEXT | CHECK IN ('codeforces','leetcode') |
| handle | TEXT | NOT NULL |
| last_synced_at | TIMESTAMPTZ | nullable |
| — | — | UNIQUE(user_id, platform) |

### user_stats
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users(id) CASCADE |
| platform | TEXT | NOT NULL |
| rating | INT | nullable |
| rank | TEXT | nullable |
| max_rating | INT | nullable |
| problems_solved | INT | nullable |
| contest_count | INT | nullable |
| raw_data | JSONB | nullable — see structure below |
| fetched_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

**raw_data structure for codeforces:** `{user: CFUser, tag_freq: map[string]int, sub_count: int, rating_history: []int, contest_count: int}`

**raw_data structure for leetcode:** `{profile: LCProfile, contest: LCContest, skill: LCSkill, calendar: map[string]int}`

### user_goals
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users(id) CASCADE, UNIQUE |
| goal_type | TEXT | 'rating'/'interview'/'topic_mastery' |
| target_rating | INT | nullable |
| target_date | DATE | nullable |
| notify_daily | BOOL | DEFAULT false |
| notify_weekly | BOOL | DEFAULT false |
| notify_problems | BOOL | DEFAULT false |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

### roadmaps
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users(id) CASCADE |
| content | JSONB | NOT NULL |
| mode | TEXT | DEFAULT 'weekly' |
| generated_at | TIMESTAMPTZ | NOT NULL |

### analyses
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users(id) CASCADE |
| problem_url | TEXT | NOT NULL |
| problem_title | TEXT | nullable |
| platform | TEXT | nullable |
| analysis_text | TEXT | NOT NULL (raw JSON string) |
| created_at | TIMESTAMPTZ | NOT NULL |

### refresh_tokens
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users(id) CASCADE |
| token_hash | TEXT | UNIQUE NOT NULL (SHA256 hex) |
| expires_at | TIMESTAMPTZ | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

---

## ALL Redis Keys with TTLs

| Key Pattern | TTL | What it holds |
|-------------|-----|--------------|
| `cf:info:{handle}` | 1h | JSON of CodeforcesUser struct |
| `cf:rating:{handle}` | 1h | JSON array of CodeforcesRatingChange |
| `cf:status:{handle}` | 1h | JSON array of CodeforcesSubmission (last 500) |
| `lc:profile:{handle}` | 1h | JSON of LeetCodeProfile |
| `lc:contest:{handle}` | 1h | JSON of LeetCodeContest |
| `lc:acsub:{handle}` | 1h | JSON `{submission: [...]}` wrapper |
| `lc:skill:{handle}` | 1h | JSON of LeetCodeSkill |
| `lc:calendar:{handle}` | 1h | JSON `{submissionCalendar: {ts: count}}` |
| `ratelimit:{group}:{ip}:{method}` | 60s | String counter for rate limiting |

---

## ALL Env Vars

| Variable | Example Value | Required | Purpose |
|----------|--------------|----------|---------|
| APP_ENV | development | No | "production" enables Secure cookie flag |
| APP_PORT | 8080 | No | Backend listen port |
| FRONTEND_URL | http://localhost:3000 | Yes | CORS allow-origin |
| DATABASE_URL | postgres://olympiq:password@postgres:5432/olympiq?sslmode=disable | Yes | PG connection string |
| REDIS_URL | redis://redis:6379 | No | Redis connection |
| JWT_PRIVATE_KEY | (base64 PEM) | Yes | RSA-2048 private key, base64-encoded |
| JWT_PUBLIC_KEY | (base64 PEM) | Yes | RSA-2048 public key, base64-encoded |
| JWT_ACCESS_TTL | 2h | No | Access token lifetime (currently 2h, spec says 15m) |
| JWT_REFRESH_TTL | 168h | No | Refresh token lifetime (7 days) |
| GEMINI_API_KEY | AIza... | Yes* | Google AI Studio key — MUST start with AIza |
| GEMINI_MODEL | gemini-2.5-flash | No | Model name for Gemini direct calls |
| N8N_ANALYZER_URL | https://kair97.app.n8n.cloud/webhook/olympiq-problem-analysis | No | If set, analyzer routes to n8n |
| N8N_ROADMAP_URL | https://kair97.app.n8n.cloud/webhook/coding-roadmap | No | If set, roadmap routes to n8n |
| LEETCODE_API_URL | http://leetcode-api:3000 | No | alfa-leetcode-api base URL |
| GRAFANA_ADMIN_PASSWORD | (password) | No | Grafana admin password |

*AI features silently degrade if GEMINI_API_KEY is missing/invalid.

---

## Current Build Status (as of 2026-05-31)

| Step | Description | Status |
|------|-------------|--------|
| 1 | Docker Compose skeleton | ✅ Done |
| 2 | DB migrations (001–008) | ✅ Done |
| 3 | Auth system | ✅ Done |
| 4 | Profile endpoints | ✅ Done |
| 5 | Platform accounts | ✅ Done |
| 6 | Codeforces service | ✅ Done |
| 7 | LeetCode service | ✅ Done |
| 8 | Stats sync handler | ✅ Done |
| 9 | StudentContext builder | ✅ Done |
| 10 | Claude/Gemini AI service | ✅ Done (Gemini + n8n) |
| 11 | Roadmap generation | ✅ Done |
| 12 | Recommendation engine | ✅ Done |
| 13 | Problem analyzer | ✅ Done |
| 14 | React auth pages | ✅ Done |
| 15 | App shell (sidebar, statusbar) | ✅ Done |
| 16 | Dashboard | ✅ Done |
| 17 | Roadmap page | ✅ Done |
| 18 | Analyzer page | ✅ Done (Atelier design) |
| 19 | Profile page | ✅ Done |
| 20 | Nginx production + TLS | ⬜ Pending |
| 21 | Prometheus + Grafana dashboard | ⬜ Pending |
| 22 | README + architecture diagram | ⬜ Pending |

---

## n8n Agent URLs and Payload Formats

### Analyzer webhook
- **URL:** `https://kair97.app.n8n.cloud/webhook/olympiq-problem-analysis`
- **Method:** POST
- **Input body:** `{"problem_url": "https://..."}`
- **Output:** Either raw JSON object OR `[{"output": "{...json...}"}]` array envelope
- **Backend handler:** `callN8NAnalyzer` in `ai_service.go` — auto-unwraps both formats

### Roadmap webhook
- **URL:** `https://kair97.app.n8n.cloud/webhook/coding-roadmap`
- **Method:** POST
- **Input body:**
```json
{
  "username": "handle",
  "mode": "weekly|topic|interview",
  "weekly_hours": 15,
  "codeforces": {
    "rating": 1400,
    "rank": "specialist",
    "problems_solved": 245,
    "topics": {"dp": 45, "greedy": 30},
    "rating_history": [1200, 1300, 1400]
  },
  "leetcode": {
    "total_solved": 120,
    "easy": 60,
    "medium": 50,
    "hard": 10,
    "topics": {"Array": 40, "Dynamic Programming": 20}
  },
  "goal": "rating",
  "deadline": "2026-12-31",
  "target_rating": 2000
}
```
- **Output:** Same envelope format as analyzer. Backend handler: `callN8NRoadmap`

---

## Top 10 "Don't Forget" Rules

1. **isAuthRoute guard** — `client.ts` Axios interceptor must skip 401→refresh for `/auth/` routes. Login 401 must NOT trigger a refresh loop. Never remove this guard.

2. **ErrExternal wrapping** — All external API calls (Gemini, n8n, CF, LC) must wrap errors with `fmt.Errorf("%w: ...", ErrExternal, ...)`. If not wrapped, `mapServiceErr` hits `default` → returns 500 instead of 502.

3. **Gemini API key format** — Must start with `AIza`. Key starting with `AQ.` is invalid and will cause HTML error pages that fail JSON parsing.

4. **n8n webhook mode** — Must be set to "When Last Node Finishes", NOT "Using Respond to Webhook Node". AI takes 15-30s; Respond-to-Webhook times out at ~10s.

5. **n8n max tokens** — Set to 8192 in the Gemini/AI node. Default 1024/2048 produces truncated JSON that breaks parsing.

6. **stripMarkdownFences before json.Unmarshal** — Gemini sometimes wraps JSON in ```json``` fences despite being told not to. Always strip before parsing.

7. **LeetCode direct URLs return 403** — Never call `leetcode.com` directly from backend. Only use `alfa-leetcode-api` proxy. The `leetcode.com/problems/...` links in the UI are `<a target="_blank">` for the user's browser — not backend calls.

8. **bcrypt cost 12** — Password hashing uses cost 12. Do not change.

9. **AppShell useEffect** — Empty dep array `[]` on the refresh effect. Do NOT add navigate/setUser/setLoading as deps — causes infinite refresh loop.

10. **user_goals UNIQUE constraint** — Migration 008 adds UNIQUE(user_id). PUT /goals does an upsert (INSERT ON CONFLICT UPDATE). If this migration hasn't run, goal updates throw 409.

---

## Top 10 Known Errors with Exact Fixes

| # | Error | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | POST /analyze returns 500 | `json.Unmarshal` error not wrapped with `ErrExternal` | `fmt.Errorf("%w: failed to parse ...", ErrExternal, err)` |
| 2 | Login form clears on wrong password | Axios 401 interceptor catches /auth/login, triggers refresh, then reloads page | `const isAuthRoute = original?.url?.startsWith('/auth/')` guard in `client.ts` |
| 3 | GEMINI_API_KEY `AQ.` prefix invalid | Google AI Studio keys must start with `AIza` | Get new key at aistudio.google.com/apikey |
| 4 | Roadmap returns 500 — markdown fence in JSON | Gemini wraps JSON in ```json``` despite instructions | `stripMarkdownFences()` before `json.Unmarshal` |
| 5 | `user_goals` unique constraint violation | No UNIQUE constraint on user_id, Upsert inserts duplicates | Run migration 008 / ALTER TABLE user_goals ADD CONSTRAINT user_goals_user_id_unique UNIQUE (user_id) |
| 6 | JWT "unsupported key type" panic | openssl 3.x generates PKCS8 (PRIVATE KEY header) not PKCS1 (RSA PRIVATE KEY) | `loadRSAKeys` now handles both: switch on `block.Type` |
| 7 | n8n 524 timeout | Wrong model name (gpt-5-mini) or Respond-to-Webhook mode | Use `gpt-4o-mini`; set webhook "When Last Node Finishes" |
| 8 | BuildStudentContext empty payload | Errors silently swallowed, sent empty data to AI | Return `ErrBadRequest` if `len(accounts)==0`; don't swallow errors |
| 9 | AppShell infinite refresh loop | `navigate`/`setUser`/`setLoading` in useEffect deps → reruns on every render | Empty dep array `[]` with `// eslint-disable-line` |
| 10 | DB migrate "unknown driver" | golang-migrate used pgx5 driver but pgx/v5 needs `pgx/v5` registration | Use `_ "github.com/jackc/pgx/v5/stdlib"` + driver name `"pgx5"` |
