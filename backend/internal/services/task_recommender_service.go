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
)

// TaskRecommenderService calls the Python ML microservice for problem recommendations.
type TaskRecommenderService struct {
	baseURL string
	http    *http.Client
}

// NewTaskRecommenderService constructs the service.
func NewTaskRecommenderService(baseURL string) *TaskRecommenderService {
	return &TaskRecommenderService{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 45 * time.Second},
	}
}

// ── Request types sent to Python microservice ─────────────────────────────────

type trCFSubmission struct {
	PlatformID string   `json:"platform_id"`
	Title      string   `json:"title"`
	Verdict    string   `json:"verdict"`
	Timestamp  int64    `json:"timestamp"`
	CFRating   *int     `json:"cf_rating"`
	Tags       []string `json:"tags"`
}

type trLCSubmission struct {
	PlatformID   string  `json:"platform_id"`
	Title        string  `json:"title"`
	Verdict      string  `json:"verdict"`
	Timestamp    int64   `json:"timestamp"`
	LCDifficulty *string `json:"lc_difficulty"`
}

type trRequest struct {
	CFHandle       string           `json:"cf_handle,omitempty"`
	CFRating       int              `json:"cf_rating"`
	CFMaxRating    int              `json:"cf_max_rating"`
	CFRank         string           `json:"cf_rank"`
	CFRegisteredAt int64            `json:"cf_registered_at"`
	CFSubmissions  []trCFSubmission `json:"cf_submissions"`

	LCHandle      string           `json:"lc_handle,omitempty"`
	LCRating      float64          `json:"lc_rating"`
	LCSubmissions []trLCSubmission `json:"lc_submissions"`

	TopK           int     `json:"top_k"`
	PlatformFilter *string `json:"platform_filter"`
	TopicFilter    *string `json:"topic_filter"`
}

// ── Response type returned by Python microservice ─────────────────────────────

// TRRecommendation is a single ML-ranked problem from the microservice.
type TRRecommendation struct {
	Rank         int                `json:"rank"`
	Platform     string             `json:"platform"`
	PlatformID   string             `json:"platform_id"`
	Title        string             `json:"title"`
	URL          string             `json:"url"`
	Difficulty   float64            `json:"difficulty"`
	CFRating     *int               `json:"cf_rating"`
	LCDifficulty *string            `json:"lc_difficulty"`
	Tags         []string           `json:"tags"`
	Scores       map[string]float64 `json:"scores"`
}

// ── Public API ─────────────────────────────────────────────────────────────────

// Recommend calls the ML microservice and returns ranked recommendations.
// It converts StudentContext into the microservice's request format.
func (s *TaskRecommenderService) Recommend(
	ctx context.Context,
	sc *StudentContext,
	topic string,
	topK int,
) ([]TRRecommendation, error) {
	req := trRequest{TopK: topK}

	if sc.CFHandle != "" {
		req.CFHandle = sc.CFHandle
		req.CFRating = sc.CFRating
		req.CFMaxRating = sc.CFMaxRating
		req.CFRank = sc.CFRank
		req.CFSubmissions = buildCFSubmissions(sc.CFSolvedKeys)
	}

	if sc.LCHandle != "" {
		req.LCHandle = sc.LCHandle
		req.LCRating = sc.LCContestRating
		req.LCSubmissions = buildLCSubmissions(sc.LCSolvedSlugs)
	}

	if topic != "" {
		t := mapTopicToUnified(topic)
		req.TopicFilter = &t
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/recommend", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("task-recommender unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("task-recommender HTTP %d: %s", resp.StatusCode, string(body))
	}

	var recs []TRRecommendation
	if err := json.NewDecoder(resp.Body).Decode(&recs); err != nil {
		return nil, fmt.Errorf("task-recommender response parse error: %w", err)
	}

	return recs, nil
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// buildCFSubmissions converts CFSolvedKeys ("contestId/index") to trCFSubmission.
// Only AC verdict is sent since StudentContext only tracks solved problems.
func buildCFSubmissions(solvedKeys []string) []trCFSubmission {
	subs := make([]trCFSubmission, 0, len(solvedKeys))
	for _, key := range solvedKeys {
		parts := strings.SplitN(key, "/", 2)
		if len(parts) != 2 {
			continue
		}
		subs = append(subs, trCFSubmission{
			PlatformID: parts[0] + "_" + parts[1],
			Verdict:    "AC",
			Tags:       []string{},
		})
	}
	return subs
}

// buildLCSubmissions converts LCSolvedSlugs to trLCSubmission.
func buildLCSubmissions(slugs []string) []trLCSubmission {
	subs := make([]trLCSubmission, 0, len(slugs))
	for _, slug := range slugs {
		subs = append(subs, trLCSubmission{
			PlatformID: slug,
			Verdict:    "AC",
		})
	}
	return subs
}

// mapTopicToUnified maps OlympIQ topic query params to TaskRecommender unified tags.
var topicUnifiedMap = map[string]string{
	"dp":                    "dynamic_programming",
	"dynamic programming":   "dynamic_programming",
	"graphs":                "graphs",
	"graph":                 "graphs",
	"greedy":                "greedy",
	"binary search":         "binary_search",
	"two pointers":          "two_pointers",
	"math":                  "math",
	"strings":               "strings",
	"string":                "strings",
	"trees":                 "trees",
	"tree":                  "trees",
	"data structures":       "data_structures",
	"segment tree":          "segment_tree",
	"sorting":               "sorting",
	"hashing":               "hash_tables",
	"hash tables":           "hash_tables",
	"number theory":         "number_theory",
	"combinatorics":         "combinatorics",
	"geometry":              "geometry",
	"bit manipulation":      "bit_manipulation",
	"divide and conquer":    "divide_conquer",
	"graph traversal":       "graph_traversal",
	"shortest paths":        "shortest_paths",
	"backtracking":          "backtracking",
	"game theory":           "game_theory",
	"stack":                 "stack",
	"heap":                  "heap",
	"sliding window":        "sliding_window",
	"linked list":           "linked_list",
	"union find":            "union_find",
	"trie":                  "trie",
	"flows":                 "flows",
	"constructive":          "constructive",
}

func mapTopicToUnified(topic string) string {
	lower := strings.ToLower(strings.TrimSpace(topic))
	if mapped, ok := topicUnifiedMap[lower]; ok {
		return mapped
	}
	// Pass through as-is (already a unified tag like "dynamic_programming")
	return strings.ReplaceAll(lower, " ", "_")
}
