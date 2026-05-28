package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"olympiq/backend/internal/models"
)

// TokenRepository manages refresh tokens.
type TokenRepository interface {
	Create(ctx context.Context, t *models.RefreshToken) error
	FindByHash(ctx context.Context, hash string) (*models.RefreshToken, error)
	DeleteByHash(ctx context.Context, hash string) error
	DeleteByUserID(ctx context.Context, userID uuid.UUID) error
	DeleteExpired(ctx context.Context) error
}

type pgTokenRepo struct{ db *pgxpool.Pool }

// NewTokenRepo returns a PostgreSQL-backed TokenRepository.
func NewTokenRepo(db *pgxpool.Pool) TokenRepository { return &pgTokenRepo{db: db} }

func (r *pgTokenRepo) Create(ctx context.Context, t *models.RefreshToken) error {
	q := `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
	      VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.Exec(ctx, q, t.ID, t.UserID, t.TokenHash, t.ExpiresAt, t.CreatedAt)
	return err
}

func (r *pgTokenRepo) FindByHash(ctx context.Context, hash string) (*models.RefreshToken, error) {
	q := `SELECT id, user_id, token_hash, expires_at, created_at FROM refresh_tokens WHERE token_hash=$1`
	var t models.RefreshToken
	err := r.db.QueryRow(ctx, q, hash).Scan(&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &t.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *pgTokenRepo) DeleteByHash(ctx context.Context, hash string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM refresh_tokens WHERE token_hash=$1`, hash)
	return err
}

func (r *pgTokenRepo) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id=$1`, userID)
	return err
}

func (r *pgTokenRepo) DeleteExpired(ctx context.Context) error {
	_, err := r.db.Exec(ctx, `DELETE FROM refresh_tokens WHERE expires_at < $1`, time.Now())
	return err
}
