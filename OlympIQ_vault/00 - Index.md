---
title: OlympIQ Vault Index
type: MOC
last_updated: 2026-05-30
---

# OlympIQ Vault

> AI-Powered Olympiad Training Platform — Go + Fiber · React + TypeScript · PostgreSQL · Redis · Claude API

---

## Read `_context.md` FIRST, always. It is the only note you need for most tasks.

---

## Task routing

| Task | Read these notes in order |
|------|--------------------------|
| Backend bug fix | `_context.md` → `06 - Active Issues.md` → `Backend/04 - Backend.md` |
| Frontend feature | `_context.md` → `06 - Active Issues.md` → `Frontend/05 - Frontend.md` |
| New AI feature | `_context.md` → `03 - Architecture.md` → `Backend/04 - Backend.md` |
| Roadmap / Analyzer work | `_context.md` → `Frontend/05 - Frontend.md` → `Backend/04 - Backend.md` |
| Codeforces service work | `_context.md` → `Backend/Codeforces API Reference.md` → `Backend/04 - Backend.md` |
| LeetCode service work | `_context.md` → `Backend/LeetCode alfa-leetcode-api Reference.md` → `Backend/04 - Backend.md` |
| API testing / Postman | `Brain/11-API-Reference.md` — all endpoints with exact request/response examples |
| DB migration | `_context.md` → `03 - Architecture.md` |
| Architecture decision | `07 - Decisions Log.md` |
| Full orientation | All notes 00–07 in order |

---

## Note map

| Note | What it covers |
|------|---------------|
| [[_context\|_context.md]] | Build step, modified files, next tasks, ports, env vars, Docker commands |
| [[01 - Project Status\|01 - Project Status.md]] | Current step detail, done/remaining breakdown, next tasks |
| [[02 - Build Checklist\|02 - Build Checklist.md]] | All 22 build steps with ✅ / 🔄 / ⬜ status |
| [[03 - Architecture\|03 - Architecture.md]] | Stack, file layout, auth flow, AI data flow, Redis keys, JWT reference |
| [[04 - Backend\|Backend/04 - Backend.md]] | Handler, service, migration inventory with status |
| [[Codeforces API Reference\|Backend/Codeforces API Reference.md]] | All CF API methods, params, sample responses, return objects, Redis keys |
| [[LeetCode alfa-leetcode-api Reference\|Backend/LeetCode alfa-leetcode-api Reference.md]] | All LC proxy endpoints, params, sample responses, sync flow, Redis keys |
| [[05 - Frontend\|Frontend/05 - Frontend.md]] | Pages, components, stores, Analyzer spec |
| [[06 - Active Issues\|06 - Active Issues.md]] | In-progress items, recent fix history, watch list |
| [[07 - Decisions Log\|07 - Decisions Log.md]] | Architectural decisions with rationale |
| [[Sessions/README\|Sessions/README.md]] | Per-session changelog index |
| [[Claude Prompts\|Claude Prompts.md]] | Ready-to-paste prompts for every task type |

---

## Brain directory

| Note | What it covers |
|------|---------------|
| [[00-Master-Context]] | Single source of truth — full stack, all routes, all env vars, all Redis keys |
| [[01-Architecture]] | Mermaid diagrams, request lifecycles, service boundaries |
| [[02-Backend-Deep]] | Startup sequence, all handlers/services, auth flow code-level |
| [[03-Database]] | Full schema, JSONB contents, migration history |
| [[04-Frontend-Deep]] | All pages, stores, Axios interceptors, component map |
| [[05-n8n-Agents]] | Webhook payloads, envelope unwrapping, n8n setup |
| [[06-Errors-Bible]] | 40+ known errors with exact fixes, organized by category |
| [[07-Testing-Guide]] | Postman collection, test patterns, integration test flows |
| [[08-Security]] | Auth model, cookie flags, rate limits, CORS, CSP |
| [[09-Environment-Setup]] | All env vars, Docker commands, key generation |
| [[10-Roadmap-Agent-Prompt]] | Ready-to-paste prompt for implementing full stats payload + unified roadmap rendering |
| [[11-API-Reference]] | Complete API reference: all 27 routes, exact request bodies, full response shapes, error codes, Postman quick-start |

---

## Quick facts

- **Repo:** `C:\Users\orynb\Desktop\OlympIQ`
- **Branch:** `main`
- **API prefix:** `/api/v1`
- **Stack:** Go Fiber · PostgreSQL 16 · Redis 7 · React 18 · Vite · Tailwind · Claude API
