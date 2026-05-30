package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"olympiq/backend/internal/models"
)

// StatsRepository manages user_stats snapshots.
type StatsRepository interface {
	Insert(ctx context.Context, s *models.UserStats) error
	LatestByUserIDAndPlatform(ctx context.Context, userID uuid.UUID, platform string) (*models.UserStats, error)
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]*models.UserStats, error)
}

type pgStatsRepo struct{ db *pgxpool.Pool }

// NewStatsRepo returns a PostgreSQL-backed StatsRepository.
func NewStatsRepo(db *pgxpool.Pool) StatsRepository { return &pgStatsRepo{db: db} }

func (r *pgStatsRepo) Insert(ctx context.Context, s *models.UserStats) error {
	q := `INSERT INTO user_stats (id, user_id, platform, rating, rank, max_rating, problems_solved, contest_count, raw_data, fetched_at)
	      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
	_, err := r.db.Exec(ctx, q, s.ID, s.UserID, s.Platform, s.Rating, s.Rank, s.MaxRating, s.ProblemsSolved, s.ContestCount, s.RawData, s.FetchedAt)
	return err
}

func (r *pgStatsRepo) LatestByUserIDAndPlatform(ctx context.Context, userID uuid.UUID, platform string) (*models.UserStats, error) {
	q := `SELECT id, user_id, platform, rating, rank, max_rating, problems_solved, contest_count, raw_data, fetched_at
	      FROM user_stats WHERE user_id=$1 AND platform=$2 ORDER BY fetched_at DESC LIMIT 1`
	var s models.UserStats
	err := r.db.QueryRow(ctx, q, userID, platform).Scan(
		&s.ID, &s.UserID, &s.Platform, &s.Rating, &s.Rank,
		&s.MaxRating, &s.ProblemsSolved, &s.ContestCount, &s.RawData, &s.FetchedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ListByUserID returns only the most recent snapshot per platform (no duplicate cards).
func (r *pgStatsRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*models.UserStats, error) {
	q := `SELECT DISTINCT ON (platform) id, user_id, platform, rating, rank, max_rating, problems_solved, contest_count, raw_data, fetched_at
	      FROM user_stats WHERE user_id=$1 ORDER BY platform, fetched_at DESC`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var all []*models.UserStats
	for rows.Next() {
		var s models.UserStats
		if err := rows.Scan(&s.ID, &s.UserID, &s.Platform, &s.Rating, &s.Rank,
			&s.MaxRating, &s.ProblemsSolved, &s.ContestCount, &s.RawData, &s.FetchedAt); err != nil {
			return nil, err
		}
		all = append(all, &s)
	}
	return all, rows.Err()
}
