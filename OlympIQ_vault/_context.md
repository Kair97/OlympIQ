---
title: Context (read first)
type: context
last_updated: 2026-05-30
---

# Context

> Read this before every task. It is the only note you need for most tasks.

## Build position

**Step 18 of 22 — Analyzer page (backend + frontend in-progress)**

## Modified files (uncommitted)

| File | Note |
|------|------|
| `.gitignore` | Added Obsidian workspace exclusions |
| `backend/internal/handlers/analyzer.go` | In-progress |
| `frontend/src/pages/Analyzer.tsx` | In-progress |
| `OlympIQ_vault/` | Entire vault is untracked |

## Next 3 tasks

1. Finish `analyzer.go` + `Analyzer.tsx` — 2-column razbor layout, no code editor
2. Step 20 — Nginx production config + TLS
3. Step 21 — Prometheus metrics wiring + Grafana dashboard

## Ports

| Service | Port |
|---------|------|
| Backend (Go Fiber) | 8080 |
| Frontend (React) | 3000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| leetcode-api | 3002 |
| Grafana | 3001 |
| Prometheus | 9090 |

## API prefix

`/api/v1`

## Key env vars

```
ANTHROPIC_API_KEY   — Claude API key
DATABASE_URL        — postgres://olympiq:password@postgres:5432/olympiq
REDIS_URL           — redis://redis:6379
JWT_PRIVATE_KEY     — RSA private key (base64)
JWT_PUBLIC_KEY      — RSA public key (base64)
LEETCODE_API_URL    — http://leetcode-api:3000
FRONTEND_URL        — http://localhost:3000
```

## Docker

```bash
docker-compose up --build                          # start all services
docker-compose exec backend ./migrate up           # run migrations
docker-compose exec backend go test ./... -v       # run backend tests
```
