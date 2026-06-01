---
title: Codeforces API Reference
type: reference
last_updated: 2026-05-30
updated: 2026-05-30 (added full Postman auth guide with pre-request script)
---

# Codeforces API Reference

Base URL: `https://codeforces.com/api/{methodName}`

**Rate limit:** max 1 request per 2 seconds. Exceeding returns `{ "status": "FAILED", "comment": "Call limit exceeded" }`.

**Response envelope (every method):**
```json
{ "status": "OK",     "result": <method-dependent> }
{ "status": "FAILED", "comment": "reason string"   }
```

**Language param:** add `?lang=en` or `?lang=ru` to any request.

---

## Auth — Full Guide (Postman + Pre-request Script)

### What auth gives you
Without auth: public data only (all methods except `user.friends` and `group.isManager`).
With auth: private data — your own friends list, group management checks, and any future private endpoints.

### Step 1 — Generate your API key
Go to: `https://codeforces.com/settings/api`
Click "Add API key". You receive:
- `key` — public identifier (e.g. `a1b2c3d4e5f6...`)
- `secret` — private signing secret (e.g. `9z8y7x6w5v4u...`) — **never share this**

### Step 2 — Understand the signature scheme

Every authenticated request needs three extra query params — **NOT headers**:

| Param | What it is |
|-------|-----------|
| `apiKey` | Your `key` value |
| `time` | Current unix timestamp in **seconds** (e.g. `1748620000`) |
| `apiSig` | `{rand}` + SHA512hex of a specific string (see below) |

#### How `apiSig` is built

1. Pick `rand` — any 6-character string. Use a random one per request. Example: `"a3f9k2"`
2. Collect **all** query params (including `apiKey` and `time`, **excluding** `apiSig` itself)
3. Sort them **lexicographically** by key name (then by value if keys tie)
4. Build the input string:
   ```
   {rand}/{methodName}?{param1}={val1}&{param2}={val2}&...#{secret}
   ```
5. SHA512 hex-hash that string
6. `apiSig` = `{rand}` + `{sha512_hex_result}`

#### Concrete example

- `key` = `xxx`, `secret` = `yyy`, `rand` = `123456`
- Method: `user.friends`, no extra params
- Sorted params: `apiKey=xxx`, `time=1748620000`
- Hash input: `123456/user.friends?apiKey=xxx&time=1748620000#yyy`
- `apiSig` = `123456` + SHA512hex(`123456/user.friends?apiKey=xxx&time=1748620000#yyy`)

#### Important rules
- `time` must be within **5 minutes** of CF server time or the request is rejected
- `rand` should be **different every request** (prevents replay attacks)
- Param sort is **lexicographic by key** — `apiKey` before `handle` before `time`
- All param values must be their **raw string values** when building the hash input (no URL-encoding inside the hash string)

---

### Step 3 — Postman setup

#### Where do the params go?
**Query params (Params tab) — NOT Headers, NOT Body.**

Codeforces API is a plain GET API. Auth params are just extra URL query parameters. Never put them in headers.

#### Raw vs Encoded in Postman
- Use the **Params tab** — Postman URL-encodes values automatically when it sends the request.
- Inside your pre-request script, work with **raw (unencoded)** values — Postman handles encoding.
- Do NOT manually percent-encode values in the script; Postman double-encodes if you do.

---

### Step 4 — Postman Pre-request Script (auto-generates signature)

Set up two **Postman Environment Variables** first:
| Variable | Value |
|----------|-------|
| `CF_API_KEY` | your `key` |
| `CF_API_SECRET` | your `secret` |

Then paste this into the **Pre-request Script** tab of your request (or a Collection-level pre-request script to apply to all CF auth requests):

```javascript
// ── Codeforces API Auth — Pre-request Script ──────────────────────────
const apiKey    = pm.environment.get('CF_API_KEY');
const secret    = pm.environment.get('CF_API_SECRET');

// 6-char random prefix
const rand = Math.random().toString(36).substring(2, 8).padStart(6, '0').substring(0, 6);

// Current unix timestamp in seconds
const time = Math.floor(Date.now() / 1000).toString();

// Extract method name from URL  e.g. "user.friends"
const rawUrl    = pm.request.url.toString().split('?')[0];
const methodName = rawUrl.match(/\/api\/([^/?]+)/)?.[1] ?? '';

// Collect all existing query params, add apiKey + time
const paramMap = {};
pm.request.url.query.each(p => {
    if (p.key && p.key !== 'apiSig' && p.key !== 'apiKey' && p.key !== 'time') {
        paramMap[p.key] = p.value ?? '';
    }
});
paramMap['apiKey'] = apiKey;
paramMap['time']   = time;

// Sort lexicographically by key
const sortedKeys  = Object.keys(paramMap).sort();
const paramString = sortedKeys.map(k => `${k}=${paramMap[k]}`).join('&');

// Build hash input and sign
const hashInput = `${rand}/${methodName}?${paramString}#${secret}`;
const hash      = CryptoJS.SHA512(hashInput).toString(CryptoJS.enc.Hex);
const apiSig    = rand + hash;

// Inject params into the request
pm.request.url.addQueryParams([
    { key: 'apiKey', value: apiKey },
    { key: 'time',   value: time   },
    { key: 'apiSig', value: apiSig },
]);

console.log('CF Auth — method:', methodName);
console.log('CF Auth — hash input:', hashInput);
console.log('CF Auth — apiSig:', apiSig.substring(0, 20) + '...');
// ─────────────────────────────────────────────────────────────────────
```

**CryptoJS is built into Postman's sandbox** — no install needed.

---

### Step 5 — Testing `user.friends`

1. Create a new GET request in Postman
2. URL: `https://codeforces.com/api/user.friends`
3. Params tab — add one param: `onlyOnline = false` (or `true` for online-only)
4. Pre-request Script tab — paste the script above
5. Make sure your environment has `CF_API_KEY` and `CF_API_SECRET` set
6. Hit **Send**

**Expected success response:**
```json
{
  "status": "OK",
  "result": [
    "tourist",
    "Petr",
    "Um_nik"
  ]
}
```
Returns an array of handle strings — the friends of the authenticated account (`kair97`).

**Expected error (wrong key or expired time):**
```json
{
  "status": "FAILED",
  "comment": "apiSig: Signature has expired"
}
```
```json
{
  "status": "FAILED",
  "comment": "apiKey: Key not found"
}
```

---

### Postman Collection structure (recommended)

```
📁 Codeforces API
  📁 Public (no auth)
    GET user.info
    GET user.rating
    GET user.status
    GET contest.standings
    GET problemset.problems
  📁 Authenticated
    ⚙️  Collection Pre-request Script ← paste the script here once
    GET user.friends
    GET group.isManager
```

Put the pre-request script at the **Collection level** under the "Authenticated" folder so all requests in that folder automatically get signed.

---

## Methods — Quick Reference

| Method                    | Auth required | OlympIQ uses?                                |
| ------------------------- | ------------- | -------------------------------------------- |
| `user.info`               | No            | ✅ handle validation + rating/rank on connect |
| `user.rating`             | No            | ✅ contest history + rating chart             |
| `user.status`             | No            | ✅ solved-problem list + tag frequency map    |
| `user.ratedList`          | No            | No                                           |
| `user.blogEntries`        | No            | No                                           |
| `user.friends`            | Yes           | No                                           |
| `contest.list`            | No            | No                                           |
| `contest.standings`       | No            | No                                           |
| `contest.status`          | No            | No                                           |
| `contest.ratingChanges`   | No            | No                                           |
| `contest.hacks`           | No            | No                                           |
| `problemset.problems`     | No            | No                                           |
| `problemset.recentStatus` | No            | No                                           |
| `blogEntry.view`          | No            | No                                           |
| `blogEntry.comments`      | No            | No                                           |
| `recentActions`           | No            | No                                           |
| `system.status`           | No            | No                                           |
| `group.isManager`         | Yes           | No                                           |

---

## Methods — Full Detail

### user.info
Returns info for one or more users.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `handles` | Yes | Semicolon-separated handles, up to 10 000 |
| `checkHistoricHandles` | No | Boolean, default `true`. Uses handle change history to find user. |

**Returns:** array of `User` objects in same order as requested.

**Sample request:**
```
GET https://codeforces.com/api/user.info?handles=kair97
GET https://codeforces.com/api/user.info?handles=DmitriyH;Fefer_Ivan&checkHistoricHandles=false
```

**Sample response:**
```json
{
  "status": "OK",
  "result": [
    {
      "handle": "kair97",
      "rating": 1432,
      "rank": "specialist",
      "maxRating": 1542,
      "maxRank": "specialist",
      "contribution": 0,
      "lastOnlineTimeSeconds": 1748612517,
      "registrationTimeSeconds": 1609459200,
      "friendOfCount": 3,
      "avatar": "https://userpic.codeforces.org/...",
      "titlePhoto": "https://userpic.codeforces.org/..."
    }
  ]
}
```

**Fields OlympIQ extracts:** `handle`, `rating`, `rank`, `maxRating`, `maxRank`, `contribution`, `lastOnlineTimeSeconds`, `registrationTimeSeconds`, `avatar`

**Error case (bad handle):**
```json
{ "status": "FAILED", "comment": "handles: User with handle kair_INVALID not found" }
```

---

### user.rating
Returns full rating change history for a user.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `handle` | Yes | Codeforces handle |

**Returns:** array of `RatingChange` objects, chronological order.

**Sample request:**
```
GET https://codeforces.com/api/user.rating?handle=kair97
```

**Sample response:**
```json
{
  "status": "OK",
  "result": [
    {
      "contestId": 1900,
      "contestName": "Codeforces Round 910 (Div. 2)",
      "handle": "kair97",
      "rank": 2134,
      "ratingUpdateTimeSeconds": 1700000000,
      "oldRating": 1350,
      "newRating": 1432
    }
  ]
}
```

**Fields OlympIQ extracts:** `contestId`, `contestName`, `rank`, `ratingUpdateTimeSeconds`, `oldRating`, `newRating`

**Used for:** rating history chart on Dashboard; recent trajectory fed into AI roadmap prompt (last 5 contests).

---

### user.status
Returns submissions for a user, sorted by descending submission id.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `handle` | Yes | Codeforces handle |
| `from` | No | 1-based index of first submission to return |
| `count` | No | Number of submissions to return |
| `includeSources` | No | Boolean. Include source code. Only works on own account. |

**Returns:** array of `Submission` objects.

**Sample request:**
```
GET https://codeforces.com/api/user.status?handle=kair97&from=1&count=500
```

**Sample response (single item):**
```json
{
  "status": "OK",
  "result": [
    {
      "id": 245900000,
      "contestId": 1900,
      "creationTimeSeconds": 1700010000,
      "relativeTimeSeconds": 3600,
      "problem": {
        "contestId": 1900,
        "index": "C",
        "name": "Array Game",
        "type": "PROGRAMMING",
        "rating": 1400,
        "tags": ["dp", "greedy", "implementation"]
      },
      "author": {
        "contestId": 1900,
        "members": [{ "handle": "kair97" }],
        "participantType": "CONTESTANT",
        "ghost": false,
        "room": 42,
        "startTimeSeconds": 1700006400
      },
      "programmingLanguage": "GNU G++17 7.3.0",
      "verdict": "OK",
      "testset": "TESTS",
      "passedTestCount": 45,
      "timeConsumedMillis": 62,
      "memoryConsumedBytes": 4096000
    }
  ]
}
```

**Fields OlympIQ extracts:**
- `id`, `creationTimeSeconds`
- `problem.contestId`, `problem.index`, `problem.name`, `problem.rating`, `problem.tags`
- `verdict` — only `"OK"` counts as solved

**Solved deduplication:** key = `"{contestId}/{index}"`. A problem is solved once regardless of attempt count.

**Problem URL construction:**
```
https://codeforces.com/contest/{problem.contestId}/problem/{problem.index}
```

**Tag frequency map (for AI):** iterate all `verdict == "OK"` submissions → count each tag → `{ "dp": 34, "greedy": 22, ... }`

---

### user.ratedList
Returns all users who participated in at least one rated contest.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `activeOnly` | No | Boolean. Only users active in last month. |
| `includeRetired` | No | Boolean. If true, return all historical rated users. |
| `contestId` | No | Filter by contest. |

**Returns:** array of `User` objects sorted by rating descending.

**Sample request:**
```
GET https://codeforces.com/api/user.ratedList?activeOnly=true&includeRetired=false
```

> **Note:** Returns tens of thousands of records. Do not call frequently. Not used by OlympIQ.

---

### user.blogEntries
Returns blog entries by a user.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `handle` | Yes | Codeforces handle |

**Returns:** array of `BlogEntry` objects (brief form, no `content` field).

**Sample request:**
```
GET https://codeforces.com/api/user.blogEntries?handle=Fefer_Ivan
```

---

### user.friends
Returns friend handles of the authenticated user. **Requires API key auth.**

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `onlyOnline` | No | Boolean. Only friends currently online. |

**Sample request:**
```
GET https://codeforces.com/api/user.friends?onlyOnline=true&apiKey=xxx&time=…&apiSig=…
```

---

### contest.list
Returns all available contests.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `gym` | No | Boolean. If true, return gym contests instead of regular. |
| `groupCode` | No | Filter by group. Requires group read access. |

**Returns:** array of `Contest` objects. If authenticated, includes mashups and private gyms.

**Sample request:**
```
GET https://codeforces.com/api/contest.list?gym=false
```

---

### contest.ratingChanges
Returns rating changes after a contest.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `contestId` | Yes | Contest ID (visible in URL, e.g. `/contest/566/status`) |

**Returns:** array of `RatingChange` objects.

**Sample request:**
```
GET https://codeforces.com/api/contest.ratingChanges?contestId=566
```

---

### contest.standings
Returns contest description + standings table.

**Public (anonymous) mode:** only `contestId` param allowed. Returns full official standings.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `contestId` | Yes | Contest ID |
| `asManager` | No | Boolean. Manager-level data. Requires manager rights. |
| `from` | No | 1-based index of first standings row |
| `count` | No | Number of rows to return |
| `handles` | No | Semicolon-separated handles to filter (up to 10 000) |
| `room` | No | Filter to specific room |
| `showUnofficial` | No | Boolean. Include virtual + out-of-competition participants. |
| `participantTypes` | No | Comma-separated: `CONTESTANT`, `PRACTICE`, `VIRTUAL`, `MANAGER`, `OUT_OF_COMPETITION` |

**Returns:** `{ "contest": Contest, "problems": [Problem], "rows": [RanklistRow] }`

**Sample request:**
```
GET https://codeforces.com/api/contest.standings?contestId=566
GET https://codeforces.com/api/contest.standings?contestId=566&handles=tourist;Petr&showUnofficial=true
```

---

### contest.status
Returns submissions for a contest. Optionally filtered to one user.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `contestId` | Yes | Contest ID |
| `asManager` | No | Boolean. Manager-level data. |
| `handle` | No | Filter to one user's submissions |
| `from` | No | 1-based index of first submission |
| `count` | No | Number of submissions |
| `includeSources` | No | Boolean. Source code. Only with `asManager` and manager rights. |

**Returns:** array of `Submission` objects sorted by descending id.

**Sample request:**
```
GET https://codeforces.com/api/contest.status?contestId=566&from=1&count=10
GET https://codeforces.com/api/contest.status?contestId=566&handle=tourist&from=1&count=50
```

---

### contest.hacks
Returns hacks in a contest. Full list available some time after contest ends. During contest, only own hacks are visible.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `contestId` | Yes | Contest ID |
| `asManager` | No | Boolean. Manager-level data. |

**Returns:** array of `Hack` objects.

**Sample request:**
```
GET https://codeforces.com/api/contest.hacks?contestId=566
```

---

### problemset.problems
Returns all problems from the archive. Filterable by tags.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `tags` | No | Semicolon-separated tag list |
| `problemsetName` | No | Short name of additional archive (e.g. `acmsguru`) |

**Returns:** `{ "problems": [Problem], "problemStatistics": [ProblemStatistics] }`

**Sample request:**
```
GET https://codeforces.com/api/problemset.problems?tags=dp
GET https://codeforces.com/api/problemset.problems?tags=dp;greedy
GET https://codeforces.com/api/problemset.problems?tags=implementation
```

---

### problemset.recentStatus
Returns recent submissions across the entire problemset.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `count` | Yes | Number of submissions (max 1000) |
| `problemsetName` | No | Archive short name |

**Returns:** array of `Submission` objects sorted by descending id.

**Sample request:**
```
GET https://codeforces.com/api/problemset.recentStatus?count=10
```

---

### blogEntry.view
Returns a full blog entry.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `blogEntryId` | Yes | ID visible in the blog URL, e.g. `/blog/entry/79` |

**Returns:** `BlogEntry` in full form (includes `content` field).

**Sample request:**
```
GET https://codeforces.com/api/blogEntry.view?blogEntryId=79
```

---

### blogEntry.comments
Returns comments on a blog entry.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `blogEntryId` | Yes | Blog entry ID |

**Returns:** array of `Comment` objects.

**Sample request:**
```
GET https://codeforces.com/api/blogEntry.comments?blogEntryId=79
```

---

### recentActions
Returns the live feed.

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `maxCount` | Yes | Max actions to return (max 100) |

**Returns:** array of `RecentAction` objects.

**Sample request:**
```
GET https://codeforces.com/api/recentActions?maxCount=30
```

---

### system.status
Health check for CF infrastructure. Returns status of internal services and throughput metrics for the last 5 minutes.

**Params:** none

**Sample request:**
```
GET https://codeforces.com/api/system.status
```

---

### group.isManager
Returns whether given users are managers of a group. **Requires API key auth.**

**Params:**
| Param | Required | Description |
|-------|----------|-------------|
| `groupCode` | Yes | Group code (visible in group URL) |
| `handles` | Yes | Semicolon-separated handles (up to 10 000) |

**Returns:** map of `handle → boolean`.

**Sample request:**
```
GET https://codeforces.com/api/group.isManager?groupCode=JMRDZdAtYr&handles=MikeMirzayanov;tourist&apiKey=xxx&time=…&apiSig=…
```

---

## Return Objects — Field Reference

### User
| Field | Type | Notes |
|-------|------|-------|
| `handle` | string | |
| `email` | string | Only if user consented to show contact info |
| `vkId` | string | Only if user consented |
| `openId` | string | Only if user consented |
| `firstName` | string | Localized. May be absent. |
| `lastName` | string | Localized. May be absent. |
| `country` | string | Localized. May be absent. |
| `city` | string | Localized. May be absent. |
| `organization` | string | Localized. May be absent. |
| `contribution` | int | |
| `rank` | string | Localized (e.g. "specialist") |
| `rating` | int | |
| `maxRank` | string | Localized |
| `maxRating` | int | |
| `lastOnlineTimeSeconds` | int | Unix timestamp |
| `registrationTimeSeconds` | int | Unix timestamp |
| `friendOfCount` | int | |
| `avatar` | string | URL |
| `titlePhoto` | string | URL |

### RatingChange
| Field | Type | Notes |
|-------|------|-------|
| `contestId` | int | |
| `contestName` | string | Localized |
| `handle` | string | |
| `rank` | int | Place at time of rating update; not retroactively corrected |
| `ratingUpdateTimeSeconds` | int | Unix timestamp |
| `oldRating` | int | |
| `newRating` | int | |

### Submission
| Field | Type | Notes |
|-------|------|-------|
| `id` | int | |
| `contestId` | int | May be absent (practice problems) |
| `creationTimeSeconds` | int | Unix timestamp |
| `relativeTimeSeconds` | int | Seconds since contest start |
| `problem` | Problem | |
| `author` | Party | |
| `programmingLanguage` | string | |
| `verdict` | enum | `OK`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED`, `RUNTIME_ERROR`, `COMPILATION_ERROR`, `FAILED`, `PARTIAL`, `CHALLENGED`, `SKIPPED`, `TESTING`, `REJECTED`, `SUBMITTED`, `SECURITY_VIOLATED`, `CRASHED`, `INPUT_PREPARATION_CRASHED`, `IDLENESS_LIMIT_EXCEEDED`. May be absent. |
| `testset` | enum | `SAMPLES`, `PRETESTS`, `TESTS`, `CHALLENGES`, `TESTS1`…`TESTS10` |
| `passedTestCount` | int | |
| `timeConsumedMillis` | int | |
| `memoryConsumedBytes` | int | |
| `points` | float | May be absent. For IOI-style contests. |

### Problem
| Field | Type | Notes |
|-------|------|-------|
| `contestId` | int | May be absent |
| `problemsetName` | string | May be absent |
| `index` | string | e.g. `"A"`, `"C1"` |
| `name` | string | Localized |
| `type` | enum | `PROGRAMMING`, `QUESTION` |
| `points` | float | May be absent |
| `rating` | int | May be absent. Difficulty 800–3500. |
| `tags` | []string | e.g. `["dp", "greedy", "binary search"]` |

### ProblemStatistics
| Field | Type | Notes |
|-------|------|-------|
| `contestId` | int | May be absent |
| `index` | string | |
| `solvedCount` | int | |

### Contest
| Field | Type | Notes |
|-------|------|-------|
| `id` | int | |
| `name` | string | Localized |
| `type` | enum | `CF`, `IOI`, `ICPC` |
| `phase` | enum | `BEFORE`, `CODING`, `PENDING_SYSTEM_TEST`, `SYSTEM_TEST`, `FINISHED` |
| `frozen` | bool | |
| `durationSeconds` | int | |
| `freezeDurationSeconds` | int | May be absent |
| `startTimeSeconds` | int | May be absent |
| `relativeTimeSeconds` | int | May be absent. Negative = not started. |
| `preparedBy` | string | May be absent |
| `websiteUrl` | string | May be absent |
| `description` | string | Localized. May be absent. |
| `difficulty` | int | May be absent. 1–5. |
| `kind` | string | Localized. May be absent. (official ICPC, school championship, etc.) |
| `icpcRegion` | string | Localized. May be absent. |
| `country` | string | Localized. May be absent. |
| `city` | string | Localized. May be absent. |
| `season` | string | May be absent. |

### Party
| Field | Type | Notes |
|-------|------|-------|
| `contestId` | int | May be absent |
| `members` | []Member | |
| `participantType` | enum | `CONTESTANT`, `PRACTICE`, `VIRTUAL`, `MANAGER`, `OUT_OF_COMPETITION` |
| `teamId` | int | May be absent |
| `teamName` | string | Localized. May be absent. |
| `ghost` | bool | True = participated outside CF |
| `room` | int | May be absent |
| `startTimeSeconds` | int | May be absent |

### Member
| Field | Type | Notes |
|-------|------|-------|
| `handle` | string | |
| `name` | string | May be absent |

### RanklistRow
| Field | Type | Notes |
|-------|------|-------|
| `party` | Party | |
| `rank` | int | |
| `points` | float | |
| `penalty` | int | ICPC-style penalty |
| `successfulHackCount` | int | |
| `unsuccessfulHackCount` | int | |
| `problemResults` | []ProblemResult | Ordered same as `problems` in standings response |
| `lastSubmissionTimeSeconds` | int | IOI only. May be absent. |

### ProblemResult
| Field | Type | Notes |
|-------|------|-------|
| `points` | float | |
| `penalty` | int | May be absent |
| `rejectedAttemptCount` | int | |
| `type` | enum | `PRELIMINARY` (score can still decrease), `FINAL` |
| `bestSubmissionTimeSeconds` | int | May be absent |

### Hack
| Field | Type | Notes |
|-------|------|-------|
| `id` | int | |
| `creationTimeSeconds` | int | |
| `hacker` | Party | |
| `defender` | Party | |
| `verdict` | enum | `HACK_SUCCESSFUL`, `HACK_UNSUCCESSFUL`, `INVALID_INPUT`, `GENERATOR_INCOMPILABLE`, `GENERATOR_CRASHED`, `IGNORED`, `TESTING`, `OTHER`. May be absent. |
| `problem` | Problem | |
| `test` | string | May be absent |
| `judgeProtocol` | object | May be absent. Fields: `manual` (bool string), `protocol` (string), `verdict` (string). Localized. |

### BlogEntry
| Field | Type | Notes |
|-------|------|-------|
| `id` | int | |
| `originalLocale` | string | |
| `creationTimeSeconds` | int | |
| `authorHandle` | string | |
| `title` | string | Localized |
| `content` | string | Localized. **Absent in brief form.** |
| `locale` | string | |
| `modificationTimeSeconds` | int | |
| `allowViewHistory` | bool | |
| `tags` | []string | |
| `rating` | int | |

### Comment
| Field | Type | Notes |
|-------|------|-------|
| `id` | int | |
| `creationTimeSeconds` | int | |
| `commentatorHandle` | string | |
| `locale` | string | |
| `text` | string | |
| `parentCommentId` | int | May be absent |
| `rating` | int | |

### RecentAction
| Field | Type | Notes |
|-------|------|-------|
| `timeSeconds` | int | |
| `blogEntry` | BlogEntry | Brief form. May be absent. |
| `comment` | Comment | May be absent. |

---

## OlympIQ — Redis Cache Keys for CF Responses

| Key pattern | TTL | Content |
|-------------|-----|---------|
| `cf:info:{handle}` | 1h | `user.info` response |
| `cf:rating:{handle}` | 1h | `user.rating` response |
| `cf:status:{handle}` | 1h | `user.status` response (from=1, count=500) |

---

## Common Tags (from CF submissions — used for topic mapping)

`dp` · `greedy` · `graphs` · `math` · `binary search` · `two pointers` · `data structures`
`implementation` · `sortings` · `dfs and similar` · `trees` · `strings` · `brute force`
`constructive algorithms` · `number theory` · `combinatorics` · `geometry` · `bitmasks`
`flows` · `games` · `matrices` · `shortest paths` · `divide and conquer`

---

## Related notes

[[04 - Backend]] · [[LeetCode alfa-leetcode-api Reference]] · [[03 - Architecture]] · [[02-Backend-Deep]] · [[07-Testing-Guide]] · [[06-Errors-Bible]]
