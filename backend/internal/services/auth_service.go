package services

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"olympiq/backend/internal/models"
	"olympiq/backend/internal/repository"
)

const bcryptCost = 12

// AccessClaims are the JWT payload fields for access tokens.
type AccessClaims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// AuthService handles registration, login, token management.
type AuthService struct {
	users      repository.UserRepository
	tokens     repository.TokenRepository
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
	accessTTL  time.Duration
	refreshTTL time.Duration
}

// NewAuthService constructs an AuthService, loading RSA keys from base64-encoded PEM env values.
func NewAuthService(
	users repository.UserRepository,
	tokens repository.TokenRepository,
	privKeyB64, pubKeyB64 string,
	accessTTL, refreshTTL time.Duration,
) (*AuthService, error) {
	priv, pub, err := loadRSAKeys(privKeyB64, pubKeyB64)
	if err != nil {
		return nil, fmt.Errorf("load RSA keys: %w", err)
	}
	return &AuthService{
		users:      users,
		tokens:     tokens,
		privateKey: priv,
		publicKey:  pub,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}, nil
}

// RegisterInput is the validated payload for registration.
type RegisterInput struct {
	Email    string `json:"email"    validate:"required,email"`
	Username string `json:"username" validate:"required,min=3,max=30,username"`
	Password string `json:"password" validate:"required,min=8"`
}

// Register creates a new user account.
func (s *AuthService) Register(ctx context.Context, in RegisterInput) (*models.User, error) {
	if _, err := s.users.FindByEmail(ctx, in.Email); err == nil {
		return nil, fmt.Errorf("%w: email already registered", ErrConflict)
	}
	if _, err := s.users.FindByUsername(ctx, in.Username); err == nil {
		return nil, fmt.Errorf("%w: username already taken", ErrConflict)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	now := time.Now().UTC()
	u := &models.User{
		ID:           uuid.New(),
		Email:        in.Email,
		Username:     in.Username,
		PasswordHash: string(hash),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

// LoginInput is the validated payload for login.
type LoginInput struct {
	Email    string `json:"email"    validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// TokenPair holds both tokens returned after login or refresh.
type TokenPair struct {
	AccessToken  string
	RefreshToken string
	AccessExp    time.Time
	RefreshExp   time.Time
}

// Login verifies credentials and returns a token pair.
func (s *AuthService) Login(ctx context.Context, in LoginInput) (*models.User, *TokenPair, error) {
	u, err := s.users.FindByEmail(ctx, in.Email)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, nil, ErrUnauthorized
	}
	if err != nil {
		return nil, nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Password)); err != nil {
		return nil, nil, ErrUnauthorized
	}

	pair, err := s.issueTokenPair(ctx, u)
	if err != nil {
		return nil, nil, err
	}
	return u, pair, nil
}

// Refresh rotates the refresh token and issues a new access token.
func (s *AuthService) Refresh(ctx context.Context, rawRefreshToken string) (*models.User, *TokenPair, error) {
	hash := hashToken(rawRefreshToken)
	rt, err := s.tokens.FindByHash(ctx, hash)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, nil, ErrUnauthorized
	}
	if err != nil {
		return nil, nil, err
	}
	if time.Now().After(rt.ExpiresAt) {
		return nil, nil, ErrUnauthorized
	}

	u, err := s.users.FindByID(ctx, rt.UserID)
	if err != nil {
		return nil, nil, err
	}

	if err := s.tokens.DeleteByHash(ctx, hash); err != nil {
		return nil, nil, err
	}

	pair, err := s.issueTokenPair(ctx, u)
	if err != nil {
		return nil, nil, err
	}
	return u, pair, nil
}

// Logout invalidates the given refresh token.
func (s *AuthService) Logout(ctx context.Context, rawRefreshToken string) error {
	hash := hashToken(rawRefreshToken)
	return s.tokens.DeleteByHash(ctx, hash)
}

// ParseAccessToken validates a JWT access token and returns the claims.
func (s *AuthService) ParseAccessToken(tokenStr string) (*AccessClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &AccessClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.publicKey, nil
	})
	if err != nil {
		return nil, ErrUnauthorized
	}
	claims, ok := token.Claims.(*AccessClaims)
	if !ok || !token.Valid {
		return nil, ErrUnauthorized
	}
	return claims, nil
}

// ChangePassword verifies the current password and sets a new one.
func (s *AuthService) ChangePassword(ctx context.Context, userID uuid.UUID, current, newPw string) error {
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return ErrNotFound
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(current)); err != nil {
		return ErrUnauthorized
	}
	if current == newPw {
		return fmt.Errorf("%w: new password must differ from current", ErrBadRequest)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPw), bcryptCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hash)
	u.UpdatedAt = time.Now().UTC()
	return s.users.Update(ctx, u)
}

// IssueTokens creates a fresh token pair for an already-authenticated user.
// Used by the Register handler to auto-login after account creation.
func (s *AuthService) IssueTokens(ctx context.Context, u *models.User) (*TokenPair, error) {
	return s.issueTokenPair(ctx, u)
}

func (s *AuthService) issueTokenPair(ctx context.Context, u *models.User) (*TokenPair, error) {
	now := time.Now().UTC()
	accessExp := now.Add(s.accessTTL)
	claims := &AccessClaims{
		UserID:   u.ID.String(),
		Email:    u.Email,
		Username: u.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   u.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(accessExp),
		},
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	rawRefresh := make([]byte, 32)
	if _, err := rand.Read(rawRefresh); err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}
	rawRefreshStr := hex.EncodeToString(rawRefresh)
	refreshExp := now.Add(s.refreshTTL)

	rt := &models.RefreshToken{
		ID:        uuid.New(),
		UserID:    u.ID,
		TokenHash: hashToken(rawRefreshStr),
		ExpiresAt: refreshExp,
		CreatedAt: now,
	}
	if err := s.tokens.Create(ctx, rt); err != nil {
		return nil, fmt.Errorf("store refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: rawRefreshStr,
		AccessExp:    accessExp,
		RefreshExp:   refreshExp,
	}, nil
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func loadRSAKeys(privB64, pubB64 string) (*rsa.PrivateKey, *rsa.PublicKey, error) {
	privPEM, err := base64.StdEncoding.DecodeString(privB64)
	if err != nil {
		return nil, nil, fmt.Errorf("decode private key base64: %w", err)
	}
	block, _ := pem.Decode(privPEM)
	if block == nil {
		return nil, nil, errors.New("invalid private key PEM")
	}

	// Support both PKCS#1 (openssl genrsa legacy) and PKCS#8 (openssl 3.x default).
	var priv *rsa.PrivateKey
	switch block.Type {
	case "RSA PRIVATE KEY":
		priv, err = x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return nil, nil, fmt.Errorf("parse PKCS1 private key: %w", err)
		}
	case "PRIVATE KEY":
		key, pkcs8Err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if pkcs8Err != nil {
			return nil, nil, fmt.Errorf("parse PKCS8 private key: %w", pkcs8Err)
		}
		var ok bool
		priv, ok = key.(*rsa.PrivateKey)
		if !ok {
			return nil, nil, errors.New("PKCS8 key is not RSA")
		}
	default:
		return nil, nil, fmt.Errorf("unsupported private key type: %s", block.Type)
	}

	pubPEM, err := base64.StdEncoding.DecodeString(pubB64)
	if err != nil {
		return nil, nil, fmt.Errorf("decode public key base64: %w", err)
	}
	block, _ = pem.Decode(pubPEM)
	if block == nil {
		return nil, nil, errors.New("invalid public key PEM")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, nil, fmt.Errorf("parse public key: %w", err)
	}
	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, nil, errors.New("public key is not RSA")
	}
	return priv, rsaPub, nil
}
