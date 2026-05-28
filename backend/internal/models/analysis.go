package models

import (
	"time"

	"github.com/google/uuid"
)

// Analysis stores a Claude razbor for a competitive programming problem.
type Analysis struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	ProblemURL   string    `json:"problem_url"`
	ProblemTitle *string   `json:"problem_title"`
	Platform     *string   `json:"platform"`
	AnalysisText string    `json:"analysis_text"`
	CreatedAt    time.Time `json:"created_at"`
}

// RefreshToken is a stored refresh token record (only the hash is persisted).
type RefreshToken struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	TokenHash string    `json:"-"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}
