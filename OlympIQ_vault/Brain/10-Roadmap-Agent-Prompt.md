---
title: Roadmap Agent Prompt
type: brain
last_updated: 2026-05-31
---

# Roadmap Feature — Full Implementation Prompt

> Paste this into a new Claude Code session to implement the full
> stats payload + unified roadmap rendering task.
> Source file: `ROADMAP_AGENT_PROMPT.txt` in project root.

---

## What this prompt implements

4 backend changes + 5 frontend changes:

| # | File | Change |
|---|------|--------|
| 1 | `models/goals.go` | Add `WeeklyHours *int` field |
| 2 | `goals_repo.go` | Include weekly_hours in upsert SQL |
| 3 | `db/migrations/009_*` | ALTER TABLE user_goals ADD COLUMN weekly_hours |
| 4 | Goals handler | Accept weekly_hours in PUT /goals body |
| 5 | `ai_service.go` → `callN8NRoadmap` | mode always "all"; weekly_hours from goals |
| 6 | `types/index.ts` | Add UnifiedRoadmap + sub-interfaces |
| 7 | Profile.tsx / GoalModal | weekly_hours number input |
| 8 | `api/roadmap.ts` | generateRoadmap always sends mode: "all" |
| 9 | `Roadmap.tsx` | Summary section + all 3 mode renderers |

---

## Input payload shape (what goes TO n8n)

```json
{
  "username":     "kair97",
  "mode":         "all",
  "weekly_hours": 15,
  "codeforces": {
    "rating":         1450,
    "rank":           "specialist",
    "problems_solved": 89,
    "topics":         { "Greedy": 24, "Implementation": 31, "Math": 18 },
    "rating_history": [1100, 1180, 1250, 1310, 1380, 1420, 1450]
  },
  "leetcode": {
    "total_solved": 247,
    "easy":  98,
    "medium": 132,
    "hard":   17,
    "topics": { "Array": 45, "String": 38, "Dynamic Programming": 8 }
  },
  "goal":     "FAANG Software Engineer",
  "deadline": "2025-09-01"
}
```

---

## Output roadmap shape (what comes BACK from n8n)

```json
{
  "summary": {
    "total_weeks":     52,
    "estimated_hours": 780,
    "focus_areas":     ["Dynamic Programming", "Graph", "Tree"],
    "milestones": [
      { "week": 2, "description": "Complete all easy DP problems" },
      { "week": 5, "description": "Reach 1600 CF rating" }
    ]
  },
  "topic_mode": {
    "generated_at": "ISO8601",
    "goal_summary": "string",
    "topics": [
      {
        "name": "Dynamic Programming",
        "why": "You solved only 5 DP problems...",
        "strength_score": 0.25,
        "problems": [ { "title": "...", "platform": "leetcode", "url": "...", "difficulty": "easy", "tags": ["dp"], "reason": "..." } ]
      }
    ]
  },
  "weekly_mode": {
    "generated_at": "ISO8601",
    "goal_summary": "string",
    "weeks": [
      {
        "week": 1,
        "theme": "Foundation: Dynamic Programming",
        "focus_topics": ["Dynamic Programming"],
        "problems": [ { ... } ]
      }
    ]
  },
  "interview_mode": {
    "generated_at": "ISO8601",
    "target_companies": ["FAANG"],
    "patterns": [
      {
        "name": "Dynamic Programming",
        "frequency": 1.0,
        "user_strength": "weak",
        "problems_solved": 5,
        "problems": [ { ... } ]
      }
    ]
  }
}
```

---

## Key constraints

- `BuildStudentContext` is already correct — do NOT change it
- CF topics = `sc.CFTagFreq` (from verdict=="OK" submissions)
- LC topics = `sc.LCTopics` (from /skill endpoint)
- No code editor anywhere; all solve links are `<a target="_blank">`
- TypeScript strict mode, no `any`
- All Go external errors wrapped with `ErrExternal`

---

## Related notes

[[00-Master-Context]] · [[02-Backend-Deep]] · [[04-Frontend-Deep]] · [[03-Database]] · [[06 - Active Issues]] · [[Codeforces API Reference]] · [[LeetCode alfa-leetcode-api Reference]]
