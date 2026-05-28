package services_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"olympiq/backend/internal/models"
	"olympiq/backend/internal/repository"
	"olympiq/backend/internal/services"
)

// ---- mock repositories ----

type mockUserRepo struct {
	users map[string]*models.User
}

func newMockUserRepo() *mockUserRepo {
	return &mockUserRepo{users: make(map[string]*models.User)}
}

func (m *mockUserRepo) Create(ctx context.Context, u *models.User) error {
	m.users[u.Email] = u
	return nil
}
func (m *mockUserRepo) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, repository.ErrNotFound
}
func (m *mockUserRepo) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	if u, ok := m.users[email]; ok {
		return u, nil
	}
	return nil, repository.ErrNotFound
}
func (m *mockUserRepo) FindByUsername(ctx context.Context, username string) (*models.User, error) {
	for _, u := range m.users {
		if u.Username == username {
			return u, nil
		}
	}
	return nil, repository.ErrNotFound
}
func (m *mockUserRepo) Update(ctx context.Context, u *models.User) error {
	m.users[u.Email] = u
	return nil
}
func (m *mockUserRepo) Delete(ctx context.Context, id uuid.UUID) error {
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

func (m *mockTokenRepo) Create(ctx context.Context, t *models.RefreshToken) error {
	m.tokens[t.TokenHash] = t
	return nil
}
func (m *mockTokenRepo) FindByHash(ctx context.Context, hash string) (*models.RefreshToken, error) {
	if t, ok := m.tokens[hash]; ok {
		return t, nil
	}
	return nil, repository.ErrNotFound
}
func (m *mockTokenRepo) DeleteByHash(ctx context.Context, hash string) error {
	delete(m.tokens, hash)
	return nil
}
func (m *mockTokenRepo) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	for k, t := range m.tokens {
		if t.UserID == userID {
			delete(m.tokens, k)
		}
	}
	return nil
}
func (m *mockTokenRepo) DeleteExpired(ctx context.Context) error { return nil }

// ---- test helpers ----

func generateTestKeys(t *testing.T) (string, string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	privBytes := x509.MarshalPKCS1PrivateKey(key)
	privPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: privBytes})
	privB64 := base64.StdEncoding.EncodeToString(privPEM)

	pubBytes, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	pubPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})
	pubB64 := base64.StdEncoding.EncodeToString(pubPEM)

	return privB64, pubB64
}

func newAuthService(t *testing.T, users *mockUserRepo, tokens *mockTokenRepo) *services.AuthService {
	t.Helper()
	priv, pub := generateTestKeys(t)
	svc, err := services.NewAuthService(users, tokens, priv, pub, 15*time.Minute, 7*24*time.Hour)
	require.NoError(t, err)
	return svc
}

// ---- tests ----

func TestRegister_Success(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	u, err := svc.Register(context.Background(), services.RegisterInput{
		Email: "a@b.com", Username: "alice", Password: "password123",
	})
	require.NoError(t, err)
	assert.Equal(t, "a@b.com", u.Email)
	assert.Equal(t, "alice", u.Username)
	assert.NotEqual(t, uuid.Nil, u.ID)
}

func TestRegister_DuplicateEmail(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	in := services.RegisterInput{Email: "a@b.com", Username: "alice", Password: "password123"}
	_, err := svc.Register(context.Background(), in)
	require.NoError(t, err)

	in.Username = "bob"
	_, err = svc.Register(context.Background(), in)
	assert.True(t, errors.Is(err, services.ErrConflict))
}

func TestRegister_DuplicateUsername(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	_, err := svc.Register(context.Background(), services.RegisterInput{Email: "a@b.com", Username: "alice", Password: "password123"})
	require.NoError(t, err)

	_, err = svc.Register(context.Background(), services.RegisterInput{Email: "c@d.com", Username: "alice", Password: "password123"})
	assert.True(t, errors.Is(err, services.ErrConflict))
}

func TestLogin_Success(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	_, err := svc.Register(context.Background(), services.RegisterInput{Email: "a@b.com", Username: "alice", Password: "password123"})
	require.NoError(t, err)

	u, pair, err := svc.Login(context.Background(), services.LoginInput{Email: "a@b.com", Password: "password123"})
	require.NoError(t, err)
	assert.Equal(t, "a@b.com", u.Email)
	assert.NotEmpty(t, pair.AccessToken)
	assert.NotEmpty(t, pair.RefreshToken)
}

func TestLogin_WrongPassword(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	_, err := svc.Register(context.Background(), services.RegisterInput{Email: "a@b.com", Username: "alice", Password: "password123"})
	require.NoError(t, err)

	_, _, err = svc.Login(context.Background(), services.LoginInput{Email: "a@b.com", Password: "wrongpassword"})
	assert.True(t, errors.Is(err, services.ErrUnauthorized))
}

func TestLogin_UnknownEmail(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	_, _, err := svc.Login(context.Background(), services.LoginInput{Email: "nobody@x.com", Password: "password123"})
	assert.True(t, errors.Is(err, services.ErrUnauthorized))
}

func TestRefresh_Success(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	_, err := svc.Register(context.Background(), services.RegisterInput{Email: "a@b.com", Username: "alice", Password: "password123"})
	require.NoError(t, err)

	_, pair, err := svc.Login(context.Background(), services.LoginInput{Email: "a@b.com", Password: "password123"})
	require.NoError(t, err)

	_, newPair, err := svc.Refresh(context.Background(), pair.RefreshToken)
	require.NoError(t, err)
	assert.NotEmpty(t, newPair.AccessToken)
	assert.NotEqual(t, pair.RefreshToken, newPair.RefreshToken)
}

func TestRefresh_InvalidToken(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	_, _, err := svc.Refresh(context.Background(), "invalidtoken")
	assert.True(t, errors.Is(err, services.ErrUnauthorized))
}

func TestLogout_ClearsToken(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	_, err := svc.Register(context.Background(), services.RegisterInput{Email: "a@b.com", Username: "alice", Password: "password123"})
	require.NoError(t, err)

	_, pair, err := svc.Login(context.Background(), services.LoginInput{Email: "a@b.com", Password: "password123"})
	require.NoError(t, err)

	err = svc.Logout(context.Background(), pair.RefreshToken)
	require.NoError(t, err)

	_, _, err = svc.Refresh(context.Background(), pair.RefreshToken)
	assert.True(t, errors.Is(err, services.ErrUnauthorized))
}

func TestParseAccessToken_Valid(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	_, err := svc.Register(context.Background(), services.RegisterInput{Email: "a@b.com", Username: "alice", Password: "password123"})
	require.NoError(t, err)

	_, pair, err := svc.Login(context.Background(), services.LoginInput{Email: "a@b.com", Password: "password123"})
	require.NoError(t, err)

	claims, err := svc.ParseAccessToken(pair.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, "a@b.com", claims.Email)
	assert.Equal(t, "alice", claims.Username)
}

func TestParseAccessToken_Invalid(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	_, err := svc.ParseAccessToken("not.a.token")
	assert.True(t, errors.Is(err, services.ErrUnauthorized))
}

func TestChangePassword_Success(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	u, err := svc.Register(context.Background(), services.RegisterInput{Email: "a@b.com", Username: "alice", Password: "oldpass123"})
	require.NoError(t, err)

	err = svc.ChangePassword(context.Background(), u.ID, "oldpass123", "newpass456")
	require.NoError(t, err)

	_, _, err = svc.Login(context.Background(), services.LoginInput{Email: "a@b.com", Password: "newpass456"})
	require.NoError(t, err)
}

func TestChangePassword_WrongCurrent(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	u, err := svc.Register(context.Background(), services.RegisterInput{Email: "a@b.com", Username: "alice", Password: "oldpass123"})
	require.NoError(t, err)

	err = svc.ChangePassword(context.Background(), u.ID, "wrongcurrent", "newpass456")
	assert.True(t, errors.Is(err, services.ErrUnauthorized))
}

func TestChangePassword_SameAsOld(t *testing.T) {
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	svc := newAuthService(t, users, tokens)

	u, err := svc.Register(context.Background(), services.RegisterInput{Email: "a@b.com", Username: "alice", Password: "oldpass123"})
	require.NoError(t, err)

	err = svc.ChangePassword(context.Background(), u.ID, "oldpass123", "oldpass123")
	assert.True(t, errors.Is(err, services.ErrBadRequest))
}
