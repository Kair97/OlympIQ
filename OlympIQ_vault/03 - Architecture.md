---
title: Architecture
type: reference
last_updated: 2026-05-30
---

# Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Backend language | Go (Golang) |
| Backend framework | Fiber v2 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT RS256 — 15min access / 7day refresh, httpOnly cookies |
| AI | Claude API (Anthropic) — claude-sonnet-4-20250514 |
| External APIs | Codeforces REST, alfa-leetcode-api (Docker service) |
| Frontend framework | React 18 + TypeScript |
| Styling | Tailwind CSS v3 + Atelier CSS variable system |
| State | Zustand |
| HTTP client | Axios with token-refresh interceptors |
| Routing | React Router v6 |
| Build | Vite |
| Infra | Docker Compose, Nginx reverse proxy |
| Observability | Prometheus + Grafana |

---

## Key file locations

```
backend/
  cmd/server/main.go              ← entry point
  internal/config/config.go       ← env var loading
  internal/middleware/            ← auth, ratelimit, cors, logger, recover
  internal/handlers/              ← HTTP handler functions
  internal/services/              ← business logic
  internal/repository/            ← DB queries
  internal/models/                ← domain structs
  internal/metrics/prometheus.go  ← Prometheus counters
  db/migrations/                  ← SQL migration files (001–008)

frontend/
  src/pages/          ← full page components
  src/components/     ← layout/ + ui/ + features/
  src/store/          ← Zustand stores
  src/api/            ← Axios wrappers
  src/hooks/          ← custom React hooks
  src/types/          ← TypeScript interfaces
```

---

## API response contract

Every endpoint returns:
```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null,    "error": "human-readable message" }
```

Never expose stack traces, SQL errors, or internal paths to the client.

---

## Auth flow

1. `POST /auth/login` sets `access_token` (15min) + `refresh_token` (7d) as httpOnly cookies
2. Every protected request validates the access token in middleware
3. Axios interceptor: on 401, calls `POST /auth/refresh` to rotate access token, retries original request
4. `POST /auth/logout` invalidates the refresh token in DB

---

## AI feature data flow

```
Request → Handler → ai_service.buildStudentContext(userID)
                      ↳ reads user_stats from PostgreSQL
                      ↳ reads solved list from Redis (cf:status / lc:acsub)
                      ↳ reads user_goals from PostgreSQL
                  → assembles prompt → calls Claude API
                  → parses JSON response → stores in DB → returns to client
```

---

## Design system

CSS variables live in the Atelier CSS system. Key tokens:
- `--bg` / `--bg-sunken` / `--bg-elev` / `--panel` — surface hierarchy
- `--accent` (purple-violet oklch) — primary accent
- `--text` / `--text-dim` / `--text-faint` — text hierarchy
- `--radius` 12px / `--radius-sm` 8px / `--radius-lg` 16px

Three themes: `dark` (default), `dim`, `light` — toggled via `data-theme` on `<html>`.
App shell: 248px fixed sidebar + fluid main area.

---

## Redis key reference

| Key | TTL | Used for |
|-----|-----|---------|
| `cf:info:{handle}` | 1h | Codeforces user.info (rating, rank, avatar) |
| `cf:rating:{handle}` | 1h | Codeforces contest history |
| `cf:status:{handle}` | 1h | Codeforces submissions — **AI solved-list source** |
| `lc:profile:{handle}` | 1h | LeetCode profile (totalSolved, easy/medium/hard) |
| `lc:contest:{handle}` | 1h | LeetCode contest stats |
| `lc:acsub:{handle}` | 1h | LeetCode accepted submissions — **AI solved-list source** |
| `lc:skill:{handle}` | 1h | LeetCode skill topic breakdown |
| `lc:calendar:{handle}` | 1h | LeetCode submission calendar (heatmap data) |

---

## JWT reference

| Setting | Value |
|---------|-------|
| Algorithm | RS256 (asymmetric) |
| Access token TTL | 15 minutes |
| Refresh token TTL | 7 days (168h) |
| Storage | httpOnly + Secure + SameSite=Strict cookies |
| JS access | Impossible — httpOnly prevents it |
| Rotation | Refresh token rotated on every `/auth/refresh` call |
| Revocation | Refresh tokens stored in `refresh_tokens` table; logout deletes the row |
| Key generation | `openssl genrsa -out private.pem 2048 && openssl rsa -in private.pem -pubout -out public.pem` |
| Env vars | `JWT_PRIVATE_KEY` (base64), `JWT_PUBLIC_KEY` (base64) |

---

## Related notes

[[04 - Backend]] · [[05 - Frontend]] · [[07 - Decisions Log]] · [[01-Architecture]] · [[03-Database]] · [[08-Security]] · [[09-Environment-Setup]] · [[Codeforces API Reference]] · [[LeetCode alfa-leetcode-api Reference]]
