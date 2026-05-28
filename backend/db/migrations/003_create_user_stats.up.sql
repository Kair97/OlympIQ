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
