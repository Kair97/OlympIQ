CREATE TABLE platform_accounts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform       TEXT NOT NULL CHECK (platform IN ('codeforces', 'leetcode')),
    handle         TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ,
    UNIQUE(user_id, platform)
);

CREATE INDEX idx_platform_accounts_user_id ON platform_accounts(user_id);
