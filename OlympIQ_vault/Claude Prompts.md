---
title: Claude Code Prompts
type: reference
last_updated: 2026-05-30
---

# OlympIQ — Claude Code Prompts

> Copy the prompt that matches your task. Fill in `[BRACKETS]` and paste into Claude Code terminal.

---

## PROMPT 1 — Session Start
> Use this every time you open a new Claude Code session.

```
Read CLAUDE.md fully before doing anything else.

Then read in this order:
1. OlympIQ_vault/01 - Project Status.md   → current build step + what's broken
2. OlympIQ_vault/06 - Active Issues.md    → known bugs, do not touch these files

Current task: [DESCRIBE YOUR TASK HERE]

Rules for this session:
- Follow the build order in CLAUDE.md exactly. Do not skip steps.
- Every step must have passing tests before moving to the next.
- Do not modify files outside the current build step's scope.
- After finishing, update OlympIQ_vault/01 - Project Status.md.
```

---

## PROMPT 2 — Backend Task (steps 1–13)

```
Read CLAUDE.md → OlympIQ_vault/01 - Project Status.md → OlympIQ_vault/06 - Active Issues.md

We are on build step [N]: [STEP NAME]

Task: [DESCRIBE SPECIFICALLY]

Constraints:
- Go + Fiber v2 only. No new dependencies without asking first.
- sqlc for all DB queries. Zero raw SQL string concatenation.
- All errors handled. _ = err is forbidden.
- Redis cache keys must follow the exact pattern in CLAUDE.md.
- Table-driven tests. Minimum 80% coverage for this step.
- golangci-lint must pass before this step is done.

When done: update OlympIQ_vault/01 - Project Status.md.
```

---

## PROMPT 3 — Frontend Task (steps 14–19)

```
Read CLAUDE.md → OlympIQ_vault/01 - Project Status.md → OlympIQ_vault/05 - Frontend.md

Frontend task: [DESCRIBE SPECIFICALLY]

Design rules (non-negotiable):
- Match OlympIQ - Atelier (standalone).html exactly. Open it and compare before finishing.
- Only CSS variables from CLAUDE.md design tokens. Zero hardcoded colors.
- TypeScript strict mode. Zero `any` types.
- Zustand for state. Axios with interceptors for API calls.
- Analyzer page: NO textarea, NO code editor, NO CodeMirror. External links only.
- Every problem link opens in new tab with rel="noopener".

When done: update OlympIQ_vault/01 - Project Status.md.
```

---

## PROMPT 4 — Bug Fix

```
Read CLAUDE.md → OlympIQ_vault/06 - Active Issues.md

Bug: [WHAT HAPPENS vs WHAT SHOULD HAPPEN]
File(s): [PATHS]
Error:
[PASTE ERROR]

Rules:
- Fix only this bug. Do not refactor unrelated code.
- Write a failing test that reproduces the bug first, then fix it.
- If the fix requires touching more than 3 files, stop and explain before proceeding.

When done: remove this issue from OlympIQ_vault/06 - Active Issues.md.
```

---

## PROMPT 5 — Quick Question (no full context load)

```
/btw [YOUR QUESTION]
```

> Use `/btw` for side questions so Claude doesn't reload the full vault.

---

## Token-saving rules

1. Always start with Prompt 1 — never describe the project from scratch
2. Keep `01 - Project Status.md` updated after every session — biggest token saver
3. Use `/btw` for quick questions
4. Add broken things to `06 - Active Issues.md` immediately — Claude won't rediscover them
5. Add files to "Do NOT touch" in `01 - Project Status.md` to prevent accidental changes
