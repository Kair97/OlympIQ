---
title: n8n Agents
type: brain
last_updated: 2026-05-31
---

# n8n Agents

---

## Overview

OlympIQ uses two n8n Cloud webhook agents as AI orchestrators. When both `N8N_ANALYZER_URL` and `N8N_ROADMAP_URL` are set in `.env`, all AI calls route through n8n instead of calling Gemini directly.

n8n host: `kair97.app.n8n.cloud`

---

## Analyzer Webhook

**URL:** `https://kair97.app.n8n.cloud/webhook/olympiq-problem-analysis`

**Trigger:** HTTP webhook (POST)

**Input format:**
```json
{
  "problem_url": "https://codeforces.com/contest/1842/problem/B"
}
```

**Output format (razbor JSON schema):**
```json
{
  "problem_title": "string",
  "platform": "codeforces|leetcode|other",
  "problem_url": "string",
  "classification": {
    "type": "Dynamic Programming",
    "subtype": "Knapsack",
    "difficulty_label": "1800",
    "confidence": 0.92
  },
  "key_observations": ["string", "string"],
  "algorithm_approach": {
    "summary": "2-3 sentence description",
    "hints": [
      {"level": 1, "text": "gentle nudge"},
      {"level": 2, "text": "points toward technique"},
      {"level": 3, "text": "describes approach"}
    ]
  },
  "solution_steps": ["step 1 conceptual", "step 2..."],
  "complexity": {
    "time": "O(n log n)",
    "space": "O(n)",
    "note": "explanation"
  },
  "common_mistakes": ["mistake 1", "mistake 2"],
  "similar_problems": [
    {
      "title": "string",
      "platform": "codeforces|leetcode",
      "url": "full URL",
      "rating": 1900,
      "tags": ["dp"],
      "similarity_reason": "why this is good follow-up"
    }
  ]
}
```

---

## Roadmap Webhook

**URL:** `https://kair97.app.n8n.cloud/webhook/coding-roadmap`

**Trigger:** HTTP webhook (POST)

**Input format (sent by `callN8NRoadmap`):**
```json
{
  "username": "cf_or_lc_handle",
  "mode": "weekly|topic|interview",
  "weekly_hours": 15,
  "codeforces": {
    "rating": 1400,
    "rank": "specialist",
    "problems_solved": 245,
    "topics": {"dp": 45, "greedy": 30, "graphs": 12},
    "rating_history": [1200, 1300, 1350, 1400, 1500]
  },
  "leetcode": {
    "total_solved": 120,
    "easy": 60,
    "medium": 50,
    "hard": 10,
    "topics": {"Array": 45, "Dynamic Programming": 20}
  },
  "goal": "rating",
  "deadline": "2026-12-31",
  "target_rating": 2000
}
```
Fields `codeforces`, `leetcode`, `goal`, `deadline`, `target_rating` are omitted if not available.

**Output format (3-mode JSON schemas):**

**Weekly mode:**
```json
{
  "mode": "weekly",
  "generated_at": "2026-05-31T10:00:00Z",
  "goal_summary": "one sentence plan goal",
  "weeks": [
    {
      "week": 1,
      "theme": "string",
      "focus_topics": ["dp", "greedy"],
      "problems": [
        {
          "title": "string",
          "platform": "codeforces|leetcode",
          "url": "full URL",
          "rating": 1600,
          "difficulty": null,
          "tags": ["dp"],
          "reason": "personalized reason"
        }
      ]
    }
  ]
}
```

**Topic mode:**
```json
{
  "mode": "topic",
  "generated_at": "ISO8601",
  "topics": [
    {
      "name": "Dynamic Programming",
      "why": "you have 45 solved but all below 1600",
      "strength_score": 0.65,
      "problems": [/* same problem schema */]
    }
  ]
}
```

**Interview mode:**
```json
{
  "mode": "interview",
  "generated_at": "ISO8601",
  "target_companies": ["Google", "Meta"],
  "patterns": [
    {
      "name": "Two Pointers",
      "frequency": 0.82,
      "problems": [/* same problem schema */]
    }
  ]
}
```

---

## How Backend Calls n8n

### callN8NAnalyzer (`ai_service.go`)
```go
body, _ := json.Marshal(map[string]string{"problem_url": sanitize(problemURL)})
req, _ := http.NewRequestWithContext(ctx, "POST", s.n8nAnalyzerURL, bytes.NewReader(body))
req.Header.Set("Content-Type", "application/json")
resp, _ := s.http.Do(req)
// s.http has Timeout: 90 * time.Second
```

### callN8NRoadmap (`ai_service.go`)
Builds a comprehensive payload from `StudentContext` (see Brain/02-Backend-Deep.md).

**Both functions:**
1. Send POST with JSON body
2. Read response body (limit 8MB for analyzer, 16MB for roadmap)
3. Check status code (non-200 → return ErrExternal)
4. Call `stripMarkdownFences` on response string
5. If starts with `[`, try to unwrap n8n envelope

---

## How the n8n Envelope `[{"output":"..."}]` is Unwrapped

n8n in "When Last Node Finishes" mode returns an array with the last node's output. The backend tries these key names in order: `output`, `json`, `text`, `result`, `analysis`.

```go
if strings.HasPrefix(cleaned, "[") {
    var envelope []map[string]json.RawMessage
    if json.Unmarshal([]byte(cleaned), &envelope) == nil && len(envelope) > 0 {
        for _, key := range []string{"output", "json", "text", "result", "analysis"} {
            if raw, ok := envelope[0][key]; ok {
                inner := strings.TrimSpace(string(raw))
                if strings.HasPrefix(inner, `"`) {
                    // raw is a JSON string: unmarshal to get the unquoted value
                    var s string
                    if json.Unmarshal(raw, &s) == nil {
                        cleaned = stripMarkdownFences(s)
                        break
                    }
                } else {
                    // raw is a JSON object directly
                    cleaned = inner
                    break
                }
            }
        }
    }
}
```

This handles both:
- `[{"output": "{\"problem_title\":...}"}]` (string value — double-encoded JSON)
- `[{"output": {"problem_title":...}}]` (object value — direct JSON)

---

## n8n Setup Rules

### Webhook Mode — CRITICAL

**Must use:** "When Last Node Finishes" (response mode in n8n webhook settings)

**Must NOT use:** "Using Respond to Webhook Node"

**Why:** AI processing (Gemini or GPT) takes 15-30 seconds. "Respond to Webhook" times out at ~10 seconds and returns an empty/null response. "When Last Node Finishes" waits the full 90 seconds (matching backend timeout).

### Max Tokens — CRITICAL

Set `maxOutputTokens` to `8192` in the Gemini node (or `max_tokens: 4096` for OpenAI).

Default is 1024 or 2048. The roadmap JSON for a full weekly plan can easily exceed 2000 tokens. Truncated JSON breaks `json.Unmarshal` with syntax error.

### Model Names

| Provider | Correct model name | Wrong model name |
|----------|--------------------|-----------------|
| OpenAI | `gpt-4o-mini` | `gpt-5-mini` (does not exist) |
| Gemini | `gemini-2.5-flash` | any typo |

If wrong model name → n8n returns 524 timeout or model-not-found error.

### Response Format

The last node in the n8n workflow should output an object with an `output` key containing the JSON string:
```json
{"output": "{...razbor json...}"}
```
Or the AI node can output the JSON directly as an object (no string wrapping). The backend handles both.

---

## n8n System Prompt for Analyzer Agent

See `n8n-agent-prompt.txt` in repo root. Key rules:
- Never write complete working code
- 3-level progressive hint ladder
- Return ONLY valid JSON matching the schema
- Similar problems must have real working URLs
- Difficulty: Codeforces 800-3500 scale or LC easy/medium/hard

---

## Testing n8n Agents from Postman

### Test Analyzer Webhook
```
POST https://kair97.app.n8n.cloud/webhook/olympiq-problem-analysis
Content-Type: application/json

{
  "problem_url": "https://codeforces.com/contest/1842/problem/B"
}
```
Expected: JSON razbor with all 8 sections filled.

### Test Roadmap Webhook
```
POST https://kair97.app.n8n.cloud/webhook/coding-roadmap
Content-Type: application/json

{
  "username": "testuser",
  "mode": "weekly",
  "weekly_hours": 15,
  "codeforces": {
    "rating": 1400,
    "rank": "specialist",
    "problems_solved": 245,
    "topics": {"dp": 45, "greedy": 30}
  }
}
```
Expected: Weekly roadmap JSON with weeks array.

### Via Backend (end-to-end test)
```
POST http://localhost:8080/api/v1/analyze
Cookie: access_token=...
Content-Type: application/json

{"problem_url": "https://codeforces.com/contest/1842/problem/B"}
```
