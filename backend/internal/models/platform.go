package models

import (
	"time"

	"github.com/google/uuid"
)

// PlatformAccount links a user to their Codeforces or LeetCode handle.
type PlatformAccount struct {
	ID           uuid.UUID  `json:"id"`
	UserID       uuid.UUID  `json:"user_id"`
	Platform     string     `json:"platform"`
	Handle       string     `json:"handle"`
	LastSyncedAt *time.Time `json:"last_synced_at"`
}
