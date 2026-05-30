---
title: Backend Deep Dive
type: brain
last_updated: 2026-05-31
---

# Backend Deep Dive

---

## main.go Startup Sequence

```
1. godotenv.Load()                          — load .env file
2. zap.NewProduction()                       — structured JSON logger
3. config.Load()                             — read all env vars
4. Warn if GEMINI_API_KEY doesn't start with "AIza"
5. pgxpool.New(DATABASE_URL)                 — Postgres connection pool
6. redis.NewClient(RedisURL)                 — Redis client
7. cache.New(rdb)                            — RedisCache wrapper
8. NewUserRepo, TokenRepo, PlatformRepo, StatsRepo, GoalsRepo, RoadmapRepo, AnalysesRepo
9. services.NewAuthService(...)              — loads RSA keys from base64 env vars
10. services.NewCodeforcesService(cache)
11. services.NewLeetCodeService(LEETCODE_API_URL, cache)
12. services.NewProfileService, AccountsService, StatsService
13. services.NewAIService(...)              — all repos + both AI providers
14. handlers.New, NewAuthHandler, NewProfileHandler, NewAccountsHandler, NewRoadmapHandler, NewRecommendationsHandler, NewAnalyzerHandler
15. fiber.New() with global ErrorHandler     — returns 500 JSON on unhandled panics
16. Middleware chain: Recover → Logger → CORS → SecurityHeaders
17. Public routes: /health, /ready
18. Goroutine: serve Prometheus metrics on :9091/metrics
19. Rate limiters: authLimit(10/min), apiLimit(60/min)
20. /api/v1/config (public)
21. /api/v1/auth/* with authLimit
22. protected group with apiLimit + Auth middleware
23. All protected routes registered
24. app.Listen(":8080")
```

---

## Middleware in Order

All applied globally before routes:

1. **Recover** (`middleware/recover.go`) — catches panics, logs with zap, returns 500 JSON
2. **Logger** (`middleware/logger.go`) — zap structured request/response logging
3. **CORS** (`middleware/cors.go`) — `cors.New` with `AllowOrigins: FRONTEND_URL`, `AllowCredentials: true`, `AllowMethods: GET,POST,PUT,DELETE,OPTIONS`
4. **SecurityHeaders** (`middleware/security.go`) — sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin`, `Content-Security-Policy: default-src 'self'`

Route-level:

5. **RateLimit** (`middleware/ratelimit.go`) — Redis sliding window. Key: `ratelimit:{group}:{ip}:{method}`. Returns 429 JSON on exceeding limit.
6. **Auth** (`middleware/auth.go`) — reads `access_token` cookie OR `Authorization: Bearer {token}` header. Calls `authSvc.ParseAccessToken`. Sets `Locals["userID"]` and `Locals["username"]`.

---

## Every Handler Function Signature

### AuthHandler (`handlers/auth.go`)
- `Register(c *fiber.Ctx) error` — POST /auth/register → `parseAndValidate(RegisterInput)` → `auth.Register` → 201
- `Login(c *fiber.Ctx) error` — POST /auth/login → `parseAndValidate(LoginInput)` → `auth.Login` → set cookies → 200
- `Logout(c *fiber.Ctx) error` — POST /auth/logout → read refresh cookie → `auth.Logout` → clear cookies → 200
- `Refresh(c *fiber.Ctx) error` — POST /auth/refresh → read refresh cookie → `auth.Refresh` → set new cookies → 200
- `ChangePassword(c *fiber.Ctx) error` — PUT /profile/password → validate → `auth.ChangePassword` → 200

### ProfileHandler (`handlers/profile.go`)
- `Get(c *fiber.Ctx) error` — GET /profile
- `Update(c *fiber.Ctx) error` — PUT /profile → `parseAndValidate(UpdateProfileInput)`
- `Delete(c *fiber.Ctx) error` — DELETE /profile
- `ListSessions(c *fiber.Ctx) error` — GET /sessions
- `RevokeSession(c *fiber.Ctx) error` — DELETE /sessions/:id
- `RevokeAllSessions(c *fiber.Ctx) error` — DELETE /sessions

### AccountsHandler (`handlers/accounts.go`)
- `ListAccounts(c *fiber.Ctx) error` — GET /accounts
- `Connect(c *fiber.Ctx) error` — POST /accounts/connect → `parseAndValidate(ConnectInput)`
- `Disconnect(c *fiber.Ctx) error` — DELETE /accounts/:platform
- `Sync(c *fiber.Ctx) error` — POST /accounts/sync → `stats.SyncAll`
- `GetStats(c *fiber.Ctx) error` — GET /stats
- `GetDashboard(c *fiber.Ctx) error` — GET /dashboard
- `TestAI(c *fiber.Ctx) error` — GET /ai/test

### RoadmapHandler (`handlers/roadmap.go`)
- `Generate(c *fiber.Ctx) error` — POST /roadmap/generate → `ai.BuildStudentContext` → `ai.GenerateRoadmap` → store → return parsed JSON
- `GetLatest(c *fiber.Ctx) error` — GET /roadmap → `roadmaps.LatestByUserID` → return null if ErrNotFound
- `GetGoals(c *fiber.Ctx) error` — GET /goals → `goals.FindByUserID`
- `UpsertGoals(c *fiber.Ctx) error` — PUT /goals → `goals.Upsert`

### AnalyzerHandler (`handlers/analyzer.go`)
- `Analyze(c *fiber.Ctx) error` — POST /analyze → `ai.AnalyzeProblem` → `json.Unmarshal` → `normalizeAnalysis` → `analyses.Insert` → 201
- `ListAnalyses(c *fiber.Ctx) error` — GET /analyses → paginated
- `GetAnalysis(c *fiber.Ctx) error` — GET /analyses/:id → verify ownership

### RecommendationsHandler (`handlers/recommendations.go`)
- `List(c *fiber.Ctx) error` — GET /recommendations → `ai.BuildStudentContext` → `ai.GenerateRecommendations`

### HealthHandler (`handlers/health.go`)
- `Health(c *fiber.Ctx) error` — GET /health → 200
- `Ready(c *fiber.Ctx) error` — GET /ready → ping DB + Redis
- `Config(c *fiber.Ctx) error` — GET /config → return `{model: cfg.GeminiModel}`

### Helpers (`handlers/helpers.go`)
- `ok(c, data)` — `{success:true, data:..., error:null}`
- `errResponse(c, status, msg)` — `{success:false, data:null, error:"..."}`
- `parseAndValidate(c, dest)` — BodyParser + validator.Struct
- `mapServiceErr(c, err)` — maps service sentinels to HTTP status codes:
  - `ErrNotFound` → 404
  - `ErrUnauthorized` → 401
  - `ErrConflict` → 409 (includes err.Error() in response)
  - `ErrBadRequest` → 400 (includes err.Error() in response)
  - `ErrExternal` → 502 (includes err.Error() in response)
  - `default` → 500 "internal server error"

---

## Every Service Function Signature

### AuthService (`services/auth_service.go`)
- `NewAuthService(users, tokens, privKeyB64, pubKeyB64, accessTTL, refreshTTL) (*AuthService, error)`
- `Register(ctx, RegisterInput) (*models.User, error)`
- `Login(ctx, LoginInput) (*models.User, *TokenPair, error)`
- `Refresh(ctx, rawRefreshToken string) (*models.User, *TokenPair, error)`
- `Logout(ctx, rawRefreshToken string) error`
- `ParseAccessToken(tokenStr string) (*AccessClaims, error)`
- `ChangePassword(ctx, userID, current, newPw string) error`
- `issueTokenPair(ctx, user) (*TokenPair, error)` — internal

### ProfileService (`services/profile_service.go`)
- `NewProfileService(users, tokens) *ProfileService`
- `GetProfile(ctx, userID) (*models.User, error)`
- `UpdateProfile(ctx, userID, UpdateProfileInput) (*models.User, error)`
- `DeleteAccount(ctx, userID) error`
- `ListSessions(ctx, userID) ([]*models.RefreshToken, error)`
- `RevokeSession(ctx, userID, sessionID) error`
- `RevokeAllSessions(ctx, userID) error`

### AccountsService (`services/accounts_service.go`)
- `NewAccountsService(platforms, cache, cf, lc) *AccountsService`
- `Connect(ctx, userID, ConnectInput) (*models.PlatformAccount, error)` — saves handle, no validation at connect time
- `Disconnect(ctx, userID, platform) error` — deletes DB row + clears Redis keys
- `ListAccounts(ctx, userID) ([]*models.PlatformAccount, error)`
- `UpdateLastSynced(ctx, userID, platform) error`

### StatsService (`services/stats_service.go`)
- `NewStatsService(platforms, stats, cf, lc) *StatsService`
- `SyncAll(ctx, userID) error` — syncs all connected platforms
- `GetLatestStats(ctx, userID) ([]*models.UserStats, error)`
- `GetDashboard(ctx, userID) (*DashboardData, error)` — returns parsed CFDashboard + LCDashboard
- `syncCF(ctx, userID, handle) error` — internal
- `syncLC(ctx, userID, handle) error` — internal
- `parseCFDashboard(handle, stat) *CFDashboard` — parses raw_data JSONB
- `parseLCDashboard(handle, stat) *LCDashboard` — parses raw_data JSONB

### CodeforcesService (`services/codeforces_service.go`)
- `NewCodeforcesService(cache) *CodeforcesService`
- `GetUserInfo(ctx, handle) (*models.CodeforcesUser, error)`
- `GetRatingHistory(ctx, handle) ([]models.CodeforcesRatingChange, error)`
- `GetSubmissions(ctx, handle, count int) ([]models.CodeforcesSubmission, error)`
- `BuildTagFrequency(subs) map[string]int` — exported helper, deduplicates by contestId/index

### LeetCodeService (`services/leetcode_service.go`)
- `NewLeetCodeService(baseURL, cache) *LeetCodeService`
- `GetProfile(ctx, handle) (*models.LeetCodeProfile, error)`
- `GetContest(ctx, handle) (*models.LeetCodeContest, error)`
- `GetAcSubmissions(ctx, handle) ([]models.LeetCodeSubmission, error)`
- `GetSkill(ctx, handle) (*models.LeetCodeSkill, error)`
- `GetCalendar(ctx, handle) (map[string]int, error)` — returns submissionCalendar map

### AIService (`services/ai_service.go`)
- `NewAIService(apiKey, model, n8nAnalyzerURL, n8nRoadmapURL, platforms, stats, goals, cache, cf, lc) *AIService`
- `BuildStudentContext(ctx, userID) (*StudentContext, error)` — aggregates all user data
- `TestConnection(ctx) (string, error)` — pings Gemini with trivial prompt
- `GenerateRoadmap(ctx, sc, mode) (string, error)` — routes to n8n or Gemini
- `AnalyzeProblem(ctx, problemURL) (string, error)` — routes to n8n or Gemini
- `GenerateRecommendations(ctx, sc, topic, mode) (string, error)` — always uses Gemini
- `callGemini(ctx, systemPrompt, userMsg) (string, error)` — internal
- `callN8NAnalyzer(ctx, problemURL) (string, error)` — internal
- `callN8NRoadmap(ctx, sc, mode) (string, error)` — internal
- `stripMarkdownFences(s string) string` — internal
- `sanitize(s string) string` — truncates to 10000 chars

---

## Auth Flow Step-by-Step

### Register
1. Validate: email (valid format), username (3-30 alphanumeric), password (min 8)
2. Check `users` table for duplicate email → `ErrConflict` if found
3. Check `users` table for duplicate username → `ErrConflict` if found
4. `bcrypt.GenerateFromPassword(password, 12)` → hash
5. `INSERT INTO users` with new UUID
6. Return 201 `{id, email, username}` (NO cookies set — user must log in separately)

### Login
1. Validate: email, password (required)
2. `users.FindByEmail` → `ErrUnauthorized` if not found (same error as wrong password — no enumeration)
3. `bcrypt.CompareHashAndPassword(hash, password)` → `ErrUnauthorized` if wrong
4. `issueTokenPair`:
   - Sign JWT RS256 with `{user_id, email, username, sub, iat, exp}`
   - Generate 32 random bytes → hex string = raw refresh token
   - SHA256 hash of raw token → store hash in `refresh_tokens` table
5. Set httpOnly cookies:
   - `access_token`: Path `/`, TTL 2h, Secure=false (dev), SameSite=Strict
   - `refresh_token`: Path `/api/v1/auth`, TTL 7d, Secure=false (dev), SameSite=Strict
6. Return 200 `{id, email, username}`

### Token Refresh
1. Read `refresh_token` cookie
2. SHA256 hash the raw token
3. `tokens.FindByHash(hash)` → `ErrUnauthorized` if not found
4. Check `expires_at > now` → `ErrUnauthorized` if expired
5. `users.FindByID(rt.UserID)`
6. `tokens.DeleteByHash(hash)` — rotation: old token invalidated
7. Issue new token pair
8. Set new cookies

### Logout
1. Read `refresh_token` cookie
2. `tokens.DeleteByHash(SHA256(token))`
3. Clear cookies with MaxAge=-1

---

## How JWT RS256 Works in This Codebase

**Key loading** (`loadRSAKeys` in `auth_service.go`):
1. Base64-decode `JWT_PRIVATE_KEY` env var
2. PEM-decode the result
3. Switch on `block.Type`:
   - `"RSA PRIVATE KEY"` → `x509.ParsePKCS1PrivateKey` (openssl legacy)
   - `"PRIVATE KEY"` → `x509.ParsePKCS8PrivateKey` then cast to `*rsa.PrivateKey` (openssl 3.x default)
4. Base64-decode `JWT_PUBLIC_KEY` env var
5. PEM-decode → `x509.ParsePKIXPublicKey` → cast to `*rsa.PublicKey`

**Signing** (`issueTokenPair`):
```go
jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(s.privateKey)
```
Claims include: `user_id` (UUID string), `email`, `username`, `sub`, `iat`, `exp`.

**Validation** (`ParseAccessToken`):
```go
jwt.ParseWithClaims(tokenStr, &AccessClaims{}, func(t *jwt.Token) (interface{}, error) {
    if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok { return nil, fmt.Errorf("unexpected signing method") }
    return s.publicKey, nil
})
```

**Auth middleware** reads from `access_token` httpOnly cookie. Falls back to `Authorization: Bearer {token}` header. Sets `Locals["userID"]` (UUID string) and `Locals["username"]`.

**userUUID helper** (`handlers/user_helpers.go`): reads `c.Locals("userID").(string)` → `uuid.Parse()`.

---

## StudentContext Struct

```go
type StudentContext struct {
    // Codeforces
    CFHandle       string
    CFRating       int
    CFRank         string
    CFMaxRating    int
    CFTagFreq      map[string]int              // tag → unique solved count
    CFRecentRating []models.CodeforcesRatingChange  // last 24 contests
    CFSolvedKeys   []string                    // "contestId/index" deduped

    // LeetCode
    LCHandle        string
    LCRanking       int
    LCTotalSolved   int
    LCEasy          int
    LCMedium        int
    LCHard          int
    LCContestRating float64
    LCWeakTopics    []string                   // tags with < 5 solved
    LCSolvedSlugs   []string                   // accepted titleSlugs
    LCTopics        map[string]int             // tagName → problemsSolved (full map)

    // Goals
    Goals *models.UserGoal
}
```

**How it's built in `BuildStudentContext`:**
1. `platforms.ListByUserID(userID)` — return ErrBadRequest if empty
2. For CF account:
   - `cf.GetUserInfo` → CFRating, CFRank, CFMaxRating (uses Redis cache)
   - `cf.GetSubmissions(500)` → `BuildTagFrequency` for CFTagFreq; deduplicate OK verdicts for CFSolvedKeys
   - `cf.GetRatingHistory` → take last 24 for CFRecentRating
3. For LC account:
   - `lc.GetProfile` → LCRanking, LCTotalSolved, LCEasy/Medium/Hard
   - `lc.GetContest` → LCContestRating
   - `lc.GetAcSubmissions` → LCSolvedSlugs
   - `lc.GetSkill` → build LCTopics map; populate LCWeakTopics (< 5 solved)
4. `goals.FindByUserID` → Goals (nil if not set)
