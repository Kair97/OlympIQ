package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"olympiq/backend/internal/models"
)

// LeetCodeService fetches and caches LeetCode data via alfa-leetcode-api.
type LeetCodeService struct {
	http    *http.Client
	baseURL string
	cache   CacheStore
}

// NewLeetCodeService constructs a LeetCodeService.
func NewLeetCodeService(baseURL string, cache CacheStore) *LeetCodeService {
	return &LeetCodeService{
		http:    &http.Client{Timeout: 10 * time.Second},
		baseURL: baseURL,
		cache:   cache,
	}
}

// GetProfile fetches /{handle}/profile with caching.
func (s *LeetCodeService) GetProfile(ctx context.Context, handle string) (*models.LeetCodeProfile, error) {
	key := fmt.Sprintf("lc:profile:%s", handle)
	var p models.LeetCodeProfile
	if err := s.getJSON(ctx, key, fmt.Sprintf("%s/%s/profile", s.baseURL, handle), &p); err != nil {
		return nil, err
	}
	return &p, nil
}

// GetContest fetches /{handle}/contest with caching.
func (s *LeetCodeService) GetContest(ctx context.Context, handle string) (*models.LeetCodeContest, error) {
	key := fmt.Sprintf("lc:contest:%s", handle)
	var c models.LeetCodeContest
	if err := s.getJSON(ctx, key, fmt.Sprintf("%s/%s/contest", s.baseURL, handle), &c); err != nil {
		return nil, err
	}
	return &c, nil
}

// GetAcSubmissions fetches /{handle}/acSubmission?limit=100 with caching.
func (s *LeetCodeService) GetAcSubmissions(ctx context.Context, handle string) ([]models.LeetCodeSubmission, error) {
	key := fmt.Sprintf("lc:acsub:%s", handle)
	if cached, err := s.cache.Get(ctx, key); err == nil {
		var wrapper struct {
			Submission []models.LeetCodeSubmission `json:"submission"`
		}
		if json.Unmarshal([]byte(cached), &wrapper) == nil {
			return wrapper.Submission, nil
		}
	}

	url := fmt.Sprintf("%s/%s/acSubmission?limit=100", s.baseURL, handle)
	body, err := s.doGet(ctx, url)
	if err != nil {
		return nil, err
	}

	var wrapper struct {
		Submission []models.LeetCodeSubmission `json:"submission"`
	}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		return nil, err
	}
	_ = s.cache.Set(ctx, key, string(body), time.Hour)
	return wrapper.Submission, nil
}

// GetSkill fetches /{handle}/skill with caching.
func (s *LeetCodeService) GetSkill(ctx context.Context, handle string) (*models.LeetCodeSkill, error) {
	key := fmt.Sprintf("lc:skill:%s", handle)
	var skill models.LeetCodeSkill
	if err := s.getJSON(ctx, key, fmt.Sprintf("%s/%s/skill", s.baseURL, handle), &skill); err != nil {
		return nil, err
	}
	return &skill, nil
}

// GetLanguageStats fetches /{handle}/languageStats with caching.
func (s *LeetCodeService) GetLanguageStats(ctx context.Context, handle string) ([]models.LeetCodeLanguageStat, error) {
	key := fmt.Sprintf("lc:lang:%s", handle)
	if cached, err := s.cache.Get(ctx, key); err == nil {
		// API may return plain array or wrapped object
		var direct []models.LeetCodeLanguageStat
		if json.Unmarshal([]byte(cached), &direct) == nil && len(direct) > 0 {
			return direct, nil
		}
		var wrapped struct {
			LanguageStats []models.LeetCodeLanguageStat `json:"languageStats"`
		}
		if json.Unmarshal([]byte(cached), &wrapped) == nil {
			return wrapped.LanguageStats, nil
		}
	}
	body, err := s.doGet(ctx, fmt.Sprintf("%s/%s/languageStats", s.baseURL, handle))
	if err != nil {
		return nil, err
	}
	var direct []models.LeetCodeLanguageStat
	if json.Unmarshal(body, &direct) == nil && len(direct) > 0 {
		_ = s.cache.Set(ctx, key, string(body), time.Hour)
		return direct, nil
	}
	var wrapped struct {
		LanguageStats []models.LeetCodeLanguageStat `json:"languageStats"`
	}
	if err := json.Unmarshal(body, &wrapped); err != nil {
		return nil, err
	}
	_ = s.cache.Set(ctx, key, string(body), time.Hour)
	return wrapped.LanguageStats, nil
}

// GetContestHistory fetches /{handle}/contest/history with caching.
func (s *LeetCodeService) GetContestHistory(ctx context.Context, handle string) ([]models.LeetCodeContestEntry, error) {
	key := fmt.Sprintf("lc:contest_hist:%s", handle)
	if cached, err := s.cache.Get(ctx, key); err == nil {
		var wrapper struct {
			ContestHistory []models.LeetCodeContestEntry `json:"contestHistory"`
		}
		if json.Unmarshal([]byte(cached), &wrapper) == nil {
			return wrapper.ContestHistory, nil
		}
	}
	body, err := s.doGet(ctx, fmt.Sprintf("%s/%s/contest/history", s.baseURL, handle))
	if err != nil {
		return nil, err
	}
	var wrapper struct {
		ContestHistory []models.LeetCodeContestEntry `json:"contestHistory"`
	}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		return nil, err
	}
	_ = s.cache.Set(ctx, key, string(body), time.Hour)
	return wrapper.ContestHistory, nil
}

// GetCalendar fetches /{handle}/calendar with caching and returns the raw JSON.
func (s *LeetCodeService) GetCalendar(ctx context.Context, handle string) (map[string]int, error) {
	key := fmt.Sprintf("lc:calendar:%s", handle)
	if cached, err := s.cache.Get(ctx, key); err == nil {
		var wrapper struct {
			SubmissionCalendar map[string]int `json:"submissionCalendar"`
		}
		if json.Unmarshal([]byte(cached), &wrapper) == nil {
			return wrapper.SubmissionCalendar, nil
		}
	}

	url := fmt.Sprintf("%s/%s/calendar", s.baseURL, handle)
	body, err := s.doGet(ctx, url)
	if err != nil {
		return nil, err
	}
	var wrapper struct {
		SubmissionCalendar map[string]int `json:"submissionCalendar"`
	}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		return nil, err
	}
	_ = s.cache.Set(ctx, key, string(body), time.Hour)
	return wrapper.SubmissionCalendar, nil
}

func (s *LeetCodeService) getJSON(ctx context.Context, cacheKey, url string, dest interface{}) error {
	if cached, err := s.cache.Get(ctx, cacheKey); err == nil {
		if json.Unmarshal([]byte(cached), dest) == nil {
			return nil
		}
	}
	body, err := s.doGet(ctx, url)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(body, dest); err != nil {
		return err
	}
	_ = s.cache.Set(ctx, cacheKey, string(body), time.Hour)
	return nil
}

func (s *LeetCodeService) doGet(ctx context.Context, url string) ([]byte, error) {
	var lastErr error
	for i := 0; i < 3; i++ {
		if i > 0 {
			time.Sleep(500 * time.Millisecond)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		resp, err := s.http.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound {
			return nil, fmt.Errorf("%w: handle not found", ErrNotFound)
		}
		body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
		if err != nil {
			return nil, err
		}
		return body, nil
	}
	return nil, fmt.Errorf("%w: %v", ErrExternal, lastErr)
}
