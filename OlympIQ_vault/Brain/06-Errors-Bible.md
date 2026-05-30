---
title: Errors Bible
type: brain
last_updated: 2026-05-31
---

# Errors Bible — 40+ Known Errors with Exact Fixes

> Organized by category. Check here before debugging anything.

---

## Go / Fiber Errors

### E01 — 500 on POST /analyze (json.Unmarshal not wrapped)
- **Error:** HTTP 500, no useful message in frontend
- **When:** AI returns non-JSON (HTML error page, markdown, truncated response)
- **Root cause:** `json.Unmarshal` error in `AnalyzeProblem` not wrapped with `ErrExternal` → hits `default` in `mapServiceErr` → returns 500 "internal server error"
- **Fix:** `return "", fmt.Errorf("%w: failed to parse Gemini response (status %d): %v", ErrExternal, resp.StatusCode, err)` — now hits 502 branch in mapServiceErr

### E02 — mapServiceErr returns 500 for external errors
- **Error:** Any external API failure returns 500 instead of 502
- **When:** CF API down, LC API 503, Gemini error, n8n timeout
- **Root cause:** Error from external call not wrapped with `ErrExternal` sentinel
- **Fix:** All external calls must use `fmt.Errorf("%w: description: %v", ErrExternal, err)`. Check that errors.Is(err, ErrExternal) resolves correctly.

### E03 — Panic in handler not caught
- **Error:** Server crashes or returns 500 with no response body
- **When:** Nil pointer dereference, array out of bounds in handler
- **Root cause:** Fiber's global error handler catches fiber errors but not panics
- **Fix:** `middleware.Recover()` is applied first — converts panic to 500 JSON. If still crashing, check that Recover() is first in middleware chain.

### E04 — "unexpected signing method" JWT error
- **Error:** 401 "invalid or expired token" on all protected routes
- **When:** JWT signed with wrong algorithm, or corrupted access_token cookie
- **Root cause:** Token was signed with HMAC but `ParseWithClaims` expects RSA
- **Fix:** Ensure `NewWithClaims(jwt.SigningMethodRS256, claims)` is used for signing. Cookie may be from an old session — clear cookies in browser.

### E05 — validator: "Key: 'X.Y' Error: Field validation for 'Y' failed"
- **Error:** 400 "invalid input: ..."
- **When:** Request body missing required field or failing validation
- **Root cause:** go-playground/validator tag not satisfied
- **Fix:** Check the field and its validate tag. Common: `validate:"required,oneof=weekly topic interview"` rejects anything not in that set.

### E06 — Fiber "cannot parse body" 
- **Error:** 400 on POST with JSON body
- **When:** Request body is not valid JSON, or Content-Type missing
- **Root cause:** `c.BodyParser` fails on malformed JSON
- **Fix:** Ensure client sends `Content-Type: application/json`. Check JSON syntax.

---

## Database / PostgreSQL Errors

### E07 — "duplicate key value violates unique constraint users_email_key"
- **Error:** 409 from register endpoint
- **When:** Registering with an already-used email
- **Root cause:** UNIQUE(email) constraint on users table
- **Fix (expected behavior):** Return 409 "email already registered". Handled in `auth_service.go` pre-check.

### E08 — "duplicate key value violates unique constraint user_goals_user_id_unique"
- **Error:** 500 or 409 when updating goals
- **When:** PUT /goals called before migration 008 was applied
- **Root cause:** `Upsert` does `INSERT ON CONFLICT(user_id) DO UPDATE` — requires the UNIQUE constraint to exist
- **Fix:** Run migration 008: `ALTER TABLE user_goals ADD CONSTRAINT user_goals_user_id_unique UNIQUE (user_id)`

### E09 — "no rows in result set" → 404
- **Error:** 404 "not found" from any GET endpoint
- **When:** Resource doesn't exist (user deleted, analysis belongs to another user)
- **Root cause:** `pgx.ErrNoRows` → `repository.ErrNotFound` → `services.ErrNotFound` → 404
- **Fix:** Expected behavior. Check resource ID and ownership.

### E10 — "failed to connect to postgres"
- **Error:** Backend fails to start
- **When:** Postgres container not ready, DATABASE_URL misconfigured
- **Root cause:** `pgxpool.New` fails — usually postgres hasn't finished initializing
- **Fix:** Check `depends_on: postgres: condition: service_healthy` in docker-compose.yml. If manually running: wait for postgres to start before backend.

### E11 — DB migrate "unknown driver: pgx5"
- **Error:** `migrate` binary exits with driver error
- **When:** Running migrations with wrong driver registration
- **Root cause:** golang-migrate requires `_ "github.com/jackc/pgx/v5/stdlib"` import to register the driver
- **Fix:** Check `backend/cmd/migrate/main.go` imports `pgx/v5/stdlib` and uses driver name `"pgx5"`.

### E12 — "syntax error at end of input" during migration
- **Error:** Migration fails to apply
- **When:** SQL migration file has a typo or missing semicolon
- **Root cause:** psql error in migration file
- **Fix:** Fix SQL syntax in the migration file. Run `docker-compose exec backend ./migrate down 1` then `up` after fixing.

---

## JWT / Auth Errors

### E13 — JWT PKCS8 parse failure
- **Error:** Backend fails to start with "unsupported private key type" or "PKCS8 key is not RSA"
- **When:** openssl 3.x generates PKCS8 format (header: "PRIVATE KEY") but code only handled PKCS1 ("RSA PRIVATE KEY")
- **Root cause:** openssl version difference in key generation
- **Fix:** `loadRSAKeys` switches on `block.Type` — handles both PKCS1 and PKCS8. Already implemented. If still failing, check base64 encoding of the key.

### E14 — JWT "token is expired"
- **Error:** 401 on protected routes after ~2 hours
- **When:** Access token expires (JWT_ACCESS_TTL=2h)
- **Root cause:** Expected behavior — token TTL passed
- **Fix:** Frontend Axios interceptor auto-refreshes. If refresh also fails → redirect to /login. Check JWT_REFRESH_TTL (7 days).

### E15 — "decode private key base64: illegal base64 data"
- **Error:** Backend fails to start
- **When:** JWT_PRIVATE_KEY contains newlines or whitespace in base64 string
- **Root cause:** base64.StdEncoding requires pure base64 without line breaks
- **Fix:** When base64-encoding PEM keys, use `base64 -w 0` (no line wrapping): `base64 -w 0 private.pem`

### E16 — Login 401 clears form and redirects
- **Error:** Wrong password → form clears, redirects to /login
- **When:** Axios 401 interceptor fires on /auth/login response
- **Root cause:** Missing `isAuthRoute` guard in Axios interceptor
- **Fix:** Add `const isAuthRoute = original?.url?.startsWith('/auth/')` and skip interceptor if true. Already fixed in `client.ts`.

---

## Redis Errors

### E17 — "dial tcp redis:6379: connect: connection refused"
- **Error:** Rate limiting fails or cache misses cause 502 errors
- **When:** Redis container not started, or wrong REDIS_URL
- **Root cause:** Backend can't reach Redis
- **Fix:** `docker-compose up -d redis` and verify `REDIS_URL=redis://redis:6379` in `.env`

### E18 — Rate limit key expires too fast
- **Error:** Users hit rate limit again immediately after waiting
- **When:** Redis TTL on ratelimit key resets on each request instead of once
- **Root cause:** Bug: `cache.Set(key, newVal, window)` is called on every increment, resetting TTL each time
- **Status:** Known limitation in current `ratelimit.go` — Set is called on every request instead of SetNX on first
- **Workaround:** Effective rate limit is approximate; doesn't cause security issues

### E19 — Stale cache serving wrong data
- **Error:** Stats not updating after sync
- **When:** Redis TTL 1h hasn't expired after a sync
- **Root cause:** CF/LC services check Redis before API; sync stores new DB row but doesn't invalidate Redis
- **Fix:** `POST /accounts/sync` re-fetches from external API which writes to Redis cache AND inserts new stats row. But it depends on whether the cache key already exists. Manual fix: `docker-compose exec redis redis-cli DEL cf:status:{handle}`

---

## Docker / Container Errors

### E20 — Nginx lazy DNS: upstream "backend" not resolved
- **Error:** Nginx crashes with "host not found in upstream backend"
- **When:** Backend container restarts, Nginx resolves DNS once at startup
- **Root cause:** Nginx resolves upstream hostnames at parse time, not per-request
- **Fix:** Use variable-based upstream with `resolver 127.0.0.11 valid=5s`:
  ```nginx
  resolver 127.0.0.11 valid=5s;
  set $backend http://backend:8080;
  proxy_pass $backend;
  ```
  Already fixed in `nginx/nginx.conf`.

### E21 — "port 5432 already in use"
- **Error:** postgres container fails to start
- **When:** Local postgres is running on the same port
- **Root cause:** Port conflict between Docker-exposed port and host postgres
- **Fix:** Stop host postgres: `sudo service postgresql stop` or change Docker port mapping.

### E22 — Backend container exits immediately
- **Error:** `docker-compose up` shows backend restarting in a loop
- **When:** Go compilation error, panic on startup, missing env vars
- **Root cause:** Various; check logs
- **Fix:** `docker-compose logs backend --tail 50`. Common: GEMINI_API_KEY missing (just prints warning, doesn't crash), DATABASE_URL wrong (crashes on connect), JWT keys missing (crashes on auth service init).

### E23 — LeetCode API container unhealthy
- **Error:** leetcode-api healthcheck fails, other services waiting
- **When:** `alfaarghya/alfa-leetcode-api:2.0.4` takes >20s to start
- **Root cause:** Node.js startup time
- **Fix:** `start_period: 20s` in healthcheck. If still failing, increase to 30s.

### E24 — Frontend build fails (TypeScript errors)
- **Error:** `tsc -b` exits non-zero in frontend Dockerfile
- **When:** Type errors in .tsx files
- **Root cause:** Strict TypeScript mode catches errors at build time
- **Fix:** Run `cd frontend && npm run build` locally first to see errors.

---

## Frontend / TypeScript Errors

### E25 — "Cannot read properties of null (reading '...')"
- **Error:** React crash, ErrorBoundary catches it
- **When:** Rendering dashboard with missing data fields
- **Root cause:** Optional chaining not used, e.g. `data.codeforces.rating` when `codeforces` is null
- **Fix:** Always use optional chaining (`data?.codeforces?.rating`) and nullish coalescing (`?? 0`). The `normalizeAnalysis` function in analyzer.go fills safe defaults server-side.

### E26 — Zustand state not updating
- **Error:** Component shows stale data after store.setX()
- **When:** Using `useStore((s) => s.data)` but not subscribing to the right slice
- **Root cause:** Selector not granular enough, or mutating state directly instead of returning new object
- **Fix:** Always return new object in set(): `set({ field: newValue })` not `set(s => { s.field = newValue })`

### E27 — AppShell infinite refresh loop
- **Error:** Browser shows "Loading…" spinner forever, network tab shows repeated POST /auth/refresh calls
- **When:** `navigate`, `setUser`, or `setLoading` added to useEffect deps in AppShell
- **Root cause:** These functions change on every render → effect reruns → more renders
- **Fix:** Empty deps array `[]` with eslint-disable comment. The effect should only run once on mount.

### E28 — Axios interceptor retries infinitely
- **Error:** Console shows endless 401 → retry → 401 loop
- **When:** `_retry` flag not being set, or refresh endpoint itself returns 401
- **Root cause:** Refresh fails but `_retry` not set before retry attempt
- **Fix:** `original._retry = true` before calling refresh. Already implemented in `client.ts`.

---

## Codeforces API Errors

### E29 — CF "status: FAILED, comment: handles: User with handle ... not found"
- **Error:** 502 from /accounts/connect or /accounts/sync
- **When:** User enters a Codeforces handle that doesn't exist
- **Root cause:** CF API returns `{status: "FAILED", comment: "..."}` for invalid handles
- **Fix:** `CodeforcesService.GetUserInfo` checks `resp.Status != "OK"` and returns `ErrExternal`. Currently connect flow doesn't call CF API at connect time — handle is validated on first sync.

### E30 — CF rate limit (429 or timeout)
- **Error:** 502 on sync, CF API call fails
- **When:** Too many CF API calls from same IP (1 req/2s limit)
- **Root cause:** `doGet` sleeps 500ms between calls, but concurrent requests can exceed limit
- **Fix:** Current implementation has `time.Sleep(500 * time.Millisecond)` in `doGet`. For production with many users, add IP-based token bucket in Redis.

### E31 — CF submission `problem.contestId` is 0
- **Error:** Weird solved problem keys like "0/A" in CFSolvedKeys
- **When:** CF gym problems or training problems appear in user.status
- **Root cause:** Gym/training contest problems may not have a `contestId`
- **Fix:** Filter out submissions where `problem.contestId == 0` if needed. Currently not filtered.

---

## LeetCode API Errors

### E32 — LeetCode 403 Forbidden from backend
- **Error:** 403 when calling leetcode.com directly
- **When:** Any backend or Postman request to `https://leetcode.com/problems/...`
- **Root cause:** Cloudflare blocks all non-browser requests (no session cookie = 403)
- **Fix:** NEVER call leetcode.com from backend. Always use alfa-leetcode-api proxy at `http://leetcode-api:3000`. The `https://leetcode.com/problems/...` links in the UI are `<a target="_blank">` for the user's browser only.

### E33 — LC profile endpoint returns wrong ranking
- **Error:** LCDashboard shows incorrect ranking number
- **When:** `parseLCDashboard` is parsing ranking
- **Root cause:** Old bug (fixed): `fmt.Sscanf(*stat.Rank, "#%d", &d.Ranking)` was overwriting `d.Ranking` with the count (1) returned by Sscanf, not the value scanned
- **Fix (applied):** Now reads `d.Ranking` directly from `raw.Profile.Ranking` in raw_data JSON

### E34 — alfa-leetcode-api 404 for valid user
- **Error:** LeetCode sync fails with ErrNotFound for an existing LC user
- **When:** alfa-leetcode-api version mismatch, or user has no public profile
- **Root cause:** Some LeetCode user settings make the profile API return 404
- **Fix:** Ensure using `alfaarghya/alfa-leetcode-api:2.0.4`. If user has hidden profile, nothing can be done.

---

## n8n / Webhook Errors

### E35 — n8n returns 524 timeout
- **Error:** 502 from Go backend with "n8n returned status 524"
- **When:** AI processing takes >10 seconds and n8n is in "Respond to Webhook" mode
- **Root cause:** "Using Respond to Webhook Node" has a ~10s timeout; AI takes 15-30s
- **Fix:** In n8n webhook settings, change response mode to "When Last Node Finishes"

### E36 — n8n returns `[{"output": null}]`
- **Error:** 502 from backend — JSON unwrap gets null
- **When:** AI node returns no output (model error, empty response)
- **Root cause:** n8n AI node errored but workflow didn't fail gracefully
- **Fix:** Check n8n execution log for AI node error. Common: wrong model name, quota exceeded, invalid API key.

### E37 — n8n returns truncated JSON
- **Error:** json.Unmarshal fails with "unexpected end of JSON input"
- **When:** Large roadmap (many weeks, many problems) exceeds AI max tokens
- **Root cause:** `maxOutputTokens` set too low (1024 or 2048 default)
- **Fix:** Set `maxOutputTokens: 8192` in n8n Gemini node, or reduce roadmap scope.

### E38 — n8n response wrapped in markdown fences
- **Error:** `json.Unmarshal` fails with "invalid character '`' looking for beginning of value"
- **When:** AI outputs ```json ... ``` despite instructions
- **Root cause:** Some models wrap JSON in markdown code fences
- **Fix:** `stripMarkdownFences()` in `ai_service.go` handles this. If still happening, the fence stripping logic is:
  ```go
  if strings.HasPrefix(s, "```") {
      idx := strings.Index(s, "\n"); s = s[idx+1:]
      idx = strings.LastIndex(s, "```"); s = s[:idx]
  }
  ```

### E39 — n8n "gpt-5-mini" model does not exist
- **Error:** n8n 524 or AI node error
- **When:** OpenAI model name typo in n8n node config
- **Root cause:** `gpt-5-mini` is not a valid OpenAI model
- **Fix:** Use `gpt-4o-mini`. For Gemini, use `gemini-2.5-flash` or `gemini-2.0-flash`.

### E40 — BuildStudentContext empty payload to n8n
- **Error:** n8n receives `{}` or minimal data, generates generic roadmap
- **When:** First-time user who hasn't synced, or sync failed silently
- **Root cause:** Old bug: errors in CF/LC API calls were swallowed, empty StudentContext sent
- **Fix (applied):** `BuildStudentContext` now returns `ErrBadRequest` if `len(accounts) == 0`. CF/LC errors now propagated (not swallowed).

### E41 — "n8n request failed: context deadline exceeded"
- **Error:** 502 from backend
- **When:** n8n webhook takes >90 seconds
- **Root cause:** `s.http` (http.Client) has `Timeout: 90 * time.Second`; n8n response exceeds this
- **Fix:** Increase timeout in `NewAIService` if needed. Current 90s should be sufficient for GPT-4o-mini. If AI model is slow, consider async processing.

---

## Gemini API Errors

### E42 — Gemini API key "AQ." prefix invalid
- **Error:** Gemini returns HTML error page instead of JSON; backend returns 502
- **When:** GEMINI_API_KEY starts with "AQ." (not "AIza")
- **Root cause:** "AQ." prefixed keys are OAuth tokens, not API keys. Google AI Studio generates "AIza" prefixed API keys.
- **Fix:** Get new API key at aistudio.google.com/apikey. Ensure key starts with "AIza".

### E43 — Gemini "RESOURCE_EXHAUSTED" quota exceeded
- **Error:** 502 from backend — "Gemini error: You exceeded your current quota"
- **When:** Free tier daily quota exceeded (typically 1500 req/day for gemini-2.5-flash)
- **Root cause:** Daily request quota exhausted
- **Fix:** Wait until quota resets (midnight Pacific), or upgrade to paid tier, or switch to n8n webhook (uses its own API key).

### E44 — Gemini model unavailable on v1beta
- **Error:** 404 from Gemini API — model not found
- **When:** `GEMINI_MODEL` set to a model not available on `v1beta` endpoint
- **Root cause:** `geminiBaseURL` uses `v1beta`; some models may only be available on `v1`
- **Fix:** Change `GEMINI_MODEL` to `gemini-2.0-flash` (confirmed working). Or switch from `v1beta` to `v1` in `geminiBaseURL` constant.
