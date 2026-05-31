---
title: Build Checklist
type: checklist
last_updated: 2026-05-30
---

# Build Checklist (22 Steps)

Each step must have passing tests before advancing.

| # | Step | Status | Notes |
|---|------|--------|-------|
| 1 | Docker Compose skeleton — postgres + redis + leetcode-api + backend `/health` `/ready` | ✅ | Committed |
| 2 | Database migrations — all 7 tables + indexes | ✅ | 8 migrations (001–008); 008 adds UNIQUE to user_goals |
| 3 | Auth system — register, login, logout, refresh, change password + tests | ✅ | auth_service_test.go present |
| 4 | Profile endpoints — get, update username/email, delete + tests | ✅ | profile.go, profile_service.go |
| 5 | Platform accounts — connect + disconnect + tests | ✅ | accounts.go, accounts_service.go |
| 6 | Codeforces service — user.info, user.rating, user.status + Redis + tests | ✅ | codeforces_service_test.go present |
| 7 | LeetCode service — all 5 endpoints + Redis + tests | ✅ | leetcode_service.go |
| 8 | Stats sync handler — orchestrates CF + LC; stores snapshots + tests | ✅ | stats_service.go |
| 9 | Student context builder — `buildStudentContext()` | ✅ | Inside ai_service.go |
| 10 | Claude AI service — HTTP client, prompt assembly, JSON validation + tests | ✅ | ai_service.go (12KB) |
| 11 | Roadmap generation — weekly/topic/interview + goals API + tests | ✅ | roadmap.go |
| 12 | Recommendation engine — Claude call with solved-list filter + tests | ✅ | recommendations.go |
| 13 | Problem Analyzer backend — razbor endpoint + analysis history + tests | 🔄 | analyzer.go modified; uncommitted |
| 14 | React frontend — auth pages (register, login) matching Atelier | ✅ | Login.tsx, Register.tsx |
| 15 | React frontend — app shell (sidebar, status bar, theme toggle) | ✅ | AppShell.tsx, Sidebar.tsx, StatusBar.tsx |
| 16 | React frontend — dashboard | ✅ | Dashboard.tsx — full stats, sparkline, heatmap, topic bars |
| 17 | React frontend — roadmap page | ✅ | Roadmap.tsx — mode tabs, goal card, all three views |
| 18 | React frontend — analyzer page | 🔄 | Analyzer.tsx modified; 2-column razbor layout not yet complete |
| 19 | React frontend — profile page | ✅ | Profile.tsx — identity, password, platforms, danger zone |
| 20 | Nginx config + production Docker Compose + TLS setup | ⬜ | Nginx partially configured; prod TLS not done |
| 21 | Prometheus metrics + Grafana dashboard | ⬜ | prometheus.go scaffold exists; Grafana dashboard not wired |
| 22 | Full README + architecture diagram + API reference | ⬜ | Not started |

**Legend:** ✅ Done · 🔄 In Progress · ⬜ Not Started

---

## Related notes

[[_context]] · [[01 - Project Status]] · [[06 - Active Issues]] · [[04 - Backend]] · [[05 - Frontend]] · [[00-Master-Context]]
