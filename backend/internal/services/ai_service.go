package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"olympiq/backend/internal/models"
	"olympiq/backend/internal/repository"
)

// StudentContext aggregates all user data needed for AI prompts.
type StudentContext struct {
	CFHandle       string
	CFRating       int
	CFRank         string
	CFMaxRating    int
	CFTagFreq      map[string]int
	CFRecentRating []models.CodeforcesRatingChange
	CFSolvedKeys   []string

	LCHandle        string
	LCRanking       int
	LCTotalSolved   int
	LCEasy          int
	LCMedium        int
	LCHard          int
	LCContestRating float64
	LCWeakTopics    []string
	LCSolvedSlugs   []string
	LCTopics        map[string]int // full topic → problems_solved map

	Goals *models.UserGoal
}

// AIService handles AI calls through n8n workflows.
type AIService struct {
	n8nAnalyzerURL    string
	n8nRoadmapURL     string
	n8nRecommenderURL string
	difyAnalyzerURL   string
	difyAnalyzerKey   string
	http              *http.Client
	platforms         repository.PlatformRepository
	stats             repository.StatsRepository
	goals             repository.GoalsRepository
	cache             CacheStore
	cf                *CodeforcesService
	lc                *LeetCodeService
}

// NewAIService constructs an AIService.
func NewAIService(
	n8nAnalyzerURL, n8nRoadmapURL, n8nRecommenderURL string,
	difyAnalyzerURL, difyAnalyzerKey string,
	platforms repository.PlatformRepository,
	stats repository.StatsRepository,
	goals repository.GoalsRepository,
	cache CacheStore,
	cf *CodeforcesService,
	lc *LeetCodeService,
) *AIService {
	return &AIService{
		n8nAnalyzerURL:    n8nAnalyzerURL,
		n8nRoadmapURL:     n8nRoadmapURL,
		n8nRecommenderURL: n8nRecommenderURL,
		difyAnalyzerURL:   difyAnalyzerURL,
		difyAnalyzerKey:   difyAnalyzerKey,
		// n8n normally answers in 8-30s; 60s covers cold starts. Must stay well
		// under the frontend nginx proxy_read_timeout (150s) even when the
		// handler falls back to a second n8n call after a first timeout.
		http: &http.Client{Timeout: 60 * time.Second},
		platforms:         platforms,
		stats:             stats,
		goals:             goals,
		cache:             cache,
		cf:                cf,
		lc:                lc,
	}
}

// BuildStudentContext assembles all user data for AI prompts.
// It fetches live data from CF and LC APIs (using Redis cache where available).
// Returns ErrBadRequest if no platforms are connected.
func (s *AIService) BuildStudentContext(ctx context.Context, userID uuid.UUID) (*StudentContext, error) {
	sc := &StudentContext{}

	accounts, err := s.platforms.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(accounts) == 0 {
		return nil, fmt.Errorf("%w: no platforms connected — connect Codeforces or LeetCode in your profile first, then sync", ErrBadRequest)
	}

	for _, acc := range accounts {
		switch acc.Platform {
		case "codeforces":
			sc.CFHandle = acc.Handle

			info, cfErr := s.cf.GetUserInfo(ctx, acc.Handle)
			if cfErr == nil && info != nil {
				sc.CFRating = info.Rating
				sc.CFRank = info.Rank
				sc.CFMaxRating = info.MaxRating
			}

			subs, _ := s.cf.GetSubmissions(ctx, acc.Handle, 500)
			if len(subs) > 0 {
				sc.CFTagFreq = BuildTagFrequency(subs)
				seen := make(map[string]bool)
				for _, sub := range subs {
					if sub.Verdict == "OK" {
						k := codeforcesProblemKey(sub.Problem)
						if !seen[k] {
							seen[k] = true
							sc.CFSolvedKeys = append(sc.CFSolvedKeys, k)
						}
					}
				}
			}

			hist, _ := s.cf.GetRatingHistory(ctx, acc.Handle)
			if len(hist) > 24 {
				sc.CFRecentRating = hist[len(hist)-24:]
			} else {
				sc.CFRecentRating = hist
			}

		case "leetcode":
			sc.LCHandle = acc.Handle

			profile, _ := s.lc.GetProfile(ctx, acc.Handle)
			if profile != nil {
				sc.LCRanking = profile.Ranking
				sc.LCTotalSolved = profile.TotalSolved
				sc.LCEasy = profile.EasySolved
				sc.LCMedium = profile.MediumSolved
				sc.LCHard = profile.HardSolved
			}

			contest, _ := s.lc.GetContest(ctx, acc.Handle)
			if contest != nil {
				sc.LCContestRating = contest.ContestRating
			}

			// Fetch all accepted submissions for solved list
			subs, _ := s.lc.GetAcSubmissions(ctx, acc.Handle)
			for _, sub := range subs {
				sc.LCSolvedSlugs = append(sc.LCSolvedSlugs, sub.TitleSlug)
			}

			// Fetch full topic skill breakdown
			skill, _ := s.lc.GetSkill(ctx, acc.Handle)
			if skill != nil {
				allTags := append(skill.Fundamental, skill.Intermediate...)
				allTags = append(allTags, skill.Advanced...)
				sc.LCTopics = make(map[string]int, len(allTags))
				for _, t := range allTags {
					sc.LCTopics[t.TagName] = t.ProblemsSolved
					if t.ProblemsSolved < 5 {
						sc.LCWeakTopics = append(sc.LCWeakTopics, t.TagName)
					}
				}
			}
		}
	}

	goal, _ := s.goals.FindByUserID(ctx, userID)
	sc.Goals = goal

	return sc, nil
}

// TestConnection verifies that the required n8n webhook URLs are configured.
func (s *AIService) TestConnection(ctx context.Context) (string, error) {
	_ = ctx
	var missing []string
	if s.n8nAnalyzerURL == "" {
		missing = append(missing, "N8N_ANALYZER_URL")
	}
	if s.n8nRoadmapURL == "" {
		missing = append(missing, "N8N_ROADMAP_URL")
	}
	if len(missing) > 0 {
		return "", fmt.Errorf("%w: missing %s", ErrExternal, strings.Join(missing, ", "))
	}
	return "n8n AI workflows are configured", nil
}

// GenerateRoadmap generates a roadmap through the n8n roadmap workflow.
func (s *AIService) GenerateRoadmap(ctx context.Context, sc *StudentContext, mode string) (string, error) {
	if s.n8nRoadmapURL == "" {
		return "", fmt.Errorf("%w: N8N_ROADMAP_URL is not configured", ErrExternal)
	}
	return s.callN8NRoadmap(ctx, sc, mode)
}

// callN8NRoadmap sends the full user context to the n8n roadmap webhook.
// It builds the exact payload format the n8n agent expects.
func (s *AIService) callN8NRoadmap(ctx context.Context, sc *StudentContext, mode string) (string, error) {
	// Pick username — prefer CF handle, fall back to LC
	username := sc.CFHandle
	if username == "" {
		username = sc.LCHandle
	}

	weeklyHours := 15
	if sc.Goals != nil && sc.Goals.WeeklyHours != nil {
		weeklyHours = *sc.Goals.WeeklyHours
	}

	if mode == "" {
		mode = "all"
	}

	payload := map[string]interface{}{
		"username":     username,
		"mode":         mode,
		"weekly_hours": weeklyHours,
	}

	// Codeforces data
	if sc.CFHandle != "" {
		cfTopics := normalizeCFTopics(sc.CFTagFreq)
		if cfTopics == nil {
			cfTopics = make(map[string]int)
		}
		ratingHistory := make([]int, 0, len(sc.CFRecentRating))
		for _, r := range sc.CFRecentRating {
			ratingHistory = append(ratingHistory, r.NewRating)
		}
		payload["codeforces"] = map[string]interface{}{
			"rating":          sc.CFRating,
			"rank":            orNA(sc.CFRank),
			"problems_solved": len(sc.CFSolvedKeys),
			"topics":          cfTopics,
			"rating_history":  ratingHistory,
		}
	}

	// LeetCode data
	if sc.LCHandle != "" {
		lcTopics := sc.LCTopics
		if lcTopics == nil {
			lcTopics = make(map[string]int)
		}
		payload["leetcode"] = map[string]interface{}{
			"total_solved": sc.LCTotalSolved,
			"easy":         sc.LCEasy,
			"medium":       sc.LCMedium,
			"hard":         sc.LCHard,
			"topics":       lcTopics,
		}
	}

	// Goals
	if sc.Goals != nil {
		payload["goal"] = sc.Goals.GoalType
		if sc.Goals.TargetDate != nil {
			payload["deadline"] = sc.Goals.TargetDate.Format("2006-01-02")
		}
		if sc.Goals.TargetRating != nil {
			payload["target_rating"] = *sc.Goals.TargetRating
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("%w: failed to build n8n roadmap request: %v", ErrExternal, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.n8nRoadmapURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrExternal, err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: n8n roadmap request failed: %v", ErrExternal, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return "", fmt.Errorf("%w: failed to read n8n roadmap response: %v", ErrExternal, err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%w: n8n roadmap returned status %d: %s", ErrExternal, resp.StatusCode, string(respBody))
	}

	// Unwrap n8n envelope: [{"output":"...json..."}]
	cleaned := stripMarkdownFences(strings.TrimSpace(string(respBody)))
	if strings.HasPrefix(cleaned, "[") {
		var envelope []map[string]json.RawMessage
		if json.Unmarshal([]byte(cleaned), &envelope) == nil && len(envelope) > 0 {
			for _, key := range []string{"output", "json", "text", "result"} {
				if raw, ok := envelope[0][key]; ok {
					inner := strings.TrimSpace(string(raw))
					if strings.HasPrefix(inner, `"`) {
						var s string
						if json.Unmarshal(raw, &s) == nil {
							cleaned = stripMarkdownFences(s)
							break
						}
					} else {
						cleaned = inner
						break
					}
				}
			}
		}
	}
	return cleaned, nil
}

// AnalyzeProblem analyzes a problem. It prefers the Dify workflow when configured
// and falls back to the n8n analyzer workflow if Dify is not set up or fails.
func (s *AIService) AnalyzeProblem(ctx context.Context, problemURL string) (string, error) {
	if s.difyAnalyzerKey != "" {
		result, err := s.callDifyAnalyzer(ctx, problemURL)
		if err == nil && result != "" {
			return result, nil
		}
		// Dify failed — fall through to n8n if available, otherwise surface the error.
		if s.n8nAnalyzerURL == "" {
			return "", err
		}
	}
	if s.n8nAnalyzerURL == "" {
		return "", fmt.Errorf("%w: no analyzer configured (set DIFY_ANALYZER_KEY or N8N_ANALYZER_URL)", ErrExternal)
	}
	return s.callN8NAnalyzer(ctx, problemURL)
}

// callDifyAnalyzer runs the Dify "P_Analyzer" workflow app and returns the razbor JSON.
// Dify workflow apps respond with { data: { status, outputs: { <var>: <razbor> } } } where
// the output variable name (e.g. "output" or "output_") and its value type (JSON string or
// JSON object) depend on how the workflow was published — both shapes are handled below.
func (s *AIService) callDifyAnalyzer(ctx context.Context, problemURL string) (string, error) {
	endpoint := strings.TrimRight(s.difyAnalyzerURL, "/") + "/workflows/run"

	payload := map[string]interface{}{
		"inputs":        map[string]string{"problem_url": sanitize(problemURL)},
		"response_mode": "blocking",
		"user":          "olympiq",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("%w: failed to build Dify request: %v", ErrExternal, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrExternal, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.difyAnalyzerKey)

	resp, err := s.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: Dify request failed: %v", ErrExternal, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return "", fmt.Errorf("%w: failed to read Dify response: %v", ErrExternal, err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%w: Dify returned status %d: %s", ErrExternal, resp.StatusCode, string(respBody))
	}

	var envelope struct {
		Data struct {
			Status  string                     `json:"status"`
			Error   string                     `json:"error"`
			Outputs map[string]json.RawMessage `json:"outputs"`
		} `json:"data"`
	}
	if err := json.Unmarshal(respBody, &envelope); err != nil {
		return "", fmt.Errorf("%w: invalid Dify response: %v", ErrExternal, err)
	}
	if envelope.Data.Status != "succeeded" {
		return "", fmt.Errorf("%w: Dify workflow %s: %s", ErrExternal, envelope.Data.Status, envelope.Data.Error)
	}

	// The workflow's output variable name varies between published versions
	// (e.g. "output" or "output_"), and its value may be either a JSON string
	// (stringified razbor) or a JSON object directly. Prefer known keys, then
	// fall back to any single non-empty output, and handle both value shapes.
	var raw json.RawMessage
	for _, key := range []string{"output", "output_", "result", "text"} {
		if v, ok := envelope.Data.Outputs[key]; ok && len(v) > 0 {
			raw = v
			break
		}
	}
	if raw == nil {
		for _, v := range envelope.Data.Outputs {
			if len(v) > 0 {
				raw = v
				break
			}
		}
	}
	if raw == nil {
		return "", fmt.Errorf("%w: Dify returned no output", ErrExternal)
	}

	cleaned := strings.TrimSpace(string(raw))
	// If the value is a quoted JSON string, unquote it to get the inner JSON.
	if strings.HasPrefix(cleaned, `"`) {
		var unquoted string
		if err := json.Unmarshal(raw, &unquoted); err == nil {
			cleaned = unquoted
		}
	}
	cleaned = stripMarkdownFences(strings.TrimSpace(cleaned))
	if cleaned == "" {
		return "", fmt.Errorf("%w: Dify returned an empty analysis", ErrExternal)
	}
	return cleaned, nil
}

// callN8NAnalyzer sends the problem URL to the n8n analyzer webhook and returns the JSON razbor.
// The original URL is sent as-is — the n8n AI knows problems from training data and does not
// need to fetch the URL. Transforming to alfa-leetcode-api breaks the n8n workflow.
func (s *AIService) callN8NAnalyzer(ctx context.Context, problemURL string) (string, error) {
	body, err := json.Marshal(map[string]string{
		"problem_url": sanitize(problemURL),
	})
	if err != nil {
		return "", fmt.Errorf("%w: failed to build n8n request: %v", ErrExternal, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.n8nAnalyzerURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrExternal, err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: n8n request failed: %v", ErrExternal, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return "", fmt.Errorf("%w: failed to read n8n response: %v", ErrExternal, err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%w: n8n returned status %d: %s", ErrExternal, resp.StatusCode, string(respBody))
	}

	// n8n may wrap the JSON in an array: [{ "output": "{...}" }] or return the object directly.
	// Try direct parse first, then unwrap n8n's default array envelope.
	cleaned := stripMarkdownFences(strings.TrimSpace(string(respBody)))

	// If it starts with '[', unwrap the first element's "output" or "json" field.
	if strings.HasPrefix(cleaned, "[") {
		var envelope []map[string]json.RawMessage
		if json.Unmarshal([]byte(cleaned), &envelope) == nil && len(envelope) > 0 {
			for _, key := range []string{"output", "json", "text", "result", "analysis"} {
				if raw, ok := envelope[0][key]; ok {
					inner := strings.TrimSpace(string(raw))
					// raw may be a JSON string (quoted) or a JSON object
					if strings.HasPrefix(inner, `"`) {
						var s string
						if json.Unmarshal(raw, &s) == nil {
							cleaned = stripMarkdownFences(s)
							break
						}
					} else {
						cleaned = inner
						break
					}
				}
			}
		}
	}

	return cleaned, nil
}

// n8nRecProblem is the normalized format returned by the n8n recommendations fallback.
type n8nRecProblem struct {
	Rank         int      `json:"rank"`
	Platform     string   `json:"platform"`
	PlatformID   string   `json:"platform_id"`
	Title        string   `json:"title"`
	URL          string   `json:"url"`
	Difficulty   float64  `json:"difficulty"`
	CFRating     *int     `json:"cf_rating"`
	LCDifficulty *string  `json:"lc_difficulty"`
	Tags         []string `json:"tags"`
	Reason       string   `json:"reason"`
}

type structuredRecsMeta struct {
	Username         string   `json:"username"`
	GeneratedAt      string   `json:"generated_at,omitempty"`
	CodeforcesRating *int     `json:"codeforces_rating,omitempty"`
	LeetcodeSolved   *int     `json:"leetcode_solved,omitempty"`
	WeakTopics       []string `json:"weak_topics"`
	NextBestTopic    string   `json:"next_best_topic"`
}

type structuredRecsProblem struct {
	Title      string   `json:"title"`
	URL        string   `json:"url"`
	Difficulty *string  `json:"difficulty"`
	Rating     *int     `json:"rating"`
	Tags       []string `json:"tags"`
	Reason     string   `json:"reason"`
}

type structuredRecsResponse struct {
	Meta       structuredRecsMeta                 `json:"meta"`
	Leetcode   map[string][]structuredRecsProblem `json:"leetcode"`
	Codeforces map[string][]structuredRecsProblem `json:"codeforces"`
}

// GenerateN8NRecommendations calls the n8n roadmap webhook in topic mode and
// extracts the problems from each topic as a flat recommendations list.
// This is the fallback when the ML task-recommender is unavailable.
func (s *AIService) GenerateN8NRecommendations(ctx context.Context, sc *StudentContext, topic string, topK int) (string, error) {
	if s.n8nRoadmapURL == "" {
		return "", fmt.Errorf("n8n roadmap URL not configured")
	}

	raw, err := s.callN8NRoadmap(ctx, sc, "topic")
	if err != nil {
		return "", fmt.Errorf("n8n recommendations fallback failed: %w", err)
	}

	// Parse the unified roadmap — extract topic_mode.topics[].problems
	var unified struct {
		TopicMode *struct {
			Topics []struct {
				Name     string `json:"name"`
				Problems []struct {
					Title      string   `json:"title"`
					Platform   string   `json:"platform"`
					URL        string   `json:"url"`
					Rating     *int     `json:"rating"`
					Difficulty *string  `json:"difficulty"`
					Tags       []string `json:"tags"`
					Reason     string   `json:"reason"`
				} `json:"problems"`
			} `json:"topics"`
		} `json:"topic_mode"`
	}
	if err := json.Unmarshal([]byte(raw), &unified); err != nil || unified.TopicMode == nil {
		return "", fmt.Errorf("n8n response missing topic_mode")
	}

	lcDiffToFloat := map[string]float64{
		"easy": 0.25, "Easy": 0.25,
		"medium": 0.55, "Medium": 0.55,
		"hard": 0.85, "Hard": 0.85,
	}

	var problems []n8nRecProblem
	rank := 1
	topicLower := strings.ToLower(strings.TrimSpace(topic))

	for _, t := range unified.TopicMode.Topics {
		if topicLower != "" && !strings.Contains(strings.ToLower(t.Name), topicLower) {
			continue
		}
		for _, p := range t.Problems {
			if rank > topK {
				break
			}
			prob := n8nRecProblem{
				Rank:       rank,
				Platform:   p.Platform,
				PlatformID: "",
				Title:      p.Title,
				URL:        p.URL,
				Tags:       p.Tags,
				Reason:     p.Reason,
				Difficulty: 0.5,
			}
			if p.Platform == "codeforces" {
				prob.CFRating = p.Rating
				if p.Rating != nil {
					prob.Difficulty = float64(*p.Rating-800) / 2700.0
				}
			} else {
				if p.Difficulty != nil {
					prob.LCDifficulty = p.Difficulty
					if f, ok := lcDiffToFloat[*p.Difficulty]; ok {
						prob.Difficulty = f
					}
				}
			}
			problems = append(problems, prob)
			rank++
		}
		if rank > topK {
			break
		}
	}

	out, err := json.Marshal(problems)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// GenerateStructuredRecommendations calls the dedicated n8n recommender webhook and returns
// the raw structured JSON: { meta, leetcode: {topic: [problems]}, codeforces: {topic: [problems]} }.
// Results are cached in Redis for 6 hours to avoid redundant n8n cold-start latency.
func (s *AIService) GenerateStructuredRecommendations(ctx context.Context, sc *StudentContext) (string, error) {
	if s.n8nRecommenderURL == "" && s.n8nRoadmapURL == "" {
		return "", fmt.Errorf("n8n recommender URL not configured")
	}

	username := sc.CFHandle
	if username == "" {
		username = sc.LCHandle
	}

	// Serve from cache if fresh (6h TTL)
	if username != "" {
		cacheKey := "recommendations:v2:" + username
		if cached, err := s.cache.Get(ctx, cacheKey); err == nil && cached != "" {
			if normalized, normErr := normalizeStructuredRecs(cached); normErr == nil {
				return normalized, nil
			}
		}
	}

	result, err := s.callN8NRecommender(ctx, sc)
	if err != nil {
		return "", err
	}
	result, err = normalizeStructuredRecs(result)
	if err != nil {
		return "", err
	}

	// Cache for 6 hours so re-opening the page costs zero n8n calls
	if username != "" && result != "" {
		_ = s.cache.Set(ctx, "recommendations:v2:"+username, result, 6*time.Hour)
	}

	return result, nil
}

// callN8NRecommender sends the student context to the dedicated n8n recommender webhook.
// Uses the same payload format as callN8NRoadmap.
func (s *AIService) callN8NRecommender(ctx context.Context, sc *StudentContext) (string, error) {
	webhookURL := s.n8nRecommenderURL
	if webhookURL == "" {
		webhookURL = s.n8nRoadmapURL
	}
	if webhookURL == "" {
		return "", fmt.Errorf("n8n recommender URL not configured")
	}

	username := sc.CFHandle
	if username == "" {
		username = sc.LCHandle
	}

	weeklyHours := 15
	if sc.Goals != nil && sc.Goals.WeeklyHours != nil {
		weeklyHours = *sc.Goals.WeeklyHours
	}

	payload := map[string]interface{}{
		"username":     username,
		"mode":         "topic",
		"weekly_hours": weeklyHours,
	}

	if sc.CFHandle != "" {
		cfTopics := normalizeCFTopics(sc.CFTagFreq)
		if cfTopics == nil {
			cfTopics = make(map[string]int)
		}
		ratingHistory := make([]int, 0, len(sc.CFRecentRating))
		for _, r := range sc.CFRecentRating {
			ratingHistory = append(ratingHistory, r.NewRating)
		}
		payload["codeforces"] = map[string]interface{}{
			"rating":          sc.CFRating,
			"rank":            orNA(sc.CFRank),
			"problems_solved": len(sc.CFSolvedKeys),
			"topics":          cfTopics,
			"rating_history":  ratingHistory,
		}
	}

	if sc.LCHandle != "" {
		lcTopics := sc.LCTopics
		if lcTopics == nil {
			lcTopics = make(map[string]int)
		}
		payload["leetcode"] = map[string]interface{}{
			"total_solved": sc.LCTotalSolved,
			"easy":         sc.LCEasy,
			"medium":       sc.LCMedium,
			"hard":         sc.LCHard,
			"topics":       lcTopics,
		}
	}

	if sc.Goals != nil {
		payload["goal"] = sc.Goals.GoalType
		if sc.Goals.TargetDate != nil {
			payload["deadline"] = sc.Goals.TargetDate.Format("2006-01-02")
		}
		if sc.Goals.TargetRating != nil {
			payload["target_rating"] = *sc.Goals.TargetRating
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("%w: failed to build recommender request: %v", ErrExternal, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrExternal, err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: recommender request failed: %v", ErrExternal, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return "", fmt.Errorf("%w: failed to read recommender response: %v", ErrExternal, err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%w: recommender returned status %d: %s", ErrExternal, resp.StatusCode, string(respBody))
	}

	// Unwrap n8n envelope: [{"output":"...json..."}]
	cleaned := stripMarkdownFences(strings.TrimSpace(string(respBody)))
	if strings.HasPrefix(cleaned, "[") {
		var envelope []map[string]json.RawMessage
		if json.Unmarshal([]byte(cleaned), &envelope) == nil && len(envelope) > 0 {
			for _, key := range []string{"output", "json", "text", "result"} {
				if raw, ok := envelope[0][key]; ok {
					inner := strings.TrimSpace(string(raw))
					if strings.HasPrefix(inner, `"`) {
						var s string
						if json.Unmarshal(raw, &s) == nil {
							cleaned = stripMarkdownFences(s)
							break
						}
					} else {
						cleaned = inner
						break
					}
				}
			}
		}
	}
	return cleaned, nil
}

// stripMarkdownFences removes optional markdown wrapping from workflow output.
func stripMarkdownFences(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "```") {
		return s
	}
	// Drop the opening fence line (```json or ```)
	if idx := strings.Index(s, "\n"); idx >= 0 {
		s = s[idx+1:]
	}
	// Drop the closing fence
	if idx := strings.LastIndex(s, "```"); idx >= 0 {
		s = s[:idx]
	}
	return strings.TrimSpace(s)
}

func normalizeStructuredRecs(raw string) (string, error) {
	var recs structuredRecsResponse
	if err := json.Unmarshal([]byte(raw), &recs); err != nil {
		// n8n model nodes with a low max-tokens limit cut the JSON mid-string;
		// try to salvage the complete buckets instead of dropping the whole response.
		repaired, repairErr := repairTruncatedJSON(raw)
		if repairErr != nil || json.Unmarshal([]byte(repaired), &recs) != nil {
			return "", fmt.Errorf("%w: invalid structured recommendations: %v", ErrExternal, err)
		}
	}
	if recs.Leetcode == nil {
		recs.Leetcode = make(map[string][]structuredRecsProblem)
	}
	if recs.Codeforces == nil {
		recs.Codeforces = make(map[string][]structuredRecsProblem)
	}
	if recs.Meta.WeakTopics == nil {
		recs.Meta.WeakTopics = []string{}
	}
	if recs.Meta.Username == "" {
		return "", fmt.Errorf("%w: structured recommendations missing meta.username", ErrExternal)
	}
	if len(recs.Leetcode) == 0 && len(recs.Codeforces) == 0 {
		return "", fmt.Errorf("%w: structured recommendations missing problem buckets", ErrExternal)
	}
	body, err := json.Marshal(recs)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// repairTruncatedJSON salvages a JSON document that was cut off mid-stream
// (e.g. by an LLM max-tokens limit). It drops everything after the last fully
// closed nested value and closes the remaining open brackets.
func repairTruncatedJSON(s string) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", fmt.Errorf("empty JSON")
	}

	openStack := func(prefix string) ([]byte, bool) {
		var stack []byte
		inStr, esc := false, false
		for i := 0; i < len(prefix); i++ {
			c := prefix[i]
			if inStr {
				if esc {
					esc = false
				} else if c == '\\' {
					esc = true
				} else if c == '"' {
					inStr = false
				}
				continue
			}
			switch c {
			case '"':
				inStr = true
			case '{':
				stack = append(stack, '}')
			case '[':
				stack = append(stack, ']')
			case '}', ']':
				if len(stack) == 0 || stack[len(stack)-1] != c {
					return nil, false
				}
				stack = stack[:len(stack)-1]
			}
		}
		return stack, !inStr
	}

	stack, ok := openStack(s)
	if !ok {
		// Truncated inside a string — cut back to the last complete close bracket below.
	} else if len(stack) == 0 {
		return s, nil // already complete
	}

	// Find the last position where a nested value was fully closed.
	lastComplete := -1
	{
		var st []byte
		inStr, esc := false, false
		for i := 0; i < len(s); i++ {
			c := s[i]
			if inStr {
				if esc {
					esc = false
				} else if c == '\\' {
					esc = true
				} else if c == '"' {
					inStr = false
				}
				continue
			}
			switch c {
			case '"':
				inStr = true
			case '{':
				st = append(st, '}')
			case '[':
				st = append(st, ']')
			case '}', ']':
				if len(st) == 0 || st[len(st)-1] != c {
					return "", fmt.Errorf("mismatched brackets")
				}
				st = st[:len(st)-1]
				if len(st) > 0 {
					lastComplete = i
				}
			}
		}
	}
	if lastComplete < 0 {
		return "", fmt.Errorf("JSON not repairable")
	}

	out := strings.TrimRight(s[:lastComplete+1], " \t\r\n,")
	stack, ok = openStack(out)
	if !ok || stack == nil {
		return "", fmt.Errorf("JSON not repairable")
	}
	var b strings.Builder
	b.WriteString(out)
	for i := len(stack) - 1; i >= 0; i-- {
		b.WriteByte(stack[i])
	}
	return b.String(), nil
}

// topicSlugify converts a topic display name or key to a lowercase
// underscore slug, e.g. "Dynamic Programming" → "dynamic_programming".
func topicSlugify(t string) string {
	t = strings.ToLower(strings.TrimSpace(t))
	var b strings.Builder
	pendingSep := false
	for _, r := range t {
		isAlnum := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if isAlnum {
			if pendingSep && b.Len() > 0 {
				b.WriteByte('_')
			}
			pendingSep = false
			b.WriteRune(r)
		} else {
			pendingSep = true
		}
	}
	return b.String()
}

// topicSlugMatch compares two topic slugs, tolerating singular/plural
// variations ("graph" matches "graphs", "string" matches "strings").
func topicSlugMatch(a, b string) bool {
	if a == b {
		return true
	}
	return strings.TrimSuffix(a, "s") == strings.TrimSuffix(b, "s")
}

// FilterStructuredRecs filters the full structured recommendations JSON down
// to the requested topic and annotates the result with all available topic
// slugs. An empty topic, "any" or "all" returns the agent's best-fit bucket
// ("any") when present, otherwise a flattened union of every bucket.
func FilterStructuredRecs(raw, topic string) (string, error) {
	var recs structuredRecsResponse
	if err := json.Unmarshal([]byte(raw), &recs); err != nil {
		return "", fmt.Errorf("%w: invalid structured recommendations: %v", ErrExternal, err)
	}

	// Collect every topic slug across both platforms ("any" pinned first).
	seen := make(map[string]string) // de-pluralized form → slug
	var available []string
	hasAny := false
	for _, dict := range []map[string][]structuredRecsProblem{recs.Leetcode, recs.Codeforces} {
		for key := range dict {
			slug := topicSlugify(key)
			if slug == "any" || slug == "all" {
				hasAny = true
				continue
			}
			base := strings.TrimSuffix(slug, "s")
			if _, dup := seen[base]; !dup {
				seen[base] = slug
				available = append(available, slug)
			}
		}
	}
	sortStrings(available)
	if hasAny {
		available = append([]string{"any"}, available...)
	}
	if available == nil {
		available = []string{}
	}

	want := topicSlugify(topic)
	filter := func(dict map[string][]structuredRecsProblem) map[string][]structuredRecsProblem {
		out := make(map[string][]structuredRecsProblem)
		if want == "" || want == "any" || want == "all" {
			// Best-fit bucket if the agent provided one.
			for key, probs := range dict {
				s := topicSlugify(key)
				if s == "any" || s == "all" {
					out["any"] = probs
					return out
				}
			}
			// Otherwise flatten everything, deduplicating by URL.
			var flat []structuredRecsProblem
			urls := make(map[string]bool)
			for _, key := range sortedKeys(dict) {
				for _, p := range dict[key] {
					if p.URL != "" && urls[p.URL] {
						continue
					}
					urls[p.URL] = true
					flat = append(flat, p)
				}
			}
			if len(flat) > 0 {
				out["any"] = flat
			}
			return out
		}
		for key, probs := range dict {
			if topicSlugMatch(topicSlugify(key), want) {
				out[want] = append(out[want], probs...)
			}
		}
		return out
	}

	out := map[string]interface{}{
		"meta":             recs.Meta,
		"available_topics": available,
		"leetcode":         filter(recs.Leetcode),
		"codeforces":       filter(recs.Codeforces),
	}
	body, err := json.Marshal(out)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}

func sortedKeys(m map[string][]structuredRecsProblem) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sortStrings(keys)
	return keys
}

func sanitize(s string) string {
	if len(s) > 10000 {
		return s[:10000]
	}
	return s
}

func orNA(s string) string {
	if s == "" {
		return "not connected"
	}
	return s
}

func normalizeCFTopics(topics map[string]int) map[string]int {
	if len(topics) == 0 {
		return nil
	}
	out := make(map[string]int, len(topics))
	for topic, count := range topics {
		out[canonicalCFTopic(topic)] += count
	}
	return out
}

func canonicalCFTopic(topic string) string {
	t := strings.ToLower(strings.TrimSpace(topic))
	switch t {
	case "dp":
		return "Dynamic Programming"
	case "graphs", "graph matchings", "dfs and similar", "dsu", "flows", "shortest paths", "trees":
		return "Graph"
	case "number theory":
		return "Number Theory"
	case "binary search", "two pointers", "data structures", "brute force", "bitmasks", "combinatorics", "constructive algorithms", "divide and conquer", "expression parsing", "fft", "games", "geometry", "greedy", "hashing", "implementation", "math", "matrices", "probabilities", "schedules", "sortings", "string suffix structures", "strings", "ternary search":
		return titleTopic(t)
	default:
		return titleTopic(topic)
	}
}

func titleTopic(topic string) string {
	words := strings.Fields(strings.NewReplacer("_", " ", "-", " ").Replace(strings.TrimSpace(topic)))
	for i, word := range words {
		lower := strings.ToLower(word)
		if lower == "and" {
			words[i] = lower
			continue
		}
		if lower == "" {
			continue
		}
		words[i] = strings.ToUpper(lower[:1]) + lower[1:]
	}
	return strings.Join(words, " ")
}
