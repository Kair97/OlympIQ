package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"olympiq/backend/internal/models"
	"olympiq/backend/internal/repository"
)

// StatsService orchestrates syncing stats from external APIs into the DB.
type StatsService struct {
	platforms repository.PlatformRepository
	stats     repository.StatsRepository
	cf        *CodeforcesService
	lc        *LeetCodeService
}

// NewStatsService constructs a StatsService.
func NewStatsService(
	platforms repository.PlatformRepository,
	stats repository.StatsRepository,
	cf *CodeforcesService,
	lc *LeetCodeService,
) *StatsService {
	return &StatsService{platforms: platforms, stats: stats, cf: cf, lc: lc}
}

// SyncAll syncs all connected platform accounts for a user.
func (s *StatsService) SyncAll(ctx context.Context, userID uuid.UUID) error {
	accounts, err := s.platforms.ListByUserID(ctx, userID)
	if err != nil {
		return err
	}
	for _, acc := range accounts {
		switch acc.Platform {
		case "codeforces":
			if err := s.syncCF(ctx, userID, acc.Handle); err != nil {
				return fmt.Errorf("codeforces sync: %w", err)
			}
		case "leetcode":
			if err := s.syncLC(ctx, userID, acc.Handle); err != nil {
				return fmt.Errorf("leetcode sync: %w", err)
			}
		}
		now := time.Now().UTC()
		_ = s.platforms.UpdateLastSynced(ctx, userID, acc.Platform, now)
	}
	return nil
}

// GetLatestStats returns the most recent stats for all connected platforms.
func (s *StatsService) GetLatestStats(ctx context.Context, userID uuid.UUID) ([]*models.UserStats, error) {
	return s.stats.ListByUserID(ctx, userID)
}

func (s *StatsService) syncCF(ctx context.Context, userID uuid.UUID, handle string) error {
	info, err := s.cf.GetUserInfo(ctx, handle)
	if err != nil {
		return err
	}
	subs, err := s.cf.GetSubmissions(ctx, handle, 500)
	if err != nil {
		return err
	}

	rawData := map[string]interface{}{
		"user":        info,
		"tag_freq":    BuildTagFrequency(subs),
		"sub_count":   len(subs),
	}
	rawJSON, _ := json.Marshal(rawData)

	rating := info.Rating
	rank := info.Rank
	maxRating := info.MaxRating
	now := time.Now().UTC()

	stat := &models.UserStats{
		ID:        uuid.New(),
		UserID:    userID,
		Platform:  "codeforces",
		Rating:    &rating,
		Rank:      &rank,
		MaxRating: &maxRating,
		RawData:   rawJSON,
		FetchedAt: now,
	}
	return s.stats.Insert(ctx, stat)
}

func (s *StatsService) syncLC(ctx context.Context, userID uuid.UUID, handle string) error {
	profile, err := s.lc.GetProfile(ctx, handle)
	if err != nil {
		return err
	}
	contest, err := s.lc.GetContest(ctx, handle)
	if err != nil {
		return err
	}

	rawData := map[string]interface{}{
		"profile": profile,
		"contest": contest,
	}
	rawJSON, _ := json.Marshal(rawData)

	solved := profile.TotalSolved
	contestRating := int(contest.ContestRating)
	rank := fmt.Sprintf("#%d", profile.Ranking)
	now := time.Now().UTC()

	stat := &models.UserStats{
		ID:             uuid.New(),
		UserID:         userID,
		Platform:       "leetcode",
		Rating:         &contestRating,
		Rank:           &rank,
		ProblemsSolved: &solved,
		RawData:        rawJSON,
		FetchedAt:      now,
	}
	return s.stats.Insert(ctx, stat)
}
