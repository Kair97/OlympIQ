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

// PlatformRepository manages platform_accounts records.
type PlatformRepository interface {
	Upsert(ctx context.Context, a *models.PlatformAccount) error
	FindByUserIDAndPlatform(ctx context.Context, userID uuid.UUID, platform string) (*models.PlatformAccount, error)
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]*models.PlatformAccount, error)
	Delete(ctx context.Context, userID uuid.UUID, platform string) error
	UpdateLastSynced(ctx context.Context, userID uuid.UUID, platform string, t time.Time) error
}

type pgPlatformRepo struct{ db *pgxpool.Pool }

// NewPlatformRepo returns a PostgreSQL-backed PlatformRepository.
func NewPlatformRepo(db *pgxpool.Pool) PlatformRepository { return &pgPlatformRepo{db: db} }

func (r *pgPlatformRepo) Upsert(ctx context.Context, a *models.PlatformAccount) error {
	q := `INSERT INTO platform_accounts (id, user_id, platform, handle)
	      VALUES ($1, $2, $3, $4)
	      ON CONFLICT (user_id, platform) DO UPDATE SET handle = EXCLUDED.handle`
	_, err := r.db.Exec(ctx, q, a.ID, a.UserID, a.Platform, a.Handle)
	return err
}

func (r *pgPlatformRepo) FindByUserIDAndPlatform(ctx context.Context, userID uuid.UUID, platform string) (*models.PlatformAccount, error) {
	q := `SELECT id, user_id, platform, handle, last_synced_at FROM platform_accounts WHERE user_id=$1 AND platform=$2`
	var a models.PlatformAccount
	err := r.db.QueryRow(ctx, q, userID, platform).Scan(&a.ID, &a.UserID, &a.Platform, &a.Handle, &a.LastSyncedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *pgPlatformRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*models.PlatformAccount, error) {
	q := `SELECT id, user_id, platform, handle, last_synced_at FROM platform_accounts WHERE user_id=$1`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []*models.PlatformAccount
	for rows.Next() {
		var a models.PlatformAccount
		if err := rows.Scan(&a.ID, &a.UserID, &a.Platform, &a.Handle, &a.LastSyncedAt); err != nil {
			return nil, err
		}
		accounts = append(accounts, &a)
	}
	return accounts, rows.Err()
}

func (r *pgPlatformRepo) Delete(ctx context.Context, userID uuid.UUID, platform string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM platform_accounts WHERE user_id=$1 AND platform=$2`, userID, platform)
	return err
}

func (r *pgPlatformRepo) UpdateLastSynced(ctx context.Context, userID uuid.UUID, platform string, t time.Time) error {
	q := `UPDATE platform_accounts SET last_synced_at=$1 WHERE user_id=$2 AND platform=$3`
	_, err := r.db.Exec(ctx, q, t, userID, platform)
	return err
}
