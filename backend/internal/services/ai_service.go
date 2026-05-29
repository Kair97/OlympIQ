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

	Goals *models.UserGoal
}

// AIService handles Gemini API calls for roadmap, razbor, and recommendations.
type AIService struct {
	apiKey    string
	model     string
	http      *http.Client
	platforms repository.PlatformRepository
	stats     repository.StatsRepository
	goals     repository.GoalsRepository
	cache     CacheStore
	cf        *CodeforcesService
	lc        *LeetCodeService
}

// NewAIService constructs an AIService backed by Google Gemini.
func NewAIService(
	apiKey, model string,
	platforms repository.PlatformRepository,
	stats repository.StatsRepository,
	goals repository.GoalsRepository,
	cache CacheStore,
	cf *CodeforcesService,
	lc *LeetCodeService,
) *AIService {
	return &AIService{
		apiKey:    apiKey,
		model:     model,
		http:      &http.Client{Timeout: 90 * time.Second},
		platforms: platforms,
		stats:     stats,
		goals:     goals,
		cache:     cache,
		cf:        cf,
		lc:        lc,
	}
}

// BuildStudentContext assembles all user data for AI prompts.
func (s *AIService) BuildStudentContext(ctx context.Context, userID uuid.UUID) (*StudentContext, error) {
	sc := &StudentContext{}

	accounts, err := s.platforms.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	for _, acc := range accounts {
		switch acc.Platform {
		case "codeforces":
			sc.CFHandle = acc.Handle
			info, _ := s.cf.GetUserInfo(ctx, acc.Handle)
			if info != nil {
				sc.CFRating = info.Rating
				sc.CFRank = info.Rank
				sc.CFMaxRating = info.MaxRating
			}
			subs, _ := s.cf.GetSubmissions(ctx, acc.Handle, 500)
			if subs != nil {
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
			if len(hist) > 5 {
				sc.CFRecentRating = hist[len(hist)-5:]
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
			subs, _ := s.lc.GetAcSubmissions(ctx, acc.Handle)
			for _, sub := range subs {
				sc.LCSolvedSlugs = append(sc.LCSolvedSlugs, sub.TitleSlug)
			}
			skill, _ := s.lc.GetSkill(ctx, acc.Handle)
			if skill != nil {
				allTags := append(skill.Data.Fundamental, skill.Data.Intermediate...)
				allTags = append(allTags, skill.Data.Advanced...)
				for _, t := range allTags {
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

// GenerateRoadmap calls Gemini and returns the JSON roadmap string.
func (s *AIService) GenerateRoadmap(ctx context.Context, sc *StudentContext, mode string) (string, error) {
	userMsg := buildRoadmapUserMessage(sc, mode)
	return s.callGemini(ctx, roadmapSystemPrompt, userMsg)
}

// AnalyzeProblem calls Gemini and returns the JSON razbor string.
func (s *AIService) AnalyzeProblem(ctx context.Context, problemURL string) (string, error) {
	userMsg := fmt.Sprintf("Analyze this competitive programming problem:\n\nURL: %s\n\nProvide a complete educational razbor. Do not write any working solution code.", sanitize(problemURL))
	return s.callGemini(ctx, razborSystemPrompt, userMsg)
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
			"maxOutputTokens": 4096,
			"temperature":     0.2,
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
		return "", err
	}
	if result.Error != nil {
		return "", fmt.Errorf("%w: %s", ErrExternal, result.Error.Message)
	}
	if len(result.Candidates) > 0 && len(result.Candidates[0].Content.Parts) > 0 {
		return result.Candidates[0].Content.Parts[0].Text, nil
	}
	return "", fmt.Errorf("%w: empty Gemini response", ErrExternal)
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
