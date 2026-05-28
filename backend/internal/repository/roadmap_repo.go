package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"olympiq/backend/internal/models"
)

// RoadmapRepository manages roadmap records.
type RoadmapRepository interface {
	Insert(ctx context.Context, r *models.Roadmap) error
	LatestByUserID(ctx context.Context, userID uuid.UUID) (*models.Roadmap, error)
}

type pgRoadmapRepo struct{ db *pgxpool.Pool }

// NewRoadmapRepo returns a PostgreSQL-backed RoadmapRepository.
func NewRoadmapRepo(db *pgxpool.Pool) RoadmapRepository { return &pgRoadmapRepo{db: db} }

func (r *pgRoadmapRepo) Insert(ctx context.Context, rm *models.Roadmap) error {
	q := `INSERT INTO roadmaps (id, user_id, content, mode, generated_at) VALUES ($1,$2,$3,$4,$5)`
	_, err := r.db.Exec(ctx, q, rm.ID, rm.UserID, rm.Content, rm.Mode, rm.GeneratedAt)
	return err
}

func (r *pgRoadmapRepo) LatestByUserID(ctx context.Context, userID uuid.UUID) (*models.Roadmap, error) {
	q := `SELECT id, user_id, content, mode, generated_at FROM roadmaps WHERE user_id=$1 ORDER BY generated_at DESC LIMIT 1`
	var rm models.Roadmap
	err := r.db.QueryRow(ctx, q, userID).Scan(&rm.ID, &rm.UserID, &rm.Content, &rm.Mode, &rm.GeneratedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &rm, nil
}
