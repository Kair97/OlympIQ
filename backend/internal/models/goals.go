package models

import (
	"time"

	"github.com/google/uuid"
)

// UserGoal stores the user's competitive programming goal and notification prefs.
type UserGoal struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"user_id"`
	GoalType       string     `json:"goal_type"`
	TargetRating   *int       `json:"target_rating"`
	TargetDate     *time.Time `json:"target_date"`
	WeeklyHours    *int       `json:"weekly_hours"`
	NotifyDaily    bool       `json:"notify_daily"`
	NotifyWeekly   bool       `json:"notify_weekly"`
	NotifyProblems bool       `json:"notify_problems"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
