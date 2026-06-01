---
title: Testing Guide
type: brain
last_updated: 2026-05-31
---

# Testing Guide

---

## Backend Tests

### Run all backend tests
```bash
cd backend && go test ./... -v -cover
```

### Run with race detector
```bash
cd backend && go test ./... -race -cover
```

### Run specific package
```bash
cd backend && go test ./internal/handlers/... -v
cd backend && go test ./internal/services/... -v
```

### Test files that exist
- `backend/internal/handlers/auth_test.go` — auth handler tests
- `backend/internal/handlers/health_test.go` — health/ready endpoint tests
- `backend/internal/handlers/test_helpers_test.go` — shared test setup
- `backend/internal/services/auth_service_test.go` — auth service unit tests
- `backend/internal/services/codeforces_service_test.go` — CF service tests

---

## Frontend Tests

### Run all frontend tests
```bash
cd frontend && npm run test
```

### Test files that exist
- `frontend/src/test/Analyzer.test.tsx` — Analyzer page tests
- `frontend/src/test/Login.test.tsx` — Login form tests
- `frontend/src/test/Register.test.tsx` — Register form tests
- `frontend/src/test/setup.ts` — Vitest + jsdom setup

### Key test assertions
The Analyzer test MUST assert:
- No `<textarea>` element (no code editor)
- No CodeMirror or editor elements
- Presence of external "Solve ↗" or "Open on Codeforces ↗" link

---

## Postman Collection for All Endpoints

### Environment variables
| Variable | Value |
|----------|-------|
| `base_url` | `http://localhost:8080/api/v1` |
| `access_token` | (set automatically from login response) |

### Full test sequence

**1. Health check**
```
GET {{base_url}}/../health
Expected: 200 {status: "ok"}
```

**2. Register**
```
POST {{base_url}}/auth/register
Body: {"email": "test@example.com", "username": "testuser", "password": "password123"}
Expected: 201 {id, email, username}
```

**3. Login**
```
POST {{base_url}}/auth/login
Body: {"email": "test@example.com", "password": "password123"}
Expected: 200 {id, email, username}
Note: Sets httpOnly cookies access_token and refresh_token
Postman: Enable "Send cookies" in settings
```

**4. Get profile**
```
GET {{base_url}}/profile
Cookie: access_token=... (set by Postman cookie jar)
Expected: 200 {id, email, username, created_at}
```

**5. Connect Codeforces**
```
POST {{base_url}}/accounts/connect
Body: {"platform": "codeforces", "handle": "tourist"}
Expected: 201 {id, user_id, platform, handle}
```

**6. Connect LeetCode**
```
POST {{base_url}}/accounts/connect
Body: {"platform": "leetcode", "handle": "tourist"}
Expected: 201
```

**7. Sync accounts**
```
POST {{base_url}}/accounts/sync
Expected: 200 {"message": "sync completed"}
Note: Takes 5-15 seconds (CF API + LC API calls)
```

**8. Get dashboard**
```
GET {{base_url}}/dashboard
Expected: 200 {codeforces: {handle, rating, max_rating, ...}, leetcode: {...}}
```

**9. Set goals**
```
PUT {{base_url}}/goals
Body: {"goal_type": "rating", "target_rating": 2000, "notify_daily": false, "notify_weekly": true, "notify_problems": false}
Expected: 200 {id, user_id, goal_type, target_rating, ...}
```

**10. Generate roadmap (weekly)**
```
POST {{base_url}}/roadmap/generate
Body: {"mode": "weekly"}
Expected: 200 {mode, generated_at, goal_summary, weeks: [...]}
Note: Takes 15-30 seconds
```

**11. Get roadmap**
```
GET {{base_url}}/roadmap
Expected: 200 {roadmap: {...}, mode: "weekly", generated_at: "..."}
```

**12. Get recommendations**
```
GET {{base_url}}/recommendations?topic=dp&limit=5
Expected: 200 [{title, platform, url, rating, difficulty, tags, reason}]
```

**13. Analyze problem**
```
POST {{base_url}}/analyze
Body: {"problem_url": "https://codeforces.com/contest/1842/problem/B"}
Expected: 201 {id, analysis: {problem_title, classification, key_observations, ...}}
Note: Takes 15-30 seconds
```

**14. List analyses**
```
GET {{base_url}}/analyses?page=1&limit=10
Expected: 200 {items: [...], total: N, page: 1, limit: 10}
```

**15. Get analysis by ID**
```
GET {{base_url}}/analyses/{id from step 13}
Expected: 200 {id, problem_url, analysis: {...}, created_at}
```

**16. Change password**
```
PUT {{base_url}}/profile/password
Body: {"current_password": "password123", "new_password": "newpassword456", "confirm_password": "newpassword456"}
Expected: 200 {data: null}
```

**17. Refresh token**
```
POST {{base_url}}/auth/refresh
(No body — uses refresh_token cookie)
Expected: 200 {id, email, username}
```

**18. Disconnect platform**
```
DELETE {{base_url}}/accounts/codeforces
Expected: 200 {data: null}
```

**19. Logout**
```
POST {{base_url}}/auth/logout
Expected: 200 {data: null}
```

**20. Test AI connection**
```
GET {{base_url}}/ai/test
Expected: 200 {status: "ok", response: "OlympIQ AI is working!"}
```

---

## Testing n8n Agents Directly

### Analyzer agent
```bash
curl -X POST https://kair97.app.n8n.cloud/webhook/olympiq-problem-analysis \
  -H "Content-Type: application/json" \
  -d '{"problem_url": "https://codeforces.com/contest/1842/problem/B"}'
```
Expected: JSON object with problem_title, classification, key_observations, etc.
If returns `[{"output": "..."}]` array: n8n is in "When Last Node Finishes" mode — the backend unwraps this automatically.

### Roadmap agent
```bash
curl -X POST https://kair97.app.n8n.cloud/webhook/coding-roadmap \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "mode": "weekly",
    "weekly_hours": 15,
    "codeforces": {"rating": 1400, "rank": "specialist", "problems_solved": 245, "topics": {"dp": 45}},
    "goal": "rating",
    "target_rating": 2000
  }'
```
Expected: Weekly roadmap JSON with weeks array.

---

## Key Test Patterns (Backend)

### Table-driven test example
```go
func TestAuthService_Register(t *testing.T) {
    tests := []struct{
        name    string
        input   services.RegisterInput
        wantErr error
    }{
        {"valid user", services.RegisterInput{Email:"a@b.com", Username:"alice", Password:"pass1234"}, nil},
        {"duplicate email", ..., services.ErrConflict},
        {"short password", ..., /* validator error */},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // ... test
        })
    }
}
```

### Mock HTTP server for CF/LC tests
```go
// In codeforces_service_test.go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if strings.Contains(r.URL.Path, "user.info") {
        json.NewEncoder(w).Encode(cfUserInfoFixture)
    }
}))
defer server.Close()
svc := services.NewCodeforcesService(mockCache)
// Override base URL to server.URL for testing
```

### httptest for handler integration tests
```go
app := setupTestApp() // fiber app with routes
req := httptest.NewRequest("POST", "/api/v1/auth/login", strings.NewReader(`{"email":"a@b.com","password":"p"}`))
req.Header.Set("Content-Type", "application/json")
resp, _ := app.Test(req)
assert.Equal(t, 200, resp.StatusCode)
```

---

## Common Test Fixtures

### Valid user
```go
{Email: "testuser@example.com", Username: "testuser", Password: "password123"}
```

### CF user.info response
```json
{"status":"OK","result":[{"handle":"testuser","rating":1400,"rank":"specialist","maxRating":1600,"maxRank":"expert"}]}
```

### LC profile response
```json
{"username":"testuser","ranking":12345,"totalSolved":120,"easySolved":60,"mediumSolved":50,"hardSolved":10,"acceptanceRate":"62.5%"}
```

### Minimal analysis JSON
```json
{"problem_title":"Two Sum","platform":"leetcode","problem_url":"https://leetcode.com/problems/two-sum/","classification":{"type":"Hash Table","subtype":"","difficulty_label":"Easy","confidence":0.95},"key_observations":["Use a hash map"],"algorithm_approach":{"summary":"Two-pass hash table","hints":[{"level":1,"text":"hint1"},{"level":2,"text":"hint2"},{"level":3,"text":"hint3"}]},"solution_steps":["step1"],"complexity":{"time":"O(n)","space":"O(n)","note":""},"common_mistakes":[],"similar_problems":[]}
```

---

## Related notes

[[00-Master-Context]] · [[02-Backend-Deep]] · [[Codeforces API Reference]] · [[LeetCode alfa-leetcode-api Reference]] · [[06-Errors-Bible]] · [[05-n8n-Agents]]
