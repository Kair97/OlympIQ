---
title: Decisions Log
type: decisions
last_updated: 2026-05-30
---

# Decisions Log

Architectural choices that aren't obvious from reading the code.

---

## Auth: JWT RS256 + httpOnly cookies (not localStorage)

**Decision:** Tokens stored in httpOnly, Secure, SameSite=Strict cookies — JavaScript cannot read them.
**Why:** XSS resistance. If any injected script runs, it cannot steal auth tokens.
**Impact:** Frontend never accesses token directly. Axios uses `withCredentials: true`. All token logic is server-side.

---

## LeetCode: alfa-leetcode-api proxy (not direct GraphQL)

**Decision:** Use `alfaarghya/alfa-leetcode-api` Docker service instead of calling LeetCode's GraphQL API directly.
**Why:** LeetCode's official API requires auth and has aggressive scraping blocks. The proxy handles that complexity.
**Impact:** Add `leetcode-api` service to docker-compose. Set `LEETCODE_API_URL` env var. If the proxy is down, LC features degrade gracefully.

---

## AI: Claude API (not Gemini)

**Decision:** Anthropic Claude (`claude-sonnet-4-20250514`) for all AI features.
**Why:** This is OlympIQ — using Claude is the correct product choice. An early bug involved "Gemini JSON wrapping" which was a mistaken test with Gemini format; this was reverted.
**Impact:** `ANTHROPIC_API_KEY` env var. JSON responses must be stripped of markdown fences before parsing.

---

## AI JSON parsing: always strip markdown fences

**Decision:** Before `json.Unmarshal`, strip ` ```json ... ``` ` fences from Claude's response.
**Why:** Claude occasionally wraps JSON in code fences even when instructed not to. Stripping them is defensive.
**Impact:** This was a real production bug (roadmap 500 errors). The fix is in `ai_service.go`.

---

## Database: 8 migrations instead of 7

**Decision:** Added migration 008 for `UNIQUE(user_id)` constraint on `user_goals`.
**Why:** The schema spec said `user_goals` should have one goal per user. Without the constraint, `PUT /goals` could create duplicates. This caused a 500 during testing.
**Impact:** `ON CONFLICT DO UPDATE` pattern used in goals upsert.

---

## Analyzer: no code editor, external links only

**Decision:** The Analyzer page has zero code editing capability. No textarea, no CodeMirror, no run button.
**Why:** OlympIQ is a learning tool. Students should understand the approach on OlympIQ, then go solve it themselves on Codeforces/LeetCode. This is a deliberate product constraint in CLAUDE.md.
**Impact:** Solve buttons are always `<a target="_blank">` links. Any PR that adds a code editor should be rejected.

---

## Nginx: IP-based upstream, not hostname

**Decision:** Nginx upstream uses the Docker service IP rather than lazy DNS hostname resolution.
**Why:** Nginx resolves upstreams at startup. If the backend container starts after nginx, DNS resolution fails and all proxied requests get 502 until nginx restarts.
**Impact:** docker-compose sets static IPs, or nginx uses `resolver 127.0.0.11` with variable-based proxy_pass.

---

## Related notes

[[03 - Architecture]] · [[06 - Active Issues]] · [[08-Security]] · [[04 - Backend]] · [[01-Architecture]]
