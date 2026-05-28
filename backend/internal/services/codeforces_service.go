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

const cfBaseURL = "https://codeforces.com/api"

// CFClient is the interface for fetching Codeforces data; mockable in tests.
type CFClient interface {
	GetUserInfo(ctx context.Context, handle string) (*models.CodeforcesUser, error)
	GetRatingHistory(ctx context.Context, handle string) ([]models.CodeforcesRatingChange, error)
	GetSubmissions(ctx context.Context, handle string, count int) ([]models.CodeforcesSubmission, error)
}

// CodeforcesService fetches and caches Codeforces data.
type CodeforcesService struct {
	http  *http.Client
	cache CacheStore
}

// NewCodeforcesService constructs a CodeforcesService.
func NewCodeforcesService(cache CacheStore) *CodeforcesService {
	return &CodeforcesService{
		http:  &http.Client{Timeout: 10 * time.Second},
		cache: cache,
	}
}

// GetUserInfo fetches user.info for the given handle (with Redis cache).
func (s *CodeforcesService) GetUserInfo(ctx context.Context, handle string) (*models.CodeforcesUser, error) {
	key := fmt.Sprintf("cf:info:%s", handle)

	if cached, err := s.cache.Get(ctx, key); err == nil {
		var u models.CodeforcesUser
		if json.Unmarshal([]byte(cached), &u) == nil {
			return &u, nil
		}
	}

	type cfResponse struct {
		Status string                  `json:"status"`
		Result []models.CodeforcesUser `json:"result"`
		Comment string                 `json:"comment"`
	}
	var resp cfResponse
	if err := s.doGet(ctx, fmt.Sprintf("%s/user.info?handles=%s", cfBaseURL, handle), &resp); err != nil {
		return nil, err
	}
	if resp.Status != "OK" {
		return nil, fmt.Errorf("%w: %s", ErrExternal, resp.Comment)
	}
	if len(resp.Result) == 0 {
		return nil, ErrNotFound
	}

	user := &resp.Result[0]
	if b, err := json.Marshal(user); err == nil {
		_ = s.cache.Set(ctx, key, string(b), time.Hour)
	}
	return user, nil
}

// GetRatingHistory fetches user.rating (contest history).
func (s *CodeforcesService) GetRatingHistory(ctx context.Context, handle string) ([]models.CodeforcesRatingChange, error) {
	key := fmt.Sprintf("cf:rating:%s", handle)

	if cached, err := s.cache.Get(ctx, key); err == nil {
		var hist []models.CodeforcesRatingChange
		if json.Unmarshal([]byte(cached), &hist) == nil {
			return hist, nil
		}
	}

	type cfResponse struct {
		Status  string                          `json:"status"`
		Result  []models.CodeforcesRatingChange `json:"result"`
		Comment string                          `json:"comment"`
	}
	var resp cfResponse
	if err := s.doGet(ctx, fmt.Sprintf("%s/user.rating?handle=%s", cfBaseURL, handle), &resp); err != nil {
		return nil, err
	}
	if resp.Status != "OK" {
		return nil, fmt.Errorf("%w: %s", ErrExternal, resp.Comment)
	}

	if b, err := json.Marshal(resp.Result); err == nil {
		_ = s.cache.Set(ctx, key, string(b), time.Hour)
	}
	return resp.Result, nil
}

// GetSubmissions fetches the last `count` submissions (user.status).
func (s *CodeforcesService) GetSubmissions(ctx context.Context, handle string, count int) ([]models.CodeforcesSubmission, error) {
	key := fmt.Sprintf("cf:status:%s", handle)

	if cached, err := s.cache.Get(ctx, key); err == nil {
		var subs []models.CodeforcesSubmission
		if json.Unmarshal([]byte(cached), &subs) == nil {
			return subs, nil
		}
	}

	type cfResponse struct {
		Status  string                        `json:"status"`
		Result  []models.CodeforcesSubmission `json:"result"`
		Comment string                        `json:"comment"`
	}
	url := fmt.Sprintf("%s/user.status?handle=%s&from=1&count=%d", cfBaseURL, handle, count)
	var resp cfResponse
	if err := s.doGet(ctx, url, &resp); err != nil {
		return nil, err
	}
	if resp.Status != "OK" {
		return nil, fmt.Errorf("%w: %s", ErrExternal, resp.Comment)
	}

	if b, err := json.Marshal(resp.Result); err == nil {
		_ = s.cache.Set(ctx, key, string(b), time.Hour)
	}
	return resp.Result, nil
}

// BuildTagFrequency returns a map of tag → solved count from a submission list.
func BuildTagFrequency(subs []models.CodeforcesSubmission) map[string]int {
	seen := make(map[string]bool)
	freq := make(map[string]int)
	for _, sub := range subs {
		if sub.Verdict != "OK" {
			continue
		}
		key := fmt.Sprintf("%d/%s", sub.Problem.ContestID, sub.Problem.Index)
		if seen[key] {
			continue
		}
		seen[key] = true
		for _, tag := range sub.Problem.Tags {
			freq[tag]++
		}
	}
	return freq
}

func (s *CodeforcesService) doGet(ctx context.Context, url string, dest interface{}) error {
	// CF rate-limit: respect by sleeping 500ms between calls if needed.
	time.Sleep(500 * time.Millisecond)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := s.http.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrExternal, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return err
	}
	return json.Unmarshal(body, dest)
}
