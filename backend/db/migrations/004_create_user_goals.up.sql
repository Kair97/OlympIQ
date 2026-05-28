CREATE TABLE user_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_type       TEXT NOT NULL,
    target_rating   INT,
    target_date     DATE,
    notify_daily    BOOLEAN NOT NULL DEFAULT false,
    notify_weekly   BOOLEAN NOT NULL DEFAULT false,
    notify_problems BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_goals_user_id ON user_goals(user_id);
