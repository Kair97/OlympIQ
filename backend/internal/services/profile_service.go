package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"olympiq/backend/internal/models"
	"olympiq/backend/internal/repository"
)

// ProfileService handles user profile reads and updates.
type ProfileService struct {
	users  repository.UserRepository
	tokens repository.TokenRepository
}

// NewProfileService constructs a ProfileService.
func NewProfileService(users repository.UserRepository, tokens repository.TokenRepository) *ProfileService {
	return &ProfileService{users: users, tokens: tokens}
}

// GetProfile returns the user's profile by ID.
func (s *ProfileService) GetProfile(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return nil, ErrNotFound
	}
	return u, nil
}

// UpdateProfileInput is the validated payload for profile updates.
type UpdateProfileInput struct {
	Email    string `json:"email"    validate:"omitempty,email"`
	Username string `json:"username" validate:"omitempty,min=3,max=30,alphanum"`
}

// UpdateProfile applies email/username changes.
func (s *ProfileService) UpdateProfile(ctx context.Context, userID uuid.UUID, in UpdateProfileInput) (*models.User, error) {
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return nil, ErrNotFound
	}

	if in.Email != "" && in.Email != u.Email {
		if _, err := s.users.FindByEmail(ctx, in.Email); err == nil {
			return nil, fmt.Errorf("%w: email already in use", ErrConflict)
		}
		u.Email = in.Email
	}
	if in.Username != "" && in.Username != u.Username {
		if _, err := s.users.FindByUsername(ctx, in.Username); err == nil {
			return nil, fmt.Errorf("%w: username already taken", ErrConflict)
		}
		u.Username = in.Username
	}

	u.UpdatedAt = time.Now().UTC()
	if err := s.users.Update(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

// DeleteAccount permanently removes the user and all their data.
func (s *ProfileService) DeleteAccount(ctx context.Context, userID uuid.UUID) error {
	if err := s.tokens.DeleteByUserID(ctx, userID); err != nil {
		return err
	}
	return s.users.Delete(ctx, userID)
}
