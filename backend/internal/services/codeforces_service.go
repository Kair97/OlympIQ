package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"olympiq/backend/internal/models"
)

const defaultCFBaseURL = "https://codeforces.com/api"

// CFClient is the interface for fetching Codeforces data; mockable in tests.
type CFClient interface {
	GetUserInfo(ctx context.Context, handle string) (*models.CodeforcesUser, error)
	GetRatingHistory(ctx context.Context, handle string) ([]models.CodeforcesRatingChange, error)
	GetSubmissions(ctx context.Context, handle string, count int) ([]models.CodeforcesSubmission, error)
}

// CodeforcesService fetches and caches Codeforces data.
type CodeforcesService struct {
	http    *http.Client
	baseURL string
	cache   CacheStore
}

// NewCodeforcesService constructs a CodeforcesService.
func NewCodeforcesService(cache CacheStore) *CodeforcesService {
	return &CodeforcesService{
		http:    &http.Client{Timeout: 10 * time.Second},
		baseURL: defaultCFBaseURL,
		cache:   cache,
	}
}

// GetUserInfo fetches user.info for the given handle (with Redis cache).
func (s *CodeforcesService) GetUserInfo(ctx context.Context, handle string) (*models.CodeforcesUser, error) {
	handle = strings.TrimSpace(handle)
	if handle == "" {
		return nil, fmt.Errorf("%w: Codeforces handle is required", ErrBadRequest)
	}
	key := fmt.Sprintf("cf:info:%s", handle)

	if cached, err := s.cache.Get(ctx, key); err == nil {
		var u models.CodeforcesUser
		if json.Unmarshal([]byte(cached), &u) == nil {
			return &u, nil
		}
	}

	type cfResponse struct {
		Status  string                  `json:"status"`
		Result  []models.CodeforcesUser `json:"result"`
		Comment string                  `json:"comment"`
	}
	var resp cfResponse
	if err := s.doGet(ctx, fmt.Sprintf("%s/user.info?handles=%s", s.baseURL, url.QueryEscape(handle)), &resp); err != nil {
		return nil, err
	}
	if resp.Status != "OK" {
		return nil, codeforcesAPIError(resp.Comment)
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
	handle = strings.TrimSpace(handle)
	if handle == "" {
		return nil, fmt.Errorf("%w: Codeforces handle is required", ErrBadRequest)
	}
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
	if err := s.doGet(ctx, fmt.Sprintf("%s/user.rating?handle=%s", s.baseURL, url.QueryEscape(handle)), &resp); err != nil {
		return nil, err
	}
	if resp.Status != "OK" {
		return nil, codeforcesAPIError(resp.Comment)
	}

	if b, err := json.Marshal(resp.Result); err == nil {
		_ = s.cache.Set(ctx, key, string(b), time.Hour)
	}
	return resp.Result, nil
}

// GetSubmissions fetches the last `count` submissions (user.status).
func (s *CodeforcesService) GetSubmissions(ctx context.Context, handle string, count int) ([]models.CodeforcesSubmission, error) {
	handle = strings.TrimSpace(handle)
	if handle == "" {
		return nil, fmt.Errorf("%w: Codeforces handle is required", ErrBadRequest)
	}
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
	requestURL := fmt.Sprintf("%s/user.status?handle=%s&from=1&count=%d", s.baseURL, url.QueryEscape(handle), count)
	var resp cfResponse
	if err := s.doGet(ctx, requestURL, &resp); err != nil {
		return nil, err
	}
	if resp.Status != "OK" {
		return nil, codeforcesAPIError(resp.Comment)
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
		key := codeforcesProblemKey(sub.Problem)
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

func codeforcesProblemKey(p models.CodeforcesProblem) string {
	if p.ContestID > 0 && p.Index != "" {
		return fmt.Sprintf("%d/%s", p.ContestID, p.Index)
	}
	return strings.ToLower(strings.TrimSpace(p.Name + "/" + p.Index))
}

func codeforcesAPIError(comment string) error {
	message := strings.TrimSpace(comment)
	if message == "" {
		message = "Codeforces returned an error"
	}
	lower := strings.ToLower(message)
	switch {
	case strings.Contains(lower, "not found"):
		return fmt.Errorf("%w: Codeforces handle not found", ErrBadRequest)
	case strings.Contains(lower, "handle") && strings.Contains(lower, "invalid"):
		return fmt.Errorf("%w: invalid Codeforces handle", ErrBadRequest)
	default:
		return fmt.Errorf("%w: Codeforces API: %s", ErrExternal, message)
	}
}

func (s *CodeforcesService) doGet(ctx context.Context, url string, dest interface{}) error {
	// CF rate-limit: respect by sleeping 500ms between calls if needed.
	time.Sleep(500 * time.Millisecond)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "OlympIQ/1.0 (+https://github.com/Kair97/OlympIQ)")
	resp, err := s.http.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrExternal, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return fmt.Errorf("%w: reading Codeforces response: %v", ErrExternal, err)
	}
	if resp.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("%w: Codeforces returned HTTP %d", ErrExternal, resp.StatusCode)
	}
	if err := json.Unmarshal(body, dest); err != nil {
		return fmt.Errorf("%w: invalid Codeforces response: %v", ErrExternal, err)
	}
	return nil
}
