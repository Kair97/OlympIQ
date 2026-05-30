---
title: Active Issues
type: issues
last_updated: 2026-05-30
---

# Active Issues

> Claude: **read this before touching any file**. Update when you fix something or discover something new.

---

## In Progress

### Analyzer — backend + frontend (Step 18)
- **Files:** `backend/internal/handlers/analyzer.go`, `frontend/src/pages/Analyzer.tsx`
- **Status:** Both files modified (uncommitted)
- **What's needed:** Finish the 2-column razbor layout per spec in [[05 - Frontend]]

---

## Recently Fixed (context for avoiding regressions)

| Date | What broke | Fix applied |
|------|-----------|------------|
| 2026-05-30 | Heatmap: unused `key` variable causing lint error | Removed unused variable |
| 2026-05-29 | Dashboard stats deduplication (duplicate API calls) | Fixed dedup logic |
| 2026-05-29 | Roadmap endpoint returning 500 | Fixed AI JSON parsing — was wrapping in markdown fences |
| 2026-05-29 | AI response JSON wrapped in markdown code fences | Strip fences before `json.Unmarshal` |
| 2026-05-29 | Accounts connect flow broken + missing routes | Fixed route registration and connect handler |
| 2026-05-29 | `user_goals` unique constraint violation on update | Added migration 008 for UNIQUE constraint |
| 2026-05-29 | DB migrate using wrong driver (pgx5 vs postgres) | Switched to correct postgres driver |
| 2026-05-29 | JWT PKCS8 private key parse failure | Added PKCS8 fallback in key loading |
| 2026-05-29 | Nginx lazy DNS breaking upstream resolution | Changed to IP-based upstream in nginx.conf |
| 2026-05-29 | Frontend nginx missing `/api` proxy | Added proxy_pass block for `/api` → backend |

---

## Known Limitations

- LeetCode data depends on `alfa-leetcode-api` — if that service is down, LC stats fail silently
- Codeforces API has no auth; rate limit is 1 req/2s globally (not per-user)
- Analyzer does not scrape problem statements — user must paste the URL, Claude must know the problem
- Steps 20–22 (Nginx prod TLS, Prometheus/Grafana, README) not started

---

## Watch List

- AI responses: always strip markdown fences before parsing JSON (already fixed, but fragile)
- `buildStudentContext` reads from Redis; if cache is cold (first sync), AI calls may have sparse data
- TypeScript strict mode — no `any` types; watch for implicit any in new components
