---
title: Database Reference
type: brain
last_updated: 2026-05-31
---

# Database Reference

---

## Every Table: Complete Schema

### users
```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
No other indexes beyond PK and UNIQUE constraints.

### platform_accounts
```sql
CREATE TABLE platform_accounts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform       TEXT NOT NULL CHECK (platform IN ('codeforces', 'leetcode')),
    handle         TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ,
    UNIQUE(user_id, platform)
);
CREATE INDEX idx_platform_accounts_user_id ON platform_accounts(user_id);
```

### user_stats
```sql
CREATE TABLE user_stats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL,
    rating          INT,
    rank            TEXT,
    max_rating      INT,
    problems_solved INT,
    contest_count   INT,
    raw_data        JSONB,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);
```
Note: Multiple rows per user+platform (history). `LatestByUserIDAndPlatform` queries `ORDER BY fetched_at DESC LIMIT 1`.

### user_goals
```sql
CREATE TABLE user_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_type       TEXT NOT NULL,  -- 'rating' | 'interview' | 'topic_mastery'
    target_rating   INT,
    target_date     DATE,
    notify_daily    BOOLEAN NOT NULL DEFAULT false,
    notify_weekly   BOOLEAN NOT NULL DEFAULT false,
    notify_problems BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_goals_user_id ON user_goals(user_id);
-- Migration 008:
ALTER TABLE user_goals ADD CONSTRAINT user_goals_user_id_unique UNIQUE (user_id);
```
UNIQUE(user_id) means one goal row per user. `Upsert` uses `INSERT ON CONFLICT (user_id) DO UPDATE`.

### roadmaps
```sql
CREATE TABLE roadmaps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content      JSONB NOT NULL,
    mode         TEXT NOT NULL DEFAULT 'weekly',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_roadmaps_user_id ON roadmaps(user_id);
```
Multiple rows per user (history). `LatestByUserID` uses `ORDER BY generated_at DESC LIMIT 1`.

### analyses
```sql
CREATE TABLE analyses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_url   TEXT NOT NULL,
    problem_title TEXT,
    platform      TEXT,
    analysis_text TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_analyses_user_id ON analyses(user_id);
```
`analysis_text` stores the raw JSON string from the AI. Parsed at read time.

### refresh_tokens
```sql
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
```
Only SHA256 hex of the token is stored. Raw token never persisted.

---

## Migration Files Summary

| File | What it does |
|------|-------------|
| 001_create_users.up.sql | Create users table |
| 002_create_platform_accounts.up.sql | Create platform_accounts table |
| 003_create_user_stats.up.sql | Create user_stats table |
| 004_create_user_goals.up.sql | Create user_goals table |
| 005_create_roadmaps.up.sql | Create roadmaps table |
| 006_create_analyses.up.sql | Create analyses table |
| 007_create_refresh_tokens.up.sql | Create refresh_tokens table + all indexes |
| 008_user_goals_unique.up.sql | `ALTER TABLE user_goals ADD CONSTRAINT user_goals_user_id_unique UNIQUE (user_id)` |

Migration tool: `backend/cmd/migrate/main.go` — uses `golang-migrate/migrate/v4` with `pgx5` driver.

---

## JSONB raw_data Contents

### codeforces raw_data (stored in user_stats)
```json
{
  "user": {
    "handle": "string",
    "rating": 1500,
    "rank": "specialist",
    "maxRating": 1600,
    "maxRank": "expert"
  },
  "tag_freq": {
    "dp": 45,
    "greedy": 30,
    "graphs": 12
  },
  "sub_count": 245,
  "rating_history": [1200, 1300, 1350, 1400, 1500],
  "contest_count": 24
}
```
`sub_count` = number of unique solved problems (deduplicated by contestId/index).
`rating_history` = last 24 `NewRating` values from `user.rating` API.
`tag_freq` = from `BuildTagFrequency(subs)` — only counts each problem once.

### leetcode raw_data (stored in user_stats)
```json
{
  "profile": {
    "username": "string",
    "ranking": 12345,
    "totalSolved": 120,
    "easySolved": 60,
    "mediumSolved": 50,
    "hardSolved": 10,
    "acceptanceRate": "62.5%"
  },
  "contest": {
    "contestAttend": 15,
    "contestRating": 1823.5,
    "contestGlobalRanking": 45000,
    "totalParticipants": 300000,
    "contestTopPercentage": 15.0
  },
  "skill": {
    "data": {
      "advanced": [{"tagName": "Dynamic Programming", "problemsSolved": 20}],
      "intermediate": [{"tagName": "Binary Search", "problemsSolved": 15}],
      "fundamental": [{"tagName": "Array", "problemsSolved": 45}]
    }
  },
  "calendar": {
    "1700000000": 3,
    "1700086400": 1
  }
}
```

---

## Repository Interfaces

### UserRepository
```go
Create(ctx, *models.User) error
FindByID(ctx, uuid.UUID) (*models.User, error)
FindByEmail(ctx, string) (*models.User, error)
FindByUsername(ctx, string) (*models.User, error)
Update(ctx, *models.User) error
Delete(ctx, uuid.UUID) error
```

### TokenRepository
```go
Create(ctx, *models.RefreshToken) error
FindByHash(ctx, tokenHash string) (*models.RefreshToken, error)
DeleteByHash(ctx, tokenHash string) error
DeleteByUserID(ctx, uuid.UUID) error  // revoke all sessions
```

### PlatformRepository
```go
Upsert(ctx, *models.PlatformAccount) error
FindByUserIDAndPlatform(ctx, uuid.UUID, string) (*models.PlatformAccount, error)
ListByUserID(ctx, uuid.UUID) ([]*models.PlatformAccount, error)
Delete(ctx, uuid.UUID, string) error  // (userID, platform)
UpdateLastSynced(ctx, uuid.UUID, string, time.Time) error
```

### StatsRepository
```go
Insert(ctx, *models.UserStats) error
ListByUserID(ctx, uuid.UUID) ([]*models.UserStats, error)
LatestByUserIDAndPlatform(ctx, uuid.UUID, string) (*models.UserStats, error)
```

### GoalsRepository
```go
Upsert(ctx, *models.UserGoal) error   // INSERT ON CONFLICT(user_id) DO UPDATE
FindByUserID(ctx, uuid.UUID) (*models.UserGoal, error)
```

### RoadmapRepository
```go
Insert(ctx, *models.Roadmap) error
LatestByUserID(ctx, uuid.UUID) (*models.Roadmap, error)
```

### AnalysesRepository
```go
Insert(ctx, *models.Analysis) error
FindByID(ctx, uuid.UUID) (*models.Analysis, error)
ListByUserID(ctx, uuid.UUID, page, limit int) ([]*models.Analysis, int, error)
```

---

## Repository Error Handling

All repos return `repository.ErrNotFound` (defined in `repository/errors.go`) when `pgx.ErrNoRows` is encountered. Service layer checks `errors.Is(err, repository.ErrNotFound)` and translates to `services.ErrNotFound`.

```go
// repository/errors.go
var ErrNotFound = errors.New("not found")
```

---

## How to Run Migrations

### Development (Docker)
```bash
# Start all services first
docker-compose up -d postgres

# Run migrations (migrate binary is built into backend image)
docker-compose exec backend ./migrate up

# Roll back one migration
docker-compose exec backend ./migrate down 1
```

### Migrate binary source: `backend/cmd/migrate/main.go`
Uses `golang-migrate` with `pgx5` stdlib driver.

### Direct psql (development only)
```bash
docker-compose exec postgres psql -U olympiq -d olympiq
```

---

## How to Reset DB for Dev

```bash
# Stop backend first (avoid connection conflicts)
docker-compose stop backend

# Drop and recreate
docker-compose exec postgres psql -U olympiq -c "DROP DATABASE olympiq;"
docker-compose exec postgres psql -U olympiq -c "CREATE DATABASE olympiq;"

# Re-run migrations
docker-compose start backend
docker-compose exec backend ./migrate up
```

Or use the down migrations:
```bash
docker-compose exec backend ./migrate down  # rolls back all
docker-compose exec backend ./migrate up    # reapplies all
```

---

## Related notes

[[00-Master-Context]] · [[03 - Architecture]] · [[02-Backend-Deep]] · [[01-Architecture]]
