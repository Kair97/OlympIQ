---
title: Active Issues
type: issues
last_updated: 2026-05-31
---

# Active Issues

> Claude: **read this before touching any file**. Update when you fix something or discover something new.

---

## In Progress

### Steps 20–22 — Pending
- Step 20: Nginx production config + TLS
- Step 21: Prometheus metrics + Grafana dashboard
- Step 22: README + architecture diagram

### Uncommitted changes
- `backend/internal/handlers/analyzer.go` — normalizeAnalysis function added
- `frontend/src/pages/Analyzer.tsx` — resizable panels + all Atelier design features

---

## Recently Fixed (context for avoiding regressions)

| Date | What broke | Fix applied |
|------|-----------|------------|
| 2026-05-31 | **Roadmap empty payload** — `BuildStudentContext` silently swallowed all API errors. If no platforms connected → sent empty payload to n8n. Fix: added `ErrBadRequest` if `len(accounts)==0`; errors no longer swallowed; CF rating history extended to last 24 contests | `ai_service.go: BuildStudentContext` |
| 2026-05-31 | **Analyzer resizable panels** — added drag divider between left/right columns. Drag handle turns accent color on hover. Width clamped 25%-75%. Uses `mousedown/mousemove/mouseup` on `window` ref | `Analyzer.tsx: splitPct state + onDragStart` |
| 2026-05-30 | **n8n Analyzer wired** — `N8N_ANALYZER_URL` in `.env` → backend routes `AnalyzeProblem` to n8n webhook instead of Gemini. Falls back to Gemini if URL is empty. n8n response may be wrapped in `[{"output":"..."}]` array — backend auto-unwraps it | Added `callN8NAnalyzer` in `ai_service.go`; added `N8NAnalyzerURL` to config |
| 2026-05-30 | **500 on POST /analyze** — `json.Unmarshal` failure returned raw Go error, not wrapped in `ErrExternal`, hit `default` case in `mapServiceErr` | Wrap unmarshal error: `fmt.Errorf("%w: failed to parse Gemini response (status %d): %v", ErrExternal, resp.StatusCode, err)` |
| 2026-05-30 | **Login form clears on wrong password** — Axios 401 interceptor fires on `/auth/login` 401, tries token refresh, that fails, does `window.location.href = '/login'` = full page reload | Added `const isAuthRoute = original?.url?.startsWith('/auth/')` guard — skip interceptor for auth routes |
| 2026-05-30 | **GEMINI_API_KEY format** — key starting with `AQ.` is suspect; standard Google AI Studio keys start with `AIza`. If Gemini returns non-JSON (HTML error page), the unmarshal fails silently as 500 | Now returns 502 with actual Gemini error message surfaced to frontend |
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

## n8n Integration Status

| Item | Status | Notes |
|------|--------|-------|
| Analyzer agent | ✅ Production | `https://kair97.app.n8n.cloud/webhook/olympiq-problem-analysis` |
| Roadmap agent | ✅ Production | `https://kair97.app.n8n.cloud/webhook/coding-roadmap` |
| Backend N8N_ANALYZER_URL | ✅ Set in .env | Production URL |
| Backend N8N_ROADMAP_URL | ✅ Set in .env | Production URL |
| Both agents wired in ai_service.go | ✅ Done | Falls back to Gemini if env var empty |
| LCTopics map in StudentContext | ✅ Done | Full topic→count map now built from LC skill API |
| n8n response envelope | ✅ Handled | `[{"output":"...json..."}]` — backend auto-unwraps in callN8NAnalyzer + callN8NRoadmap |
| n8n webhook mode | ✅ Must use "When Last Node Finishes" | "Using Respond to Webhook Node" times out — AI takes 15-30s |
| Max tokens in Gemini node | ⚠️ Set to 8192 | Default 1024/2048 causes truncated JSON |
| gpt-5-mini model | ❌ Does not exist | Use `gpt-4o-mini` if switching to OpenAI |

---

## Watch List

- AI responses: always strip markdown fences before parsing JSON (already fixed, but fragile)
- `buildStudentContext` reads from Redis; if cache is cold (first sync), AI calls may have sparse data
- TypeScript strict mode — no `any` types; watch for implicit any in new components
- **Gemini model name** — `GEMINI_MODEL=gemini-2.5-flash` in `.env`. If this model is unavailable on v1beta, change to `gemini-2.0-flash` (confirmed working)
- **Axios interceptor** — 401 from `/auth/login` must NOT trigger the token refresh loop. The `isAuthRoute` guard in `client.ts` handles this — do not remove it
- **mapServiceErr default case** — any error not wrapped with a typed sentinel (`ErrExternal`, `ErrNotFound`, etc.) returns 500. Always wrap errors from external calls with `ErrExternal`
- **LeetCode direct URLs return 403** — `https://leetcode.com/problems/{slug}/` blocks all non-browser HTTP requests (no session cookie = 403 Forbidden). NEVER call leetcode.com from backend or Postman. Always use the alfa-leetcode-api proxy (`http://leetcode-api:3000/select?titleSlug={slug}`). The `https://leetcode.com/problems/...` links in the UI are `target="_blank"` buttons for the user's own browser — not API calls.
- **Brain vault** — `OlympIQ_vault/Brain/` contains 9 reference files. Read `Brain/00-Master-Context.md` first each session. Update `Brain/06-Errors-Bible.md` when discovering new error patterns.
