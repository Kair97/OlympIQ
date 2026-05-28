package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"olympiq/backend/internal/models"
)

// AnalysesRepository manages saved problem analyses.
type AnalysesRepository interface {
	Insert(ctx context.Context, a *models.Analysis) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.Analysis, error)
	ListByUserID(ctx context.Context, userID uuid.UUID, page, limit int) ([]*models.Analysis, int, error)
}

type pgAnalysesRepo struct{ db *pgxpool.Pool }

// NewAnalysesRepo returns a PostgreSQL-backed AnalysesRepository.
func NewAnalysesRepo(db *pgxpool.Pool) AnalysesRepository { return &pgAnalysesRepo{db: db} }

func (r *pgAnalysesRepo) Insert(ctx context.Context, a *models.Analysis) error {
	q := `INSERT INTO analyses (id, user_id, problem_url, problem_title, platform, analysis_text, created_at)
	      VALUES ($1,$2,$3,$4,$5,$6,$7)`
	_, err := r.db.Exec(ctx, q, a.ID, a.UserID, a.ProblemURL, a.ProblemTitle, a.Platform, a.AnalysisText, a.CreatedAt)
	return err
}

func (r *pgAnalysesRepo) FindByID(ctx context.Context, id uuid.UUID) (*models.Analysis, error) {
	q := `SELECT id, user_id, problem_url, problem_title, platform, analysis_text, created_at FROM analyses WHERE id=$1`
	var a models.Analysis
	err := r.db.QueryRow(ctx, q, id).Scan(&a.ID, &a.UserID, &a.ProblemURL, &a.ProblemTitle, &a.Platform, &a.AnalysisText, &a.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *pgAnalysesRepo) ListByUserID(ctx context.Context, userID uuid.UUID, page, limit int) ([]*models.Analysis, int, error) {
	offset := (page - 1) * limit
	countRow := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM analyses WHERE user_id=$1`, userID)
	var total int
	if err := countRow.Scan(&total); err != nil {
		return nil, 0, err
	}

	q := `SELECT id, user_id, problem_url, problem_title, platform, analysis_text, created_at
	      FROM analyses WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, q, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var all []*models.Analysis
	for rows.Next() {
		var a models.Analysis
		if err := rows.Scan(&a.ID, &a.UserID, &a.ProblemURL, &a.ProblemTitle, &a.Platform, &a.AnalysisText, &a.CreatedAt); err != nil {
			return nil, 0, err
		}
		all = append(all, &a)
	}
	return all, total, rows.Err()
}
