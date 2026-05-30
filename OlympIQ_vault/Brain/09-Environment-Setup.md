---
title: Environment Setup
type: brain
last_updated: 2026-05-31
---

# Environment Setup

---

## Complete .env with Descriptions

```env
# ── Application ───────────────────────────────────────────────
# APP_ENV: "development" (dev cookies without Secure flag)
#          "production"  (Secure cookies + tighter settings)
APP_ENV=development

# Backend listen port
APP_PORT=8080

# CORS allowed origin — must match the frontend URL exactly
FRONTEND_URL=http://localhost:3000

# ── Database ──────────────────────────────────────────────────
# PostgreSQL connection string
# In Docker: postgres container is named "postgres"
DATABASE_URL=postgres://olympiq:password@postgres:5432/olympiq?sslmode=disable

# ── Redis ─────────────────────────────────────────────────────
# Redis connection string
# In Docker: redis container is named "redis"
REDIS_URL=redis://redis:6379

# ── JWT Keys ─────────────────────────────────────────────────
# RSA-2048 keys, base64-encoded PEM
# Generate with:
#   openssl genrsa -out private.pem 2048
#   openssl rsa -in private.pem -pubout -out public.pem
#   base64 -w 0 private.pem   → paste as JWT_PRIVATE_KEY
#   base64 -w 0 public.pem    → paste as JWT_PUBLIC_KEY
# IMPORTANT: Use -w 0 (no line wrapping) or base64 decode will fail
JWT_PRIVATE_KEY=<base64-encoded RSA private key PEM>
JWT_PUBLIC_KEY=<base64-encoded RSA public key PEM>

# Access token TTL (default: 15m per spec, currently set to 2h for dev)
JWT_ACCESS_TTL=2h

# Refresh token TTL (7 days)
JWT_REFRESH_TTL=168h

# ── Gemini AI ─────────────────────────────────────────────────
# Get your key at: https://aistudio.google.com/apikey
# MUST start with "AIza" — keys starting with "AQ." are OAuth tokens, not API keys
GEMINI_API_KEY=AIza...

# Model name for direct Gemini calls (used when N8N_* URLs are empty)
# Confirmed working: gemini-2.0-flash, gemini-2.5-flash
GEMINI_MODEL=gemini-2.5-flash

# ── n8n Webhook URLs ──────────────────────────────────────────
# When set, AI calls route to n8n instead of Gemini directly
# Leave empty to use Gemini directly
N8N_ANALYZER_URL=https://kair97.app.n8n.cloud/webhook/olympiq-problem-analysis
N8N_ROADMAP_URL=https://kair97.app.n8n.cloud/webhook/coding-roadmap

# ── External APIs ─────────────────────────────────────────────
# alfa-leetcode-api proxy URL
# In Docker: leetcode-api container at port 3000 internally
LEETCODE_API_URL=http://leetcode-api:3000

# Codeforces API keys (optional — only needed for authenticated CF endpoints)
# Not currently used in OlympIQ (all CF calls are public)
# CODEFORCES_API_KEY=
# CODEFORCES_API_SECRET=

# ── Monitoring ────────────────────────────────────────────────
GRAFANA_ADMIN_PASSWORD=<strong password>
```

---

## How to Generate JWT Keys

### Linux / macOS / WSL
```bash
# Generate RSA-2048 private key
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem

# Base64-encode (NO line wrapping — -w 0 flag)
base64 -w 0 private.pem
base64 -w 0 public.pem

# Paste output into .env:
# JWT_PRIVATE_KEY=<output of base64 -w 0 private.pem>
# JWT_PUBLIC_KEY=<output of base64 -w 0 public.pem>
```

### Windows (PowerShell)
```powershell
# If you have OpenSSL for Windows:
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Base64-encode
[Convert]::ToBase64String([IO.File]::ReadAllBytes("private.pem"))
[Convert]::ToBase64String([IO.File]::ReadAllBytes("public.pem"))
```

### Verify keys loaded correctly
After starting the backend, check logs for:
- No "load RSA keys" error → keys loaded successfully
- "server starting" message → all services initialized

---

## Docker Commands

### Start / stop services
```bash
# Start all services in background
docker-compose up -d

# Start with build (after code changes)
docker-compose up -d --build

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: destroys all data)
docker-compose down -v
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
docker-compose logs -f leetcode-api

# Last N lines
docker-compose logs --tail 50 backend
```

### Run migrations
```bash
# Apply all migrations
docker-compose exec backend ./migrate up

# Roll back one
docker-compose exec backend ./migrate down 1

# Roll back all
docker-compose exec backend ./migrate down
```

### Rebuild specific service
```bash
docker-compose up -d --build backend
docker-compose up -d --build frontend
```

### Clear Redis cache
```bash
# All keys
docker-compose exec redis redis-cli FLUSHALL

# Specific key
docker-compose exec redis redis-cli DEL "cf:status:tourist"

# List keys by pattern
docker-compose exec redis redis-cli KEYS "cf:*"
```

### Access PostgreSQL
```bash
docker-compose exec postgres psql -U olympiq -d olympiq
```

### Check container health
```bash
docker-compose ps
```

### Rebuild from scratch
```bash
docker-compose down -v
docker-compose up -d --build
docker-compose exec backend ./migrate up
```

---

## Common Development Workflow

### After pulling code changes
```bash
docker-compose up -d --build
docker-compose exec backend ./migrate up  # if new migrations exist
```

### Testing AI features
```bash
# Verify AI is working
curl -b "access_token=..." http://localhost:8080/api/v1/ai/test

# Or in Postman: GET /ai/test (with auth cookie)
```

### Debugging a sync failure
```bash
# Check backend logs
docker-compose logs --tail 50 backend

# Check if Redis has cached data
docker-compose exec redis redis-cli KEYS "cf:*"

# Check LC API is responding
curl http://localhost:3002/tourist/profile
```

### Checking DB state
```bash
docker-compose exec postgres psql -U olympiq -d olympiq -c "SELECT * FROM users;"
docker-compose exec postgres psql -U olympiq -d olympiq -c "SELECT user_id, platform, fetched_at FROM user_stats ORDER BY fetched_at DESC LIMIT 10;"
```

### Running lint before commit
```bash
# Backend
cd backend && golangci-lint run ./...

# Frontend
cd frontend && npm run lint
```

---

## Service URLs (local development)

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | React app |
| Backend API | http://localhost:8080/api/v1 | REST API |
| Health check | http://localhost:8080/health | Liveness |
| Readiness | http://localhost:8080/ready | DB + Redis check |
| Config | http://localhost:8080/api/v1/config | Model name |
| Prometheus metrics | http://localhost:9091/metrics | Raw metrics |
| LeetCode API | http://localhost:3002 | LC proxy |
| Prometheus UI | http://localhost:9090 | Metrics browser |
| Grafana | http://localhost:3001 | Dashboards (admin/GRAFANA_ADMIN_PASSWORD) |
| Nginx | http://localhost:80 | Reverse proxy (dev) |

---

## Troubleshooting Startup

### Backend won't start
```bash
docker-compose logs backend --tail 20
```
Common causes:
- "load RSA keys" error → JWT_PRIVATE_KEY or JWT_PUBLIC_KEY malformed
- "db pool" error → DATABASE_URL wrong or postgres not ready
- "redis URL" error → REDIS_URL malformed

### Frontend shows blank page
```bash
docker-compose logs frontend --tail 20
```
Check: TypeScript compilation error, missing env vars in Vite config.

### Nginx 502 Bad Gateway
- Backend not running: `docker-compose ps backend`
- Backend crashed: `docker-compose logs backend --tail 30`

### LeetCode sync returns 502
- alfa-leetcode-api not responding: `curl http://localhost:3002/tourist/profile`
- Container restarting: `docker-compose logs leetcode-api --tail 20`
