package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"olympiq/backend/internal/models"
)

// GoalsRepository manages user_goals records.
type GoalsRepository interface {
	Upsert(ctx context.Context, g *models.UserGoal) error
	FindByUserID(ctx context.Context, userID uuid.UUID) (*models.UserGoal, error)
}

type pgGoalsRepo struct{ db *pgxpool.Pool }

// NewGoalsRepo returns a PostgreSQL-backed GoalsRepository.
func NewGoalsRepo(db *pgxpool.Pool) GoalsRepository { return &pgGoalsRepo{db: db} }

func (r *pgGoalsRepo) Upsert(ctx context.Context, g *models.UserGoal) error {
	q := `INSERT INTO user_goals (id, user_id, goal_type, target_rating, target_date, notify_daily, notify_weekly, notify_problems, created_at, updated_at)
	      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	      ON CONFLICT (user_id) DO UPDATE SET
	        goal_type=$3, target_rating=$4, target_date=$5,
	        notify_daily=$6, notify_weekly=$7, notify_problems=$8, updated_at=$10`
	_, err := r.db.Exec(ctx, q,
		g.ID, g.UserID, g.GoalType, g.TargetRating, g.TargetDate,
		g.NotifyDaily, g.NotifyWeekly, g.NotifyProblems, g.CreatedAt, g.UpdatedAt,
	)
	return err
}

func (r *pgGoalsRepo) FindByUserID(ctx context.Context, userID uuid.UUID) (*models.UserGoal, error) {
	q := `SELECT id, user_id, goal_type, target_rating, target_date, notify_daily, notify_weekly, notify_problems, created_at, updated_at
	      FROM user_goals WHERE user_id=$1`
	var g models.UserGoal
	err := r.db.QueryRow(ctx, q, userID).Scan(
		&g.ID, &g.UserID, &g.GoalType, &g.TargetRating, &g.TargetDate,
		&g.NotifyDaily, &g.NotifyWeekly, &g.NotifyProblems, &g.CreatedAt, &g.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}
