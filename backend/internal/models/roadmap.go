package models

import (
	"time"

	"github.com/google/uuid"
)

// Roadmap stores a Claude-generated study plan for a user.
type Roadmap struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Content     []byte    `json:"content"`
	Mode        string    `json:"mode"`
	GeneratedAt time.Time `json:"generated_at"`
}

// RoadmapProblem is a single problem recommendation inside a roadmap.
type RoadmapProblem struct {
	Title      string   `json:"title"`
	Platform   string   `json:"platform"`
	URL        string   `json:"url"`
	Rating     *int     `json:"rating"`
	Difficulty *string  `json:"difficulty"`
	Tags       []string `json:"tags"`
	Reason     string   `json:"reason"`
}
