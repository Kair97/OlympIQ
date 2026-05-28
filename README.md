# OlympIQ — AI-Powered Olympiad Training Platform

> Make the journey from beginner to legend-level competitive programmer faster and more structured than anything currently available on Codeforces or LeetCode.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│  React 18 + TypeScript + Tailwind (Atelier design system)       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS (Nginx reverse proxy)
┌───────────────────────────▼─────────────────────────────────────┐
│  Go Fiber v2 API  :8080                                         │
│  JWT RS256 · bcrypt · zap · golang-migrate · go-redis           │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │ Auth Service │  │ Stats Service │  │   AI Service        │  │
│  │  register    │  │  CF sync      │  │  Roadmap generation │  │
│  │  login/out   │  │  LC sync      │  │  Problem razbor     │  │
│  │  refresh     │  │  snapshots    │  │  Recommendations    │  │
│  └──────────────┘  └───────────────┘  └─────────────────────┘  │
└────────┬──────────────────┬──────────────────────┬─────────────┘
         │                  │                      │
   ┌─────▼──────┐   ┌───────▼──────┐   ┌──────────▼──────────┐
   │ PostgreSQL │   │    Redis 7   │   │  Claude API         │
   │    16      │   │  (cache +    │   │  (Anthropic)        │
   │  7 tables  │   │  rate limit) │   │                     │
   └────────────┘   └──────────────┘   └─────────────────────┘
                                              │
                                   ┌──────────▼───────────┐
                                   │  alfa-leetcode-api   │
                                   │  (self-hosted :3002) │
                                   └──────────────────────┘
```

---

## Quick Start

### 1. Clone and configure

```bash
git clone <repo> && cd olympiq
cp .env.example .env
```

Edit `.env` and set:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` (base64-encoded RSA PEM, see below)
- `GRAFANA_ADMIN_PASSWORD`

### 2. Generate JWT keys

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Base64-encode and paste into .env
echo "JWT_PRIVATE_KEY=$(base64 -w0 private.pem)"
echo "JWT_PUBLIC_KEY=$(base64 -w0 public.pem)"
```

### 3. Start all services

```bash
docker-compose up --build
```

### 4. Run database migrations

```bash
docker-compose exec backend ./migrate up
```

### 5. Access

| Service      | URL                           |
|-------------|-------------------------------|
| Frontend    | http://localhost:3000          |
| API         | http://localhost:8080/api/v1   |
| LeetCode API| http://localhost:3002          |
| Grafana     | http://localhost:3001          |
| Prometheus  | http://localhost:9090          |

---

## API Reference

All routes prefixed `/api/v1`. Responses always follow:

```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null,    "error": "human-readable message" }
```

### Auth (public)

| Method | Path               | Body / Notes                                      |
|--------|-------------------|---------------------------------------------------|
| POST   | /auth/register    | `{ email, username, password }`                   |
| POST   | /auth/login       | `{ email, password }` — sets httpOnly cookies     |
| POST   | /auth/logout      | Clears cookies                                    |
| POST   | /auth/refresh     | Rotates access token using refresh cookie         |

### Profile (auth required)

| Method | Path                  | Notes                          |
|--------|-----------------------|--------------------------------|
| GET    | /profile              | Current user info              |
| PUT    | /profile              | `{ email?, username? }`        |
| PUT    | /profile/password     | `{ current_password, new_password, confirm_password }` |
| DELETE | /profile              | Deletes account + all data     |

### Platforms (auth required)

| Method | Path                  | Notes                          |
|--------|-----------------------|--------------------------------|
| POST   | /accounts/connect     | `{ platform, handle }`         |
| DELETE | /accounts/:platform   | Clears Redis cache for handle  |
| POST   | /accounts/sync        | Re-syncs all connected accounts|
| GET    | /stats                | Latest aggregated stats        |

### AI Features (auth required)

| Method | Path                  | Notes                                    |
|--------|-----------------------|------------------------------------------|
| POST   | /roadmap/generate     | `{ mode: weekly\|topic\|interview }`     |
| GET    | /roadmap              | Latest stored roadmap                    |
| GET    | /recommendations      | `?topic=dp&mode=interview`               |
| POST   | /analyze              | `{ problem_url }` — stores razbor        |
| GET    | /analyses             | Paginated history `?page=1&limit=20`     |
| GET    | /analyses/:id         | Single analysis                          |

### Goals (auth required)

| Method | Path   | Notes                                          |
|--------|--------|------------------------------------------------|
| GET    | /goals | Current goal + notification prefs              |
| PUT    | /goals | `{ goal_type, target_rating, target_date, ... }`|

### System (public)

| Method | Path      | Notes                          |
|--------|-----------|--------------------------------|
| GET    | /health   | Liveness — always 200          |
| GET    | /ready    | Readiness — checks DB + Redis  |

---

## Development

### Backend

```bash
cd backend
go mod tidy
go test ./... -v -cover
go build ./...
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # dev server on :5173 (proxies to :8080)
npm test          # vitest
npm run build     # production build
```

### Linting

```bash
# Go
cd backend && golangci-lint run ./...

# TypeScript (strict mode, no any)
cd frontend && npx tsc --noEmit
```

---

## Security

- Passwords: bcrypt cost 12
- Tokens: JWT RS256, access 15 min / refresh 7 days, httpOnly + Secure + SameSite=Strict cookies
- Rate limiting: 10 req/min on `/auth/*`, 60 req/min everywhere else (Redis-backed)
- SQL: parameterized queries only — zero string concatenation
- Error responses: never expose stack traces or SQL errors
- CORS: restricted to `FRONTEND_URL` env var
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP
- Docker: non-root users, no privileged mode

---

## Design System

The frontend uses the **Atelier** design system with three themes (`dark` / `dim` / `light`) toggled via `data-theme` on `<html>`. Key CSS variables are defined in `src/index.css`. UI uses Inter; monospace elements (ratings, handles, tags) use JetBrains Mono.
