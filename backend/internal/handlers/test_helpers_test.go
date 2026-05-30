package handlers_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"olympiq/backend/internal/models"
	"olympiq/backend/internal/repository"
	"olympiq/backend/internal/services"
)

// ---- in-memory repo mocks ----

type mockUserRepo struct {
	users map[string]*models.User
}

func newMockUserRepo() *mockUserRepo { return &mockUserRepo{users: make(map[string]*models.User)} }

func (m *mockUserRepo) Create(_ context.Context, u *models.User) error {
	m.users[u.Email] = u; return nil
}
func (m *mockUserRepo) FindByID(_ context.Context, id uuid.UUID) (*models.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, repository.ErrNotFound
}
func (m *mockUserRepo) FindByEmail(_ context.Context, email string) (*models.User, error) {
	if u, ok := m.users[email]; ok {
		return u, nil
	}
	return nil, repository.ErrNotFound
}
func (m *mockUserRepo) FindByUsername(_ context.Context, username string) (*models.User, error) {
	for _, u := range m.users {
		if u.Username == username {
			return u, nil
		}
	}
	return nil, repository.ErrNotFound
}
func (m *mockUserRepo) Update(_ context.Context, u *models.User) error {
	m.users[u.Email] = u; return nil
}
func (m *mockUserRepo) Delete(_ context.Context, id uuid.UUID) error {
	for k, u := range m.users {
		if u.ID == id {
			delete(m.users, k)
		}
	}
	return nil
}

type mockTokenRepo struct {
	tokens map[string]*models.RefreshToken
}

func newMockTokenRepo() *mockTokenRepo {
	return &mockTokenRepo{tokens: make(map[string]*models.RefreshToken)}
}

func (m *mockTokenRepo) Create(_ context.Context, t *models.RefreshToken) error {
	m.tokens[t.TokenHash] = t; return nil
}
func (m *mockTokenRepo) FindByHash(_ context.Context, hash string) (*models.RefreshToken, error) {
	if t, ok := m.tokens[hash]; ok {
		return t, nil
	}
	return nil, repository.ErrNotFound
}
func (m *mockTokenRepo) ListByUserID(_ context.Context, userID uuid.UUID) ([]*models.RefreshToken, error) {
	var out []*models.RefreshToken
	for _, t := range m.tokens {
		if t.UserID == userID {
			out = append(out, t)
		}
	}
	return out, nil
}
func (m *mockTokenRepo) DeleteByHash(_ context.Context, hash string) error {
	delete(m.tokens, hash); return nil
}
func (m *mockTokenRepo) DeleteByID(_ context.Context, id uuid.UUID, userID uuid.UUID) error {
	for k, t := range m.tokens {
		if t.ID == id && t.UserID == userID {
			delete(m.tokens, k)
			return nil
		}
	}
	return repository.ErrNotFound
}
func (m *mockTokenRepo) DeleteByUserID(_ context.Context, userID uuid.UUID) error {
	for k, t := range m.tokens {
		if t.UserID == userID {
			delete(m.tokens, k)
		}
	}
	return nil
}
func (m *mockTokenRepo) DeleteExpired(_ context.Context) error { return nil }

// ---- auth service factory ----

func newTestAuthService(t *testing.T, users repository.UserRepository, tokens repository.TokenRepository) *services.AuthService {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	privBytes := x509.MarshalPKCS1PrivateKey(key)
	privPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: privBytes})

	pubBytes, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	pubPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})

	svc, err := services.NewAuthService(
		users, tokens,
		base64.StdEncoding.EncodeToString(privPEM),
		base64.StdEncoding.EncodeToString(pubPEM),
		15*time.Minute, 7*24*time.Hour,
	)
	require.NoError(t, err)
	return svc
}
