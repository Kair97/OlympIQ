---
title: OlympIQ API Reference
type: brain
last_updated: 2026-05-31
---

# OlympIQ API Reference

**Base URL:** `http://localhost:8080` (development) / `https://your-domain.com` (production)  
**API prefix:** `/api/v1` (all protected + auth routes)  
**Public routes** (`/health`, `/ready`) have no prefix.

**Response envelope — every endpoint returns this shape:**
```json
{ "success": true,  "data": { ... },  "error": null  }
{ "success": false, "data": null,     "error": "human-readable message" }
```

**Auth mechanism:** httpOnly cookies (`access_token` + `refresh_token`). Set automatically by Login/Refresh. Include `credentials: "include"` in all frontend fetch calls. **Never read from JS.**

**Rate limits:**
- `/api/v1/auth/*` → 10 requests / minute per IP
- All other `/api/v1/*` → 60 requests / minute per IP

---

## Route Index

| Method | Path | Auth | Group |
|--------|------|------|-------|
| GET | `/health` | No | System |
| GET | `/ready` | No | System |
| GET | `/api/v1/config` | No | System |
| POST | `/api/v1/auth/register` | No | Auth |
| POST | `/api/v1/auth/login` | No | Auth |
| POST | `/api/v1/auth/logout` | Cookie | Auth |
| POST | `/api/v1/auth/refresh` | Cookie | Auth |
| GET | `/api/v1/profile` | ✅ | Profile |
| PUT | `/api/v1/profile` | ✅ | Profile |
| PUT | `/api/v1/profile/password` | ✅ | Profile |
| DELETE | `/api/v1/profile` | ✅ | Profile |
| GET | `/api/v1/sessions` | ✅ | Sessions |
| DELETE | `/api/v1/sessions` | ✅ | Sessions |
| DELETE | `/api/v1/sessions/:id` | ✅ | Sessions |
| GET | `/api/v1/accounts` | ✅ | Platforms |
| POST | `/api/v1/accounts/connect` | ✅ | Platforms |
| DELETE | `/api/v1/accounts/:platform` | ✅ | Platforms |
| POST | `/api/v1/accounts/sync` | ✅ | Platforms |
| GET | `/api/v1/stats` | ✅ | Stats |
| GET | `/api/v1/dashboard` | ✅ | Stats |
| GET | `/api/v1/ai/test` | ✅ | System |
| GET | `/api/v1/goals` | ✅ | Goals |
| PUT | `/api/v1/goals` | ✅ | Goals |
| POST | `/api/v1/roadmap/generate` | ✅ | Roadmap |
| GET | `/api/v1/roadmap` | ✅ | Roadmap |
| GET | `/api/v1/recommendations` | ✅ | AI |
| POST | `/api/v1/analyze` | ✅ | AI |
| GET | `/api/v1/analyses` | ✅ | AI |
| GET | `/api/v1/analyses/:id` | ✅ | AI |

---

## System

### GET /health
Liveness check — always 200 if the process is running.

**Request:** none  
**Response:**
```json
{
  "success": true,
  "data": { "status": "ok" },
  "error": null
}
```

---

### GET /ready
Readiness check — 200 only when both PostgreSQL and Redis are reachable.

**Request:** none  
**Success response:**
```json
{
  "success": true,
  "data": { "status": "ready", "postgres": "ok", "redis": "ok" },
  "error": null
}
```
**Error response (503):**
```json
{ "success": false, "data": null, "error": "database unavailable" }
```

---

### GET /api/v1/config
Returns the AI model name the backend is configured to use.

**Request:** none  
**Response:**
```json
{
  "success": true,
  "data": { "ai_model": "gemini-2.5-flash", "version": "1.0.0" },
  "error": null
}
```

---

## Auth

### POST /api/v1/auth/register
Create a new account.

**Request body:**
```json
{
  "email":    "oryn@example.com",
  "username": "kair97",
  "password": "mypassword123"
}
```

**Validation:**
- `email` — required, valid email format
- `username` — required, 3–30 chars, alphanumeric only (letters + digits, no spaces/symbols)
- `password` — required, min 8 chars

**Success response (201):**
```json
{
  "success": true,
  "data": {
    "id":       "550e8400-e29b-41d4-a716-446655440000",
    "email":    "oryn@example.com",
    "username": "kair97"
  },
  "error": null
}
```

**Error responses:**
```json
{ "success": false, "data": null, "error": "email already registered" }          // 409
{ "success": false, "data": null, "error": "invalid input: ..." }                // 400
```

---

### POST /api/v1/auth/login
Login and receive httpOnly session cookies.

**Request body:**
```json
{
  "email":    "oryn@example.com",
  "password": "mypassword123"
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "id":       "550e8400-e29b-41d4-a716-446655440000",
    "email":    "oryn@example.com",
    "username": "kair97"
  },
  "error": null
}
```
Sets two httpOnly cookies:
- `access_token` — JWT, 2h TTL, path `/`
- `refresh_token` — opaque token, 7d TTL, path `/api/v1/auth`

**Error responses:**
```json
{ "success": false, "data": null, "error": "invalid credentials" }    // 401
{ "success": false, "data": null, "error": "invalid input" }          // 400
```

---

### POST /api/v1/auth/logout
Invalidate the refresh token and clear cookies.

**Request:** no body needed — reads `refresh_token` cookie automatically  
**Response (200):**
```json
{ "success": true, "data": null, "error": null }
```

---

### POST /api/v1/auth/refresh
Rotate the access token using the refresh token cookie.

**Request:** no body — reads `refresh_token` cookie automatically  
**Success response (200):**
```json
{
  "success": true,
  "data": {
    "id":       "550e8400-e29b-41d4-a716-446655440000",
    "email":    "oryn@example.com",
    "username": "kair97"
  },
  "error": null
}
```
Issues fresh `access_token` cookie (and rotated `refresh_token`).

**Error (401):**
```json
{ "success": false, "data": null, "error": "missing refresh token" }
{ "success": false, "data": null, "error": "invalid or expired token" }
```

---

## Profile

### GET /api/v1/profile
Get the authenticated user's profile.

**Request:** no body  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id":         "550e8400-e29b-41d4-a716-446655440000",
    "email":      "oryn@example.com",
    "username":   "kair97",
    "created_at": "2026-01-15T10:30:00Z"
  },
  "error": null
}
```

---

### PUT /api/v1/profile
Update username and/or email. Send only the fields you want to change.

**Request body:**
```json
{
  "username": "newusername",
  "email":    "newemail@example.com"
}
```

**Validation:**
- `username` — optional, 3–30 chars, alphanumeric
- `email` — optional, valid email format
- At least one field should be provided (both are optional individually)

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "id":       "550e8400-...",
    "email":    "newemail@example.com",
    "username": "newusername"
  },
  "error": null
}
```

**Error:**
```json
{ "success": false, "data": null, "error": "username already taken" }    // 409
```

---

### PUT /api/v1/profile/password
Change password. Requires knowing the current password.

**Request body:**
```json
{
  "current_password": "oldpassword123",
  "new_password":     "newpassword456",
  "confirm_password": "newpassword456"
}
```

**Validation:**
- `new_password` — min 8 chars
- `confirm_password` — must match `new_password`
- `current_password` — must match the stored bcrypt hash

**Success response (200):**
```json
{ "success": true, "data": null, "error": null }
```

**Error:**
```json
{ "success": false, "data": null, "error": "invalid credentials" }                          // 401 — wrong current password
{ "success": false, "data": null, "error": "new password and confirm password do not match" } // 400
```

---

### DELETE /api/v1/profile
Permanently delete the account and all associated data (platform accounts, stats, roadmaps, analyses, goals, sessions).

**Request:** no body  
**Response (200):**
```json
{ "success": true, "data": null, "error": null }
```

---

## Sessions

### GET /api/v1/sessions
List all active refresh token sessions for the authenticated user.

**Request:** no body  
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id":         "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "created_at": "2026-05-30T08:00:00Z",
      "expires_at": "2026-06-06T08:00:00Z"
    }
  ],
  "error": null
}
```

---

### DELETE /api/v1/sessions
Sign out everywhere — revoke ALL refresh tokens for this user.

**Request:** no body  
**Response (200):**
```json
{ "success": true, "data": null, "error": null }
```

---

### DELETE /api/v1/sessions/:id
Revoke a single session by its UUID.

**Path param:** `id` — UUID of the session from `GET /sessions`  
**Example:** `DELETE /api/v1/sessions/3fa85f64-5717-4562-b3fc-2c963f66afa6`

**Response (200):**
```json
{ "success": true, "data": null, "error": null }
```
**Error:**
```json
{ "success": false, "data": null, "error": "invalid session id" }    // 400
```

---

## Platform Accounts

### GET /api/v1/accounts
List all connected platform accounts.

**Request:** no body  
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id":             "abc123...",
      "user_id":        "550e8400...",
      "platform":       "codeforces",
      "handle":         "kair97",
      "last_synced_at": "2026-05-31T12:00:00Z"
    },
    {
      "id":             "def456...",
      "user_id":        "550e8400...",
      "platform":       "leetcode",
      "handle":         "kair97lc",
      "last_synced_at": "2026-05-31T12:00:00Z"
    }
  ],
  "error": null
}
```

---

### POST /api/v1/accounts/connect
Connect a Codeforces or LeetCode account.  
> Handle is saved immediately. Validity is confirmed on the first sync.

**Request body:**
```json
{
  "platform": "codeforces",
  "handle":   "kair97"
}
```
or:
```json
{
  "platform": "leetcode",
  "handle":   "kair97"
}
```

**Validation:**
- `platform` — required, must be exactly `"codeforces"` or `"leetcode"`
- `handle` — required, 1–60 chars

**Success response (201):**
```json
{
  "success": true,
  "data": {
    "id":             "abc123...",
    "user_id":        "550e8400...",
    "platform":       "codeforces",
    "handle":         "kair97",
    "last_synced_at": null
  },
  "error": null
}
```

**Error:**
```json
{ "success": false, "data": null, "error": "platform already connected" }    // 409
{ "success": false, "data": null, "error": "invalid input: ..." }            // 400
```

---

### DELETE /api/v1/accounts/:platform
Disconnect a platform account and clear all its cached data from Redis.

**Path param:** `platform` — must be `codeforces` or `leetcode`  
**Examples:**
```
DELETE /api/v1/accounts/codeforces
DELETE /api/v1/accounts/leetcode
```

**Response (200):**
```json
{ "success": true, "data": null, "error": null }
```
**Error:**
```json
{ "success": false, "data": null, "error": "invalid platform" }    // 400
```

---

### POST /api/v1/accounts/sync
Trigger a full re-sync of all connected platform accounts. Fetches fresh data from Codeforces API and alfa-leetcode-api, stores new snapshots in `user_stats`.

**What gets fetched on sync:**
- **Codeforces:** user.info + user.rating (full history) + user.status (last 500 submissions) → computes tag_freq, lang_freq, rating_buckets, index_freq, recent_ac
- **LeetCode:** profile + contest + contest/history + acSubmission (100) + skill + calendar + languageStats → computes streak, recent_ac

**Request:** no body  
**Response (200):**
```json
{
  "success": true,
  "data": { "message": "sync completed" },
  "error": null
}
```

> **Note:** After deploy of new backend versions, always sync to repopulate raw_data with new fields.

---

## Stats & Dashboard

### GET /api/v1/stats
Returns the raw latest `user_stats` rows for all connected platforms. Includes the full `raw_data` JSONB.

**Request:** no body  
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id":              "...",
      "user_id":         "...",
      "platform":        "codeforces",
      "rating":          1450,
      "rank":            "specialist",
      "max_rating":      1542,
      "problems_solved": null,
      "contest_count":   24,
      "raw_data":        { ... full JSONB blob ... },
      "fetched_at":      "2026-05-31T12:00:00Z"
    }
  ],
  "error": null
}
```

---

### GET /api/v1/dashboard
Returns fully parsed, rich dashboard data ready for the frontend. All calculations done server-side.

**Request:** no body  
**Response (200) — full shape:**
```json
{
  "success": true,
  "data": {
    "codeforces": {
      "handle":          "kair97",
      "rating":          1450,
      "max_rating":      1542,
      "rank":            "specialist",
      "problems_solved": 89,
      "contest_count":   24,
      "tag_freq": {
        "greedy":              24,
        "implementation":      31,
        "math":                18,
        "dp":                   5,
        "graphs":               7
      },
      "rating_history":  [1100, 1180, 1250, 1310, 1380, 1420, 1450],
      "lang_freq": {
        "GNU G++17 7.3.0": 72,
        "Python 3":          9
      },
      "rating_buckets": {
        "800":  12,
        "900":  18,
        "1000": 22,
        "1200": 15,
        "1400": 10,
        "1600":  5,
        "unrated": 7
      },
      "index_freq": {
        "A": 38,
        "B": 29,
        "C": 14,
        "D":  5,
        "E":  3
      },
      "recent_ac": [
        {
          "name":      "Nested Segments",
          "contestId": 652,
          "index":     "D",
          "rating":    1900,
          "tags":      ["data structures", "sortings"],
          "solved_at": 1748612517
        }
      ]
    },
    "leetcode": {
      "handle":           "kair97lc",
      "rating":           1823.4,
      "ranking":          128432,
      "problems_solved":  247,
      "easy_solved":       98,
      "medium_solved":    132,
      "hard_solved":       17,
      "contest_attend":    15,
      "top_percentage":    15.0,
      "streak":             7,
      "calendar": {
        "1748476800": 3,
        "1748390400": 1,
        "1748304000": 5
      },
      "skills": [
        { "tagName": "Array",              "problemsSolved": 45 },
        { "tagName": "Dynamic Programming","problemsSolved":  8 },
        { "tagName": "Tree",               "problemsSolved": 28 }
      ],
      "language_stats": {
        "Python3": 180,
        "C++":      42,
        "Java":     25
      },
      "contest_history": [
        {
          "attended":       true,
          "trendDirection": "UP",
          "problemsSolved":  3,
          "totalProblems":   4,
          "rating":         1823.4,
          "ranking":        1200,
          "contest": {
            "title":     "Weekly Contest 395",
            "startTime": 1709906400
          }
        }
      ],
      "recent_ac": [
        {
          "title":     "Two Sum",
          "titleSlug": "two-sum",
          "solved_at": 1748612517,
          "lang":      "python3"
        }
      ]
    }
  },
  "error": null
}
```

---

### GET /api/v1/ai/test
Pings the Gemini/AI backend with a trivial prompt to confirm the API key works.

**Request:** no body  
**Success response (200):**
```json
{
  "success": true,
  "data": { "status": "ok", "response": "OlympIQ AI is working!" },
  "error": null
}
```
**Error (502):**
```json
{
  "success": false,
  "data": { "status": "error" },
  "error": "invalid API key or quota exceeded"
}
```

---

## Goals

### GET /api/v1/goals
Get the authenticated user's current goal. Returns `null` data if no goal is set.

**Request:** no body  
**Response (200) — goal set:**
```json
{
  "success": true,
  "data": {
    "id":              "...",
    "user_id":         "...",
    "goal_type":       "rating",
    "target_rating":   2000,
    "target_date":     "2026-09-01T00:00:00Z",
    "weekly_hours":    15,
    "notify_daily":    false,
    "notify_weekly":   true,
    "notify_problems": false,
    "created_at":      "2026-05-01T10:00:00Z",
    "updated_at":      "2026-05-31T10:00:00Z"
  },
  "error": null
}
```
**Response (200) — no goal:**
```json
{ "success": true, "data": null, "error": null }
```

---

### PUT /api/v1/goals
Create or update the user's goal (upsert — one goal per user).

**Request body:**
```json
{
  "goal_type":       "rating",
  "target_rating":   2000,
  "target_date":     "2026-09-01T00:00:00Z",
  "weekly_hours":    15,
  "notify_daily":    false,
  "notify_weekly":   true,
  "notify_problems": false
}
```

**Validation:**
- `goal_type` — required, must be one of: `"rating"`, `"interview"`, `"topic_mastery"`
- `target_rating` — optional integer (e.g. 2000)
- `target_date` — optional ISO8601 datetime string
- `weekly_hours` — optional integer (1–168)
- `notify_daily`, `notify_weekly`, `notify_problems` — boolean

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "id":              "...",
    "user_id":         "...",
    "goal_type":       "rating",
    "target_rating":   2000,
    "target_date":     "2026-09-01T00:00:00Z",
    "weekly_hours":    15,
    "notify_daily":    false,
    "notify_weekly":   true,
    "notify_problems": false,
    "created_at":      "2026-05-01T10:00:00Z",
    "updated_at":      "2026-05-31T12:00:00Z"
  },
  "error": null
}
```

---

## Roadmap

### POST /api/v1/roadmap/generate
Generate a personalized AI roadmap. Builds full student context (CF + LC stats + goals) and sends to n8n agent (or falls back to Gemini). Stores the result in the DB. Can take 15–60 seconds.

**Request body:**
```json
{ "mode": "all" }
```
> `mode` is accepted for backwards compatibility but always sent as `"all"` to the AI — the response always contains all three views.

**Success response (200) — returns the full unified roadmap:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_weeks":     12,
      "estimated_hours": 180,
      "focus_areas":     ["Dynamic Programming", "Graph", "Tree"],
      "milestones": [
        { "week": 2, "description": "Complete all easy DP problems" },
        { "week": 5, "description": "Reach 1600 CF rating" }
      ]
    },
    "weekly_mode": {
      "generated_at": "2026-05-31T12:00:00Z",
      "goal_summary":  "Focus on DP and Graphs over 12 weeks.",
      "weeks": [
        {
          "week":         1,
          "theme":        "Foundation: Dynamic Programming",
          "focus_topics": ["Dynamic Programming"],
          "problems": [
            {
              "title":      "Climbing Stairs",
              "platform":   "leetcode",
              "url":        "https://leetcode.com/problems/climbing-stairs/",
              "rating":     null,
              "difficulty": "easy",
              "tags":       ["dynamic programming"],
              "reason":     "You have only 5 DP problems solved — start with the classic."
            }
          ]
        }
      ]
    },
    "topic_mode": {
      "generated_at": "2026-05-31T12:00:00Z",
      "goal_summary":  "Strengthen your weakest topics.",
      "topics": [
        {
          "name":           "Dynamic Programming",
          "why":            "You solved only 5 DP problems vs 20 expected at your level.",
          "strength_score": 0.25,
          "problems": [ { ... same problem shape ... } ]
        }
      ]
    },
    "interview_mode": {
      "generated_at":     "2026-05-31T12:00:00Z",
      "target_companies": ["FAANG"],
      "patterns": [
        {
          "name":            "Dynamic Programming",
          "frequency":       1.0,
          "user_strength":   "weak",
          "problems_solved": 5,
          "problems": [ { ... same problem shape ... } ]
        }
      ]
    }
  },
  "error": null
}
```

**Error:**
```json
{ "success": false, "data": null, "error": "no platforms connected — connect Codeforces or LeetCode in your profile first" }  // 400
{ "success": false, "data": null, "error": "AI service unavailable" }  // 502
```

---

### GET /api/v1/roadmap
Get the latest stored roadmap. Returns `null` if none has been generated yet.

**Request:** no body  
**Response (200) — roadmap exists:**
```json
{
  "success": true,
  "data": {
    "roadmap":      { ... full unified roadmap object (same shape as generate response) ... },
    "mode":         "all",
    "generated_at": "2026-05-31T12:00:00Z"
  },
  "error": null
}
```
**Response (200) — no roadmap yet:**
```json
{ "success": true, "data": null, "error": null }
```

---

## Recommendations

### GET /api/v1/recommendations
Get AI-curated unsolved problems tailored to the user's exact stats. Never recommends already-solved problems.

**Query params:**
| Param | Default | Description |
|-------|---------|-------------|
| `topic` | `""` (any) | Filter to a specific topic, e.g. `dp`, `graphs`, `dynamic-programming` |
| `mode` | `"general"` | Context mode: `general`, `interview`, `topic` |

**Example requests:**
```
GET /api/v1/recommendations
GET /api/v1/recommendations?topic=dp&mode=interview
GET /api/v1/recommendations?topic=graphs
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "title":      "House Robber",
      "platform":   "leetcode",
      "url":        "https://leetcode.com/problems/house-robber/",
      "rating":     null,
      "difficulty": "medium",
      "tags":       ["dynamic programming"],
      "reason":     "You've solved only 5 DP problems. This introduces overlapping subproblems."
    },
    {
      "title":    "Codeforces Round 652 - Problem D",
      "platform": "codeforces",
      "url":      "https://codeforces.com/contest/652/problem/D",
      "rating":   1600,
      "difficulty": null,
      "tags":     ["data structures", "sortings"],
      "reason":   "Your rating is 1450. This 1600-rated problem will stretch you on data structures."
    }
  ],
  "error": null
}
```

---

## Problem Analyzer

### POST /api/v1/analyze
Submit a problem URL for AI analysis (razbor). AI explains the approach without giving working code. Saves the result to history. Takes 15–60 seconds.

**Request body:**
```json
{ "problem_url": "https://codeforces.com/contest/1900/problem/C" }
```
or:
```json
{ "problem_url": "https://leetcode.com/problems/house-robber/" }
```

**Validation:**
- `problem_url` — required, must be a valid URL

**Success response (201):**
```json
{
  "success": true,
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "analysis": {
      "problem_title": "Array Game",
      "platform":      "codeforces",
      "problem_url":   "https://codeforces.com/contest/1900/problem/C",
      "classification": {
        "type":             "Greedy",
        "subtype":          "Exchange Argument",
        "difficulty_label": "1400",
        "confidence":       0.92
      },
      "key_observations": [
        "The optimal strategy involves sorting and comparing adjacent elements.",
        "Swapping two elements changes the sum by a predictable delta."
      ],
      "algorithm_approach": {
        "summary": "Sort the array and apply a greedy swap strategy. The key insight is that any swap of adjacent elements affects the answer by a fixed amount.",
        "hints": [
          { "level": 1, "text": "Think about what happens to the total when you swap two elements." },
          { "level": 2, "text": "If you sort the array, which pairs of adjacent elements benefit most from swapping?" },
          { "level": 3, "text": "The answer is: sort the array, then greedily swap pairs (a[i], a[i+1]) where a[i] > a[i+1] by the maximum possible amount." }
        ]
      },
      "solution_steps": [
        "Read the array of n integers.",
        "Sort the array in non-decreasing order.",
        "Iterate through adjacent pairs and compute the potential improvement from swapping.",
        "Apply the best swap. Return the sum."
      ],
      "complexity": {
        "time":  "O(n log n)",
        "space": "O(1)",
        "note":  "Dominated by the sort. The greedy pass is O(n)."
      },
      "common_mistakes": [
        "Forgetting that swapping non-adjacent elements may yield a larger gain in special cases.",
        "Off-by-one error when iterating adjacent pairs."
      ],
      "similar_problems": [
        {
          "title":             "Sort Colors",
          "platform":          "leetcode",
          "url":               "https://leetcode.com/problems/sort-colors/",
          "rating":            null,
          "tags":              ["greedy", "sorting"],
          "similarity_reason": "Both problems use a greedy approach on sorted arrays."
        }
      ]
    }
  },
  "error": null
}
```

**Error:**
```json
{ "success": false, "data": null, "error": "problem_url is required and must be a valid URL" }  // 400
{ "success": false, "data": null, "error": "AI service unavailable" }                           // 502
```

---

### GET /api/v1/analyses
List saved analyses for the authenticated user, paginated.

**Query params:**
| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `page` | `1` | — | Page number (1-based) |
| `limit` | `20` | `100` | Items per page |

**Example:**
```
GET /api/v1/analyses
GET /api/v1/analyses?page=2&limit=10
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id":            "7c9e6679-...",
        "user_id":       "550e8400-...",
        "problem_url":   "https://codeforces.com/contest/1900/problem/C",
        "problem_title": "Array Game",
        "platform":      "codeforces",
        "created_at":    "2026-05-31T12:00:00Z"
      }
    ],
    "total": 42,
    "page":  1,
    "limit": 20
  },
  "error": null
}
```

---

### GET /api/v1/analyses/:id
Get a single saved analysis by its UUID.

**Path param:** `id` — UUID from the list  
**Example:** `GET /api/v1/analyses/7c9e6679-7425-40de-944b-e07fc1f90ae7`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id":          "7c9e6679-...",
    "problem_url": "https://codeforces.com/contest/1900/problem/C",
    "analysis":    { ... full analysis object (same shape as POST /analyze response) ... },
    "created_at":  "2026-05-31T12:00:00Z"
  },
  "error": null
}
```

**Error:**
```json
{ "success": false, "data": null, "error": "forbidden" }          // 403 — not your analysis
{ "success": false, "data": null, "error": "invalid analysis ID" } // 400
```

---

## Common Error Codes

| HTTP | Meaning | When it happens |
|------|---------|----------------|
| 400 | Bad Request | Missing/invalid field, validation failure |
| 401 | Unauthorized | No access_token cookie, or expired token |
| 403 | Forbidden | Trying to access another user's resource |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Email/username already taken, platform already connected |
| 429 | Too Many Requests | Rate limit exceeded (10/min auth, 60/min api) |
| 500 | Internal Server Error | Unhandled server error |
| 502 | Bad Gateway | External API error (CF, LC, AI) |
| 503 | Service Unavailable | DB or Redis unreachable (only on /ready) |

---

## Postman Quick-Start

### Step 1 — Register
```
POST http://localhost:8080/api/v1/auth/register
Body: { "email": "test@test.com", "username": "testuser", "password": "password123" }
```

### Step 2 — Login (sets cookies automatically in Postman)
```
POST http://localhost:8080/api/v1/auth/login
Body: { "email": "test@test.com", "password": "password123" }
Settings: ✅ "Automatically follow redirects", ✅ Cookie jar enabled
```

### Step 3 — Connect platforms
```
POST http://localhost:8080/api/v1/accounts/connect
Body: { "platform": "codeforces", "handle": "kair97" }

POST http://localhost:8080/api/v1/accounts/connect
Body: { "platform": "leetcode", "handle": "yourlchandle" }
```

### Step 4 — Sync stats (takes ~10s)
```
POST http://localhost:8080/api/v1/accounts/sync
```

### Step 5 — See your dashboard data
```
GET http://localhost:8080/api/v1/dashboard
```

---

## Related notes

[[00-Master-Context]] · [[02-Backend-Deep]] · [[Codeforces API Reference]] · [[LeetCode alfa-leetcode-api Reference]] · [[07-Testing-Guide]] · [[06-Errors-Bible]]
