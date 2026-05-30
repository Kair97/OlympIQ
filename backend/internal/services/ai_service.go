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

// geminiBaseURL is the Google Generative Language REST endpoint.
const geminiBaseURL = "https://generativelanguage.googleapis.com/v1beta/models"

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

// AIService handles AI calls for roadmap, razbor, and recommendations.
// Uses n8n webhooks when configured; falls back to Gemini otherwise.
type AIService struct {
	apiKey         string
	model          string
	n8nAnalyzerURL string
	n8nRoadmapURL  string
	http           *http.Client
	platforms      repository.PlatformRepository
	stats          repository.StatsRepository
	goals          repository.GoalsRepository
	cache          CacheStore
	cf             *CodeforcesService
	lc             *LeetCodeService
}

// NewAIService constructs an AIService.
func NewAIService(
	apiKey, model, n8nAnalyzerURL, n8nRoadmapURL string,
	platforms repository.PlatformRepository,
	stats repository.StatsRepository,
	goals repository.GoalsRepository,
	cache CacheStore,
	cf *CodeforcesService,
	lc *LeetCodeService,
) *AIService {
	return &AIService{
		apiKey:         apiKey,
		model:          model,
		n8nAnalyzerURL: n8nAnalyzerURL,
		n8nRoadmapURL:  n8nRoadmapURL,
		http:           &http.Client{Timeout: 90 * time.Second},
		platforms:      platforms,
		stats:          stats,
		goals:          goals,
		cache:          cache,
		cf:             cf,
		lc:             lc,
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
						k := fmt.Sprintf("%d/%s", sub.Problem.ContestID, sub.Problem.Index)
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
				allTags := append(skill.Data.Fundamental, skill.Data.Intermediate...)
				allTags = append(allTags, skill.Data.Advanced...)
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

// TestConnection pings the Gemini API with a trivial prompt to verify the key works.
func (s *AIService) TestConnection(ctx context.Context) (string, error) {
	return s.callGemini(ctx, "You are a helpful assistant.", "Reply with exactly: OlympIQ AI is working!")
}

// GenerateRoadmap generates a roadmap. Uses n8n webhook if configured, otherwise Gemini.
func (s *AIService) GenerateRoadmap(ctx context.Context, sc *StudentContext, mode string) (string, error) {
	if s.n8nRoadmapURL != "" {
		return s.callN8NRoadmap(ctx, sc, mode)
	}
	userMsg := buildRoadmapUserMessage(sc, mode)
	return s.callGemini(ctx, roadmapSystemPrompt, userMsg)
}

// callN8NRoadmap sends the full user context to the n8n roadmap webhook.
// It builds the exact payload format the n8n agent expects.
func (s *AIService) callN8NRoadmap(ctx context.Context, sc *StudentContext, mode string) (string, error) {
	// Pick username — prefer CF handle, fall back to LC
	username := sc.CFHandle
	if username == "" {
		username = sc.LCHandle
	}

	payload := map[string]interface{}{
		"username":     username,
		"mode":         mode,
		"weekly_hours": 15,
	}

	// Codeforces data
	if sc.CFHandle != "" {
		ratingHistory := make([]int, 0, len(sc.CFRecentRating))
		for _, r := range sc.CFRecentRating {
			ratingHistory = append(ratingHistory, r.NewRating)
		}
		payload["codeforces"] = map[string]interface{}{
			"rating":          sc.CFRating,
			"rank":            orNA(sc.CFRank),
			"problems_solved": len(sc.CFSolvedKeys),
			"topics":          sc.CFTagFreq,
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

// AnalyzeProblem analyzes a problem. Uses n8n webhook if configured, otherwise Gemini.
func (s *AIService) AnalyzeProblem(ctx context.Context, problemURL string) (string, error) {
	if s.n8nAnalyzerURL != "" {
		return s.callN8NAnalyzer(ctx, problemURL)
	}
	userMsg := fmt.Sprintf("Analyze this competitive programming problem:\n\nURL: %s\n\nProvide a complete educational razbor. Do not write any working solution code.", sanitize(problemURL))
	return s.callGemini(ctx, razborSystemPrompt, userMsg)
}

// callN8NAnalyzer sends the problem URL to the n8n analyzer webhook and returns the JSON razbor.
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

// GenerateRecommendations calls Gemini and returns a JSON array of problems.
func (s *AIService) GenerateRecommendations(ctx context.Context, sc *StudentContext, topic, mode string) (string, error) {
	userMsg := buildRecommendationsUserMessage(sc, topic, mode)
	return s.callGemini(ctx, recommendationsSystemPrompt, userMsg)
}

// callGemini sends a request to the Gemini generateContent REST endpoint.
func (s *AIService) callGemini(ctx context.Context, systemPrompt, userMsg string) (string, error) {
	reqBody := map[string]interface{}{
		"systemInstruction": map[string]interface{}{
			"parts": []map[string]string{{"text": systemPrompt}},
		},
		"contents": []map[string]interface{}{
			{"role": "user", "parts": []map[string]string{{"text": userMsg}}},
		},
		"generationConfig": map[string]interface{}{
			"maxOutputTokens":  4096,
			"temperature":      0.2,
			"responseMimeType": "application/json",
		},
	}

	b, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/%s:generateContent?key=%s", geminiBaseURL, s.model, s.apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrExternal, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return "", err
	}

	// Gemini response shape
	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("%w: failed to parse Gemini response (status %d): %v", ErrExternal, resp.StatusCode, err)
	}
	if result.Error != nil {
		return "", fmt.Errorf("%w: Gemini error: %s", ErrExternal, result.Error.Message)
	}
	if len(result.Candidates) > 0 && len(result.Candidates[0].Content.Parts) > 0 {
		return stripMarkdownFences(result.Candidates[0].Content.Parts[0].Text), nil
	}
	return "", fmt.Errorf("%w: empty Gemini response", ErrExternal)
}

// stripMarkdownFences removes ```json ... ``` wrapping that Gemini sometimes adds
// despite being told to return raw JSON.
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

func sanitize(s string) string {
	if len(s) > 10000 {
		return s[:10000]
	}
	return s
}

func buildRoadmapUserMessage(sc *StudentContext, mode string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Generate a %s roadmap for this student.\n\n== STUDENT STATISTICS ==\n", mode))
	sb.WriteString(fmt.Sprintf("Codeforces Handle: %s\n", orNA(sc.CFHandle)))
	sb.WriteString(fmt.Sprintf("Codeforces Rating: %d (%s)\n", sc.CFRating, orNA(sc.CFRank)))
	sb.WriteString(fmt.Sprintf("Codeforces Max Rating: %d\n", sc.CFMaxRating))
	sb.WriteString("Solved problems by topic:\n")
	for tag, count := range sc.CFTagFreq {
		sb.WriteString(fmt.Sprintf("  - %s: %d\n", tag, count))
	}
	sb.WriteString(fmt.Sprintf("\nLeetCode Handle: %s\n", orNA(sc.LCHandle)))
	sb.WriteString(fmt.Sprintf("LeetCode Ranking: #%d\n", sc.LCRanking))
	sb.WriteString(fmt.Sprintf("LeetCode Solved: %d (%d easy / %d medium / %d hard)\n", sc.LCTotalSolved, sc.LCEasy, sc.LCMedium, sc.LCHard))
	sb.WriteString(fmt.Sprintf("LeetCode Contest Rating: %.0f\n", sc.LCContestRating))

	if sc.Goals != nil {
		sb.WriteString(fmt.Sprintf("\n== STUDENT GOALS ==\nGoal type: %s\n", sc.Goals.GoalType))
		if sc.Goals.TargetRating != nil {
			sb.WriteString(fmt.Sprintf("Target rating: %d\n", *sc.Goals.TargetRating))
		}
	}
	sb.WriteString(fmt.Sprintf("\n== INSTRUCTIONS ==\nMode: %s\nGenerate a focused, realistic plan.\n", mode))
	return sb.String()
}

func buildRecommendationsUserMessage(sc *StudentContext, topic, mode string) string {
	var sb strings.Builder
	sb.WriteString("Recommend 10 unsolved problems for this student.\n\n== STUDENT PROFILE ==\n")
	sb.WriteString(fmt.Sprintf("Codeforces Rating: %d (%s)\n", sc.CFRating, orNA(sc.CFRank)))
	sb.WriteString(fmt.Sprintf("LeetCode Solved: %d/%d/%d\n", sc.LCEasy, sc.LCMedium, sc.LCHard))

	if len(sc.CFSolvedKeys) > 0 {
		sb.WriteString("\n== FILTER (DO NOT RECOMMEND — already solved) ==\n")
		sb.WriteString(fmt.Sprintf("Codeforces solved: %s\n", strings.Join(sc.CFSolvedKeys, ", ")))
	}
	if len(sc.LCSolvedSlugs) > 0 {
		sb.WriteString(fmt.Sprintf("LeetCode solved: %s\n", strings.Join(sc.LCSolvedSlugs, ", ")))
	}
	sb.WriteString(fmt.Sprintf("\n== REQUEST ==\nTopic filter: %s\nMode: %s\nReturn exactly 10 problems.\n", orNA(topic), orNA(mode)))
	return sb.String()
}

func orNA(s string) string {
	if s == "" {
		return "not connected"
	}
	return s
}

const roadmapSystemPrompt = `You are OlympIQ Coach, an expert competitive programming mentor with deep knowledge of Codeforces, LeetCode, and competitive programming pedagogy.

Your task is to generate a highly personalized study roadmap based on the student's real statistics. You must analyze what they have already solved, identify their genuine weak areas, and prescribe specific next steps.

Rules:
- Be specific, not generic. Do not recommend topics the student has already mastered.
- Every problem recommendation must include a real, working URL on Codeforces or LeetCode.
- Difficulty must be calibrated: for Codeforces problems, recommend problems 100-200 rating points above the student's current level for learning, and at their level for confidence building.
- Explain WHY each topic or problem is recommended for this specific student.
- Return ONLY valid JSON matching the schema. No markdown, no explanation text, no code fences.`

const razborSystemPrompt = `You are OlympIQ Razbor, an expert competitive programming instructor who specializes in teaching algorithmic thinking.

Your role is to provide a deep educational breakdown of competitive programming problems — helping students understand the approach, not just the answer. You never provide a complete working solution or final code. Instead, you teach the reasoning process.

Rules:
- Never write a complete solution or full working code.
- Hints must be progressive — each hint reveals a little more, not the full answer.
- Similar problems must have real, working URLs.
- Return ONLY valid JSON matching the schema. No markdown, no explanation text, no code fences.`

const recommendationsSystemPrompt = `You are OlympIQ Recommender, a competitive programming coach who selects the most effective next problems for a student to practice.

Rules:
- Never recommend problems the student has already solved (the solved list is provided).
- Difficulty calibration: mix 60% at current level (for confidence) and 40% slightly above (for growth).
- Every problem URL must be real and directly accessible on Codeforces or LeetCode.
- The reason field must be specific to this student — reference their actual stats.
- Return ONLY a valid JSON array. No markdown, no explanation text, no code fences.`
