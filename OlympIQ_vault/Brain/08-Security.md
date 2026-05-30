---
title: Security Reference
type: brain
last_updated: 2026-05-31
---

# Security Reference

---

## Auth Security

### JWT RS256 (not HS256)
- **Algorithm:** RS256 (asymmetric) — private key signs, public key validates
- **Access token TTL:** 2h (configured via JWT_ACCESS_TTL)
- **Refresh token TTL:** 7 days (168h)
- **Storage:** httpOnly cookies ONLY — JavaScript cannot read them
  - `access_token`: Path `/`, accessible for all API calls
  - `refresh_token`: Path `/api/v1/auth`, only sent to auth endpoints
- **Cookie flags:** `HTTPOnly: true`, `Secure: true` (production), `SameSite: Strict`
- **Token payload:** user_id (UUID), email, username, sub, iat, exp
- **Refresh token storage:** Only SHA256(token) stored in DB — raw token never persisted

### Refresh token rotation
Every `/auth/refresh` call:
1. Validates the hash against DB
2. Checks expiry
3. Deletes the old token hash
4. Issues a NEW token pair (both access + refresh)
This prevents refresh token reuse.

### Password hashing
- bcrypt with cost 12
- Never log or return password_hash field (`json:"-"` tag on PasswordHash)
- `ChangePassword` verifies current password before accepting new one
- New password must differ from current password

---

## Rate Limiting

### Auth routes (`/auth/*`)
- **Limit:** 10 requests per minute per IP+method
- **Key:** `ratelimit:auth:{ip}:{method}`
- **Response on exceed:** 429 `{"success":false,"error":"rate limit exceeded — try again later"}`

### All other protected routes
- **Limit:** 60 requests per minute per IP+method
- **Key:** `ratelimit:api:{ip}:{method}`

### Implementation
Redis-based sliding window in `middleware/ratelimit.go`. Uses `cache.Get`/`cache.Set` with window duration TTL.

---

## Input Validation

### Go side
Every handler uses `parseAndValidate(c, &input)` which:
1. `c.BodyParser(&input)` — JSON decode
2. `validate.Struct(input)` — go-playground/validator checks all `validate:"..."` tags

Common tags used:
- `validate:"required"` — field must be present and non-empty
- `validate:"email"` — valid email format
- `validate:"min=3,max=30,alphanum"` — username
- `validate:"min=8"` — passwords
- `validate:"required,url"` — problem_url must be a valid URL
- `validate:"required,oneof=weekly topic interview"` — roadmap mode
- `validate:"required,oneof=codeforces leetcode"` — platform

### Input sanitization for AI
- `sanitize(s string)` in `ai_service.go` truncates input to 10,000 characters
- Problem URLs truncated before sending to Gemini/n8n

---

## SQL Injection Prevention

**Rule:** Zero string concatenation in SQL queries. All user input goes through parameterized queries.

All queries use pgx positional parameters (`$1`, `$2`, ...):
```go
q := `SELECT id FROM users WHERE email = $1`
r.db.QueryRow(ctx, q, email)
```

Never:
```go
// FORBIDDEN
q := "SELECT * FROM users WHERE email = '" + email + "'"
```

---

## CORS Configuration

```go
cors.New(cors.Config{
    AllowOrigins:     cfg.FrontendURL,  // exact origin match, NOT "*"
    AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
    AllowHeaders:     "Content-Type,Authorization",
    AllowCredentials: true,             // needed for cookies
    MaxAge:           3600,
})
```

`AllowOrigins` is set to the exact FRONTEND_URL value from env. Wildcard `*` is never used with `AllowCredentials: true` (browsers reject this combination).

---

## Security Headers

Applied to all responses by `middleware/security.go`:

| Header | Value | Why |
|--------|-------|-----|
| X-Frame-Options | DENY | Prevents clickjacking |
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| Referrer-Policy | strict-origin | Limits referrer info |
| Content-Security-Policy | default-src 'self' | Prevents XSS/injection |

Also set in Nginx (`nginx/nginx.conf`):
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin`

---

## Error Response Policy

**Rule:** Never expose internal details to clients.

What clients receive:
```json
{"success": false, "data": null, "error": "human-readable message"}
```

What is NEVER in the response:
- Stack traces
- Internal file paths (e.g. `/app/internal/services/auth.go:85`)
- SQL error messages (e.g. "pq: duplicate key value violates unique constraint...")
- Go struct field names
- Raw error strings from dependencies

What is logged internally (via zap):
- Full error with stack trace
- Request ID, user ID
- All the internal details

The `default` case in `mapServiceErr` returns "internal server error" — never the raw `err.Error()`.

Exception: `ErrConflict`, `ErrBadRequest`, `ErrExternal` do include `err.Error()` in the response, but these are crafted human-readable messages, not raw system errors.

---

## Platform Disconnect Security

`DELETE /accounts/:platform`:
1. User must be authenticated (JWT required)
2. `FindByUserIDAndPlatform` verifies the account belongs to the authenticated user
3. On disconnect: deletes DB row + deletes all Redis cache keys for that handle
4. Frontend shows confirmation modal before calling (not enforced server-side — server just deletes)

---

## Account Deletion Security

`DELETE /profile`:
1. Requires JWT authentication
2. Deletes from `users` table — all dependent data deleted by CASCADE:
   - platform_accounts, user_stats, user_goals, roadmaps, analyses, refresh_tokens
3. Frontend requires typing the username to confirm (client-side check only)

---

## Secrets Management

1. All secrets in `.env` file — never hardcoded
2. `.env` in `.gitignore` — never committed
3. Docker container reads secrets via `env_file: .env`
4. JWT keys base64-encoded PEM in env vars (not files in container)
5. Grafana admin password via `${GRAFANA_ADMIN_PASSWORD}` env var

---

## Container Security

From `docker-compose.yml`:
- No `privileged: true` on any service
- Named volumes (not bind mounts for DB data)
- `restart: unless-stopped` (not `always` — stops on intentional `docker stop`)
- All services use official images with specific versions (not `latest` for critical services)

---

## AI Input Security

Before any prompt is sent to Gemini or n8n:
1. `sanitize(problemURL)` — truncates to 10,000 chars
2. Input validated as URL type by validator before reaching AI service
3. Problem URLs are from user input but only used in prompts, not executed

Maximum payload to AI: 10,000 chars for URL/text inputs; `buildRoadmapUserMessage` generates plain text from structured data (no user-controlled free text).
