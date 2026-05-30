---
title: LeetCode alfa-leetcode-api Reference
type: reference
last_updated: 2026-05-30
---

# LeetCode alfa-leetcode-api Reference

**Source:** `alfaarghya/alfa-leetcode-api` — open-source LeetCode data proxy.
**Docker image:** `alfaarghya/alfa-leetcode-api:2.0.4`
**OlympIQ base URL (local):** `http://leetcode-api:3000` (inside Docker network) / `http://localhost:3002` (host)
**Public fallback:** `https://alfa-leetcode-api.onrender.com`
**Env var:** `LEETCODE_API_URL=http://leetcode-api:3000`

**Error behaviour:**
- `HTTP 404` — username not found or problem slug invalid
- `HTTP 500` — LeetCode upstream error
- All successful responses return `HTTP 200` with JSON body

**Retry policy (OlympIQ):** max 2 retries, 500ms backoff.
**Cache TTL:** 1 hour per endpoint (see Redis keys at bottom).

---

## Endpoints — Quick Reference

| Endpoint | Auth | OlympIQ uses? |
|----------|------|--------------|
| `GET /{username}/profile` | No | ✅ ranking, solved counts on connect + sync |
| `GET /{username}/solved` | No | ✅ easy/medium/hard counts for stat cards |
| `GET /{username}/contest` | No | ✅ contest rating displayed on Platform card |
| `GET /{username}/contest/history` | No | No (could be used for chart) |
| `GET /{username}/acSubmission` | No | ✅ solved list + heatmap data |
| `GET /{username}/submission` | No | No |
| `GET /{username}/skill` | No | ✅ topic breakdown + weak-area detection |
| `GET /{username}/calendar` | No | ✅ heatmap calendar |
| `GET /select` | No | No (future: problem pane for LC problems) |
| `GET /daily` | No | No |
| `GET /problems` | No | No |

---

## User Endpoints

### GET /{username}/profile
Full user profile in a single call. Use this for the initial connect validation and periodic sync.

**Path param:** `username` — LeetCode username (case-sensitive)

**Sample request:**
```
GET http://localhost:3002/kair97/profile
```

**Sample response:**
```json
{
  "username": "kair97",
  "name": "Oryn",
  "avatar": "https://assets.leetcode.com/users/avatars/...",
  "ranking": 128432,
  "reputation": 0,
  "gitHub": "",
  "twitter": "",
  "linkedIN": "",
  "website": [],
  "country": "Kazakhstan",
  "company": "",
  "school": "",
  "skillTags": ["Dynamic Programming", "Graphs"],
  "about": "",
  "totalSolved": 234,
  "totalSubmissions": [
    { "difficulty": "All",    "count": 650, "submissions": 650 },
    { "difficulty": "Easy",   "count": 80,  "submissions": 180 },
    { "difficulty": "Medium", "count": 120, "submissions": 380 },
    { "difficulty": "Hard",   "count": 34,  "submissions": 90  }
  ],
  "totalQuestions": 3000,
  "easySolved": 80,
  "totalEasy": 800,
  "mediumSolved": 120,
  "totalMedium": 1600,
  "hardSolved": 34,
  "totalHard": 600,
  "acceptanceRate": "62.5%",
  "contributionPoints": 10,
  "postViewCount": 0,
  "postViewCountDiff": 0,
  "solutionCount": 0,
  "solutionCountDiff": 0,
  "categoryDiscussCount": 0,
  "categoryDiscussCountDiff": 0
}
```

**Fields OlympIQ extracts:**
- `username` — validation that account exists
- `ranking` — displayed on Platform card
- `totalSolved`, `easySolved`, `mediumSolved`, `hardSolved` — stat counters
- `totalEasy`, `totalMedium`, `totalHard` — denominator for percentages
- `acceptanceRate`
- `contributionPoints`

**Error (404 — user not found):**
```json
{ "errors": [{ "message": "That user does not exist." }] }
```

---

### GET /{username}/solved
Solved problem counts by difficulty only. Lighter call than `/profile`.

**Sample request:**
```
GET http://localhost:3002/kair97/solved
```

**Sample response:**
```json
{
  "solvedProblem": 234,
  "easySolved": 80,
  "mediumSolved": 120,
  "hardSolved": 34,
  "totalSubmissionNum": [
    { "difficulty": "All",    "count": 234, "submissions": 650 },
    { "difficulty": "Easy",   "count": 80,  "submissions": 180 },
    { "difficulty": "Medium", "count": 120, "submissions": 380 },
    { "difficulty": "Hard",   "count": 34,  "submissions": 90  }
  ],
  "acSubmissionNum": [
    { "difficulty": "All",    "count": 234, "submissions": 234 },
    { "difficulty": "Easy",   "count": 80,  "submissions": 80  },
    { "difficulty": "Medium", "count": 120, "submissions": 120 },
    { "difficulty": "Hard",   "count": 34,  "submissions": 34  }
  ]
}
```

**Fields OlympIQ extracts:** `solvedProblem`, `easySolved`, `mediumSolved`, `hardSolved`

---

### GET /{username}/contest
Contest participation summary.

**Sample request:**
```
GET http://localhost:3002/kair97/contest
```

**Sample response:**
```json
{
  "contestAttend": 15,
  "contestRating": 1823.4,
  "contestGlobalRanking": 45000,
  "totalParticipants": 300000,
  "contestTopPercentage": 15.0,
  "contestBadges": null
}
```

**Fields OlympIQ extracts:** `contestAttend`, `contestRating`, `contestGlobalRanking`, `totalParticipants`, `contestTopPercentage`

**Note:** `contestRating` is a float. Round to int for display.

---

### GET /{username}/contest/history
Full list of all contests participated in, with per-contest performance.

**Sample request:**
```
GET http://localhost:3002/kair97/contest/history
```

**Sample response:**
```json
{
  "contestHistory": [
    {
      "attended": true,
      "trendDirection": "UP",
      "problemsSolved": 3,
      "totalProblems": 4,
      "finishTimeInSeconds": 4200,
      "rating": 1823.4,
      "ranking": 1200,
      "contest": {
        "title": "Weekly Contest 371",
        "startTime": 1700000000
      }
    }
  ]
}
```

**Not used by OlympIQ currently** — available for future rating history chart on LC side.

---

### GET /{username}/acSubmission
Last N accepted submissions. Primary source for solved-problem list and heatmap.

**Query params:**
| Param | Required | Description |
|-------|----------|-------------|
| `limit` | No | Number of submissions to return. Default: 20. OlympIQ uses 100. |

**Sample request:**
```
GET http://localhost:3002/kair97/acSubmission?limit=100
```

**Sample response:**
```json
{
  "count": 100,
  "submission": [
    {
      "title": "Two Sum",
      "titleSlug": "two-sum",
      "timestamp": "1700000000",
      "statusDisplay": "Accepted",
      "lang": "python3",
      "url": "/problems/two-sum/"
    },
    {
      "title": "Longest Substring Without Repeating Characters",
      "titleSlug": "longest-substring-without-repeating-characters",
      "timestamp": "1699900000",
      "statusDisplay": "Accepted",
      "lang": "cpp"
    }
  ]
}
```

**Fields OlympIQ extracts:**
- `submission[].title` — display name
- `submission[].titleSlug` — used to construct problem URL and as solved-list key
- `submission[].timestamp` — unix string; used for heatmap bucket

**Problem URL construction:**
```
https://leetcode.com/problems/{titleSlug}/
```

**Solved list key:** `titleSlug` (deduplicate — a problem is solved once regardless of how many accepted submissions).

**Heatmap bucket:** parse `timestamp` as unix int, floor to day boundary (`ts - ts%86400`), increment counter.

---

### GET /{username}/submission
Last N submissions of **any verdict** (not just accepted).

**Query params:**
| Param | Required | Description |
|-------|----------|-------------|
| `limit` | No | Number of submissions. Default: 20. Max: 20 per API limit. |

**Sample request:**
```
GET http://localhost:3002/kair97/submission?limit=20
```

**Sample response:**
```json
{
  "count": 20,
  "submission": [
    {
      "title": "Two Sum",
      "titleSlug": "two-sum",
      "timestamp": "1700000000",
      "statusDisplay": "Accepted",
      "lang": "python3"
    },
    {
      "title": "Two Sum",
      "titleSlug": "two-sum",
      "timestamp": "1699990000",
      "statusDisplay": "Wrong Answer",
      "lang": "python3"
    }
  ]
}
```

**Not used by OlympIQ** (we use `acSubmission` instead — only accepted matters).

---

### GET /{username}/skill
Topic skill breakdown by difficulty tier. Primary source for weak-area detection and roadmap AI prompt.

**Sample request:**
```
GET http://localhost:3002/kair97/skill
```

**Sample response:**
```json
{
  "data": {
    "advanced": [
      { "tagName": "Dynamic Programming", "tagSlug": "dynamic-programming", "problemsSolved": 45 },
      { "tagName": "Graph", "tagSlug": "graph",                             "problemsSolved": 20 },
      { "tagName": "Trie",  "tagSlug": "trie",                              "problemsSolved": 5  }
    ],
    "intermediate": [
      { "tagName": "Binary Search",     "tagSlug": "binary-search",     "problemsSolved": 30 },
      { "tagName": "Sliding Window",    "tagSlug": "sliding-window",    "problemsSolved": 18 },
      { "tagName": "Divide and Conquer","tagSlug": "divide-and-conquer","problemsSolved": 8  }
    ],
    "fundamental": [
      { "tagName": "Array",      "tagSlug": "array",      "problemsSolved": 80 },
      { "tagName": "String",     "tagSlug": "string",     "problemsSolved": 55 },
      { "tagName": "Hash Table", "tagSlug": "hash-table", "problemsSolved": 48 },
      { "tagName": "Two Pointers","tagSlug": "two-pointers","problemsSolved": 25 },
      { "tagName": "Stack",      "tagSlug": "stack",      "problemsSolved": 20 },
      { "tagName": "Sorting",    "tagSlug": "sorting",    "problemsSolved": 18 }
    ]
  }
}
```

**Fields OlympIQ extracts:**
- All three tiers: `advanced`, `intermediate`, `fundamental`
- Per item: `tagName`, `tagSlug`, `problemsSolved`

**Weak-area detection:** sort all tags by `problemsSolved` ascending → lowest N are the focus topics for AI roadmap.

**Topic bars on Dashboard:** render all three tiers, label each bar with `tagName`, width = `problemsSolved / max_in_tier`.

---

### GET /{username}/calendar
Submission activity calendar — used for the heatmap widget.

**Sample request:**
```
GET http://localhost:3002/kair97/calendar
```

**Sample response:**
```json
{
  "submissionCalendar": {
    "1700000000": 3,
    "1700086400": 1,
    "1700172800": 5,
    "1700345600": 2
  },
  "activeYears": [2023, 2024],
  "streak": 7,
  "totalActiveDays": 120
}
```

**Fields OlympIQ extracts:**
- `submissionCalendar` — map of `"unix_timestamp_string" → submission_count`; keys are day-level unix timestamps
- `streak` — displayed as streak counter in UI
- `totalActiveDays` — shown on Dashboard

**Heatmap rendering:** iterate `submissionCalendar`, convert each key to `Date`, colour cell by count bucket:
- 0 → `var(--bg-sunken)`
- 1–2 → `var(--accent-soft)`
- 3–5 → `oklch(0.72 0.16 305 / 0.40)`
- 6+ → `var(--accent)`

---

## Problem Endpoints

### GET /select
Returns full problem details for a single problem by its `titleSlug`.

**Query params:**
| Param | Required | Description |
|-------|----------|-------------|
| `titleSlug` | Yes | Problem slug from URL, e.g. `two-sum`, `longest-palindromic-substring` |

**Sample request:**
```
GET http://localhost:3002/select?titleSlug=two-sum
```

**Sample response:**
```json
{
  "questionId": "1",
  "questionFrontendId": "1",
  "title": "Two Sum",
  "titleSlug": "two-sum",
  "isPaidOnly": false,
  "difficulty": "Easy",
  "likes": 55000,
  "dislikes": 1800,
  "categoryTitle": "Algorithms",
  "content": "<p>Given an array of integers <code>nums</code> and an integer <code>target</code>...</p>",
  "topicTags": [
    { "name": "Array",      "slug": "array"      },
    { "name": "Hash Table", "slug": "hash-table" }
  ],
  "codeSnippets": [
    { "lang": "C++",    "langSlug": "cpp",    "code": "class Solution {\npublic:\n    ..." },
    { "lang": "Python3","langSlug": "python3","code": "class Solution:\n    ..." }
  ],
  "sampleTestCase": "nums = [2,7,11,15], target = 9",
  "exampleTestcases": "[2,7,11,15]\n9",
  "constraints": "<li>2 &lt;= nums.length &lt;= 10<sup>4</sup></li>",
  "hints": ["A really brute force way would be to search for all possible pairs..."],
  "status": null,
  "stats": "{\"totalAccepted\": \"12.3M\", \"totalSubmission\": \"22.1M\", \"totalAcceptedRaw\": 12345678, ...}",
  "metaData": "...",
  "similarQuestions": "[{\"title\": \"3Sum\", \"titleSlug\": \"3sum\", \"difficulty\": \"Medium\", \"isPaidOnly\": false}]"
}
```

**Fields of interest:**
- `title`, `titleSlug`, `difficulty`, `categoryTitle`
- `content` — HTML problem statement
- `topicTags[]` — `name`, `slug`
- `hints[]` — progressive hints
- `sampleTestCase`, `exampleTestcases`, `constraints`
- `similarQuestions` — JSON string, parse separately
- `isPaidOnly` — if `true`, problem requires LC Premium; do not link directly

**Not used by OlympIQ currently** — available for future Analyzer pane to populate the LC problem statement.

---

### GET /daily
Returns today's daily challenge problem.

**Sample request:**
```
GET http://localhost:3002/daily
```

**Sample response:**
```json
{
  "problemName": "Minimum Number of Operations to Make Array XOR Equal to K",
  "difficulty": "Medium",
  "link": "/problems/minimum-number-of-operations-to-make-array-xor-equal-to-k/",
  "date": "2026-05-30",
  "titleSlug": "minimum-number-of-operations-to-make-array-xor-equal-to-k",
  "questionId": "2997"
}
```

**Not used by OlympIQ currently** — could be surfaced as a "Daily Challenge" widget.

---

### GET /problems
Returns a filtered list of problems from the LeetCode archive.

**Query params:**
| Param | Required | Description |
|-------|----------|-------------|
| `limit` | No | Number of problems to return (default: 20) |
| `skip` | No | Offset for pagination (default: 0) |
| `difficulty` | No | `EASY`, `MEDIUM`, or `HARD` |
| `tags` | No | Pipe-separated tag slugs, e.g. `array\|dynamic-programming` |

**Sample requests:**
```
GET http://localhost:3002/problems?limit=20&difficulty=MEDIUM&tags=dynamic-programming
GET http://localhost:3002/problems?limit=50&skip=0&tags=array|two-pointers
GET http://localhost:3002/problems?limit=10&difficulty=HARD
```

**Sample response:**
```json
{
  "count": 1234,
  "problemsetQuestionList": [
    {
      "acRate": 62.5,
      "difficulty": "Medium",
      "freqBar": null,
      "questionFrontendId": "3",
      "isFavor": false,
      "isPaidOnly": false,
      "status": null,
      "title": "Longest Substring Without Repeating Characters",
      "titleSlug": "longest-substring-without-repeating-characters",
      "topicTags": [
        { "name": "Hash Table", "slug": "hash-table" },
        { "name": "String",     "slug": "string"     },
        { "name": "Sliding Window", "slug": "sliding-window" }
      ],
      "hasSolution": true,
      "hasVideoSolution": false
    }
  ]
}
```

**Fields of interest:**
- `count` — total matching problems
- `problemsetQuestionList[].title`, `titleSlug`, `difficulty`, `acRate`, `isPaidOnly`
- `topicTags[]` — for filtering/display
- `hasSolution` — whether editorial exists

**Not used by OlympIQ currently** — recommendation engine uses Claude to select problems; this could be used as a lookup/validation source.

---

## OlympIQ Sync Flow

Order of calls on `POST /accounts/sync` for a LeetCode handle:

```
1. GET /{handle}/profile         → ranking, totalSolved, easy/medium/hard counts
2. GET /{handle}/contest         → contestRating, contestAttend, contestTopPercentage
3. GET /{handle}/acSubmission?limit=100  → solved list (titleSlug keys) + heatmap timestamps
4. GET /{handle}/skill           → topic breakdown for weak-area AI input
5. GET /{handle}/calendar        → submissionCalendar for heatmap widget + streak
```

Steps run sequentially (not parallel) to respect upstream rate limits.

---

## OlympIQ — Redis Cache Keys for LC Responses

| Key pattern | TTL | Endpoint cached |
|-------------|-----|----------------|
| `lc:profile:{handle}` | 1h | `/{handle}/profile` |
| `lc:contest:{handle}` | 1h | `/{handle}/contest` |
| `lc:acsub:{handle}` | 1h | `/{handle}/acSubmission?limit=100` |
| `lc:skill:{handle}` | 1h | `/{handle}/skill` |
| `lc:calendar:{handle}` | 1h | `/{handle}/calendar` |

Cache invalidated on `DELETE /accounts/leetcode` (platform disconnect).

---

## Topic Tag Slugs Reference

Common tags used in `/skill` and `/problems` filtering:

**Fundamental:**
`array` · `string` · `hash-table` · `math` · `sorting` · `two-pointers`
`bit-manipulation` · `recursion` · `stack` · `queue`

**Intermediate:**
`binary-search` · `sliding-window` · `prefix-sum` · `linked-list`
`tree` · `binary-tree` · `heap-priority-queue` · `divide-and-conquer`
`greedy` · `backtracking` · `depth-first-search` · `breadth-first-search`

**Advanced:**
`dynamic-programming` · `graph` · `trie` · `segment-tree` · `binary-indexed-tree`
`union-find` · `topological-sort` · `shortest-path` · `minimum-spanning-tree`
`monotonic-stack` · `monotonic-queue` · `number-theory` · `game-theory`

---

## Problem URL Construction

```
https://leetcode.com/problems/{titleSlug}/
```

Examples:
```
https://leetcode.com/problems/two-sum/
https://leetcode.com/problems/longest-palindromic-substring/
https://leetcode.com/problems/trapping-rain-water/
```

---

## Docker Compose Service

```yaml
leetcode-api:
  image: alfaarghya/alfa-leetcode-api:2.0.4
  ports:
    - "3002:3000"
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:3000/daily"]
    interval: 30s
    timeout: 10s
    retries: 3
```

OlympIQ backend calls `http://leetcode-api:3000` (internal Docker DNS). Port 3002 is for host-machine Postman testing only.

---

## Postman Collection Seed

Replace `USERNAME` with a real LeetCode handle (e.g. `uwi`, `tourist`, or your own):

```
GET http://localhost:3002/USERNAME/profile
GET http://localhost:3002/USERNAME/solved
GET http://localhost:3002/USERNAME/contest
GET http://localhost:3002/USERNAME/contest/history
GET http://localhost:3002/USERNAME/acSubmission?limit=20
GET http://localhost:3002/USERNAME/submission?limit=20
GET http://localhost:3002/USERNAME/skill
GET http://localhost:3002/USERNAME/calendar
GET http://localhost:3002/select?titleSlug=two-sum
GET http://localhost:3002/daily
GET http://localhost:3002/problems?limit=10&difficulty=MEDIUM&tags=dynamic-programming
```
