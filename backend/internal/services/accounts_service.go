package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"olympiq/backend/internal/models"
	"olympiq/backend/internal/repository"
)

// AccountsService handles connect/disconnect of platform accounts.
type AccountsService struct {
	platforms repository.PlatformRepository
	cache     CacheStore
	cf        *CodeforcesService
	lc        *LeetCodeService
}

// NewAccountsService constructs an AccountsService.
func NewAccountsService(
	platforms repository.PlatformRepository,
	cache CacheStore,
	cf *CodeforcesService,
	lc *LeetCodeService,
) *AccountsService {
	return &AccountsService{platforms: platforms, cache: cache, cf: cf, lc: lc}
}

// ConnectInput is the validated payload for connecting a platform.
type ConnectInput struct {
	Platform string `json:"platform" validate:"required,oneof=codeforces leetcode"`
	Handle   string `json:"handle"   validate:"required,min=1,max=60"`
}

// Connect validates the handle with the external API then saves it.
func (s *AccountsService) Connect(ctx context.Context, userID uuid.UUID, in ConnectInput) (*models.PlatformAccount, error) {
	existing, err := s.platforms.FindByUserIDAndPlatform(ctx, userID, in.Platform)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("%w: %s already connected", ErrConflict, in.Platform)
	}

	switch in.Platform {
	case "codeforces":
		if _, err := s.cf.GetUserInfo(ctx, in.Handle); err != nil {
			return nil, fmt.Errorf("%w: codeforces handle not found", ErrBadRequest)
		}
	case "leetcode":
		if _, err := s.lc.GetProfile(ctx, in.Handle); err != nil {
			return nil, fmt.Errorf("%w: leetcode handle not found", ErrBadRequest)
		}
	}

	acc := &models.PlatformAccount{
		ID:       uuid.New(),
		UserID:   userID,
		Platform: in.Platform,
		Handle:   in.Handle,
	}
	if err := s.platforms.Upsert(ctx, acc); err != nil {
		return nil, err
	}
	return acc, nil
}

// Disconnect removes a platform account and clears its Redis cache.
func (s *AccountsService) Disconnect(ctx context.Context, userID uuid.UUID, platform string) error {
	acc, err := s.platforms.FindByUserIDAndPlatform(ctx, userID, platform)
	if err != nil {
		return ErrNotFound
	}

	switch platform {
	case "codeforces":
		_ = s.cache.Del(ctx,
			fmt.Sprintf("cf:info:%s", acc.Handle),
			fmt.Sprintf("cf:rating:%s", acc.Handle),
			fmt.Sprintf("cf:status:%s", acc.Handle),
		)
	case "leetcode":
		_ = s.cache.Del(ctx,
			fmt.Sprintf("lc:profile:%s", acc.Handle),
			fmt.Sprintf("lc:contest:%s", acc.Handle),
			fmt.Sprintf("lc:acsub:%s", acc.Handle),
			fmt.Sprintf("lc:skill:%s", acc.Handle),
			fmt.Sprintf("lc:calendar:%s", acc.Handle),
		)
	}

	return s.platforms.Delete(ctx, userID, platform)
}

// ListAccounts returns all connected platform accounts for a user.
func (s *AccountsService) ListAccounts(ctx context.Context, userID uuid.UUID) ([]*models.PlatformAccount, error) {
	return s.platforms.ListByUserID(ctx, userID)
}

// UpdateLastSynced stamps the sync time on a platform account.
func (s *AccountsService) UpdateLastSynced(ctx context.Context, userID uuid.UUID, platform string) error {
	return s.platforms.UpdateLastSynced(ctx, userID, platform, time.Now().UTC())
}
