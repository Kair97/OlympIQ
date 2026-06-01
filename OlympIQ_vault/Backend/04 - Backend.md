---
title: Backend State
type: reference
last_updated: 2026-05-30
---

# Backend State

All files under `backend/internal/`.

---

## Handlers (`handlers/`)

| File | Endpoints covered | Status |
|------|------------------|--------|
| `auth.go` | POST /auth/register, /login, /logout, /refresh | ✅ |
| `profile.go` | GET/PUT /profile, PUT /profile/password, DELETE /profile | ✅ |
| `accounts.go` | POST /accounts/connect, DELETE /accounts/:platform, POST /accounts/sync | ✅ |
| `health.go` | GET /health, GET /ready | ✅ |
| `roadmap.go` | POST /roadmap/generate, GET /roadmap | ✅ |
| `recommendations.go` | GET /recommendations | ✅ |
| `analyzer.go` | POST /analyze, GET /analyses, GET /analyses/:id | 🔄 Modified |
| `helpers.go` | Shared response helpers | ✅ |
| `user_helpers.go` | Auth context extraction helpers | ✅ |

Test files: `auth_test.go`, `health_test.go`, `test_helpers_test.go`

---

## Services (`services/`)

| File | Responsibility | Size | Status |
|------|---------------|------|--------|
| `auth_service.go` | JWT creation/validation, bcrypt, register/login logic | 8.7KB | ✅ |
| `profile_service.go` | Username/email update, password change, account deletion | 3.2KB | ✅ |
| `accounts_service.go` | Platform connect/disconnect, cache invalidation | 2.9KB | ✅ |
| `codeforces_service.go` | CF API: user.info, user.rating, user.status + Redis cache | 4.9KB | ✅ |
| `leetcode_service.go` | LC API: profile, contest, acSubmission, skill, calendar + Redis | 4.5KB | ✅ |
| `stats_service.go` | Orchestrates CF+LC sync, stores snapshots in user_stats | 8.1KB | ✅ |
| `ai_service.go` | Claude API client, buildStudentContext, roadmap/analyze/recommend prompts | 12.2KB | ✅ |
| `cache.go` | Redis helpers (get/set/del wrappers) | 0.3KB | ✅ |
| `errors.go` | Typed service errors | 0.3KB | ✅ |

Test files: `auth_service_test.go`, `codeforces_service_test.go`

---

## Database migrations (`db/migrations/`)

| Migration | Table | Status |
|-----------|-------|--------|
| 001 | `users` | ✅ |
| 002 | `platform_accounts` | ✅ |
| 003 | `user_stats` | ✅ |
| 004 | `user_goals` | ✅ |
| 005 | `roadmaps` | ✅ |
| 006 | `analyses` | ✅ |
| 007 | `refresh_tokens` | ✅ |
| 008 | `user_goals` UNIQUE constraint | ✅ |

---

## Middleware (`middleware/`)

- `auth.go` — JWT validation, sets `userID` in fiber context
- `ratelimit.go` — Redis-backed: 10 req/min on `/auth/*`, 60/min elsewhere
- `cors.go` — restricted to `FRONTEND_URL` env var
- `logger.go` — Zap structured JSON logging
- `recover.go` — panic recovery, never leaks stack traces

---

## Important patterns

**Getting userID in a handler:**
```go
userID := c.Locals("userID").(string)
```

**Standard success response:**
```go
return c.JSON(fiber.Map{"success": true, "data": result, "error": nil})
```

**Standard error response:**
```go
return c.Status(400).JSON(fiber.Map{"success": false, "data": nil, "error": "message"})
```

---

## Related notes

[[03 - Architecture]] · [[Codeforces API Reference]] · [[LeetCode alfa-leetcode-api Reference]] · [[02-Backend-Deep]] · [[06-Errors-Bible]] · [[03-Database]] · [[05-n8n-Agents]] · [[06 - Active Issues]]
