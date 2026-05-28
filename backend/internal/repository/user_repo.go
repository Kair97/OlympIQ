package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"olympiq/backend/internal/models"
)

// UserRepository defines data access for users.
type UserRepository interface {
	Create(ctx context.Context, u *models.User) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	FindByEmail(ctx context.Context, email string) (*models.User, error)
	FindByUsername(ctx context.Context, username string) (*models.User, error)
	Update(ctx context.Context, u *models.User) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type pgUserRepo struct{ db *pgxpool.Pool }

// NewUserRepo returns a PostgreSQL-backed UserRepository.
func NewUserRepo(db *pgxpool.Pool) UserRepository { return &pgUserRepo{db: db} }

func (r *pgUserRepo) Create(ctx context.Context, u *models.User) error {
	q := `INSERT INTO users (id, email, username, password_hash, created_at, updated_at)
	      VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.Exec(ctx, q, u.ID, u.Email, u.Username, u.PasswordHash, u.CreatedAt, u.UpdatedAt)
	return err
}

func (r *pgUserRepo) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	q := `SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE id = $1`
	return scanUser(r.db.QueryRow(ctx, q, id))
}

func (r *pgUserRepo) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	q := `SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE email = $1`
	return scanUser(r.db.QueryRow(ctx, q, email))
}

func (r *pgUserRepo) FindByUsername(ctx context.Context, username string) (*models.User, error) {
	q := `SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE username = $1`
	return scanUser(r.db.QueryRow(ctx, q, username))
}

func (r *pgUserRepo) Update(ctx context.Context, u *models.User) error {
	q := `UPDATE users SET email=$1, username=$2, password_hash=$3, updated_at=$4 WHERE id=$5`
	_, err := r.db.Exec(ctx, q, u.Email, u.Username, u.PasswordHash, u.UpdatedAt, u.ID)
	return err
}

func (r *pgUserRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
	return err
}

func scanUser(row pgx.Row) (*models.User, error) {
	var u models.User
	err := row.Scan(&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}
