package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
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

// CFDashboard is the rich Codeforces data returned by GetDashboard.
type CFDashboard struct {
	Handle         string                  `json:"handle"`
	Rating         int                     `json:"rating"`
	MaxRating      int                     `json:"max_rating"`
	Rank           string                  `json:"rank"`
	ProblemsSolved int                     `json:"problems_solved"`
	ContestCount   int                     `json:"contest_count"`
	TagFreq        map[string]int          `json:"tag_freq"`
	RatingHistory  []int                   `json:"rating_history"`
	LangFreq       map[string]int          `json:"lang_freq"`
	RatingBuckets  map[string]int          `json:"rating_buckets"`
	IndexFreq      map[string]int          `json:"index_freq"`
	RecentAC       []models.CFRecentProblem `json:"recent_ac"`
}

// LCSkill is one topic entry from the skill breakdown.
type LCSkill struct {
	TagName        string `json:"tagName"`
	ProblemsSolved int    `json:"problemsSolved"`
}

// LCDashboard is the rich LeetCode data returned by GetDashboard.
type LCDashboard struct {
	Handle          string                        `json:"handle"`
	ContestRating   float64                       `json:"rating"`
	Ranking         int                           `json:"ranking"`
	ProblemsSolved  int                           `json:"problems_solved"`
	EasySolved      int                           `json:"easy_solved"`
	MediumSolved    int                           `json:"medium_solved"`
	HardSolved      int                           `json:"hard_solved"`
	ContestAttend   int                           `json:"contest_attend"`
	TopPercentage   float64                       `json:"top_percentage"`
	Streak          int                           `json:"streak"`
	Calendar        map[string]int                `json:"calendar"`
	Skills          []LCSkill                     `json:"skills"`
	LanguageStats   map[string]int                `json:"language_stats"`
	ContestHistory  []models.LeetCodeContestEntry  `json:"contest_history"`
	RecentAC        []models.LCRecentProblem       `json:"recent_ac"`
}

// DashboardData is the full rich payload for the Dashboard page.
type DashboardData struct {
	CF *CFDashboard `json:"codeforces"`
	LC *LCDashboard `json:"leetcode"`
}

// GetDashboard returns rich, parsed dashboard data for a user.
func (s *StatsService) GetDashboard(ctx context.Context, userID uuid.UUID) (*DashboardData, error) {
	accounts, err := s.platforms.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	dash := &DashboardData{}

	for _, acc := range accounts {
		stat, err := s.stats.LatestByUserIDAndPlatform(ctx, userID, acc.Platform)
		if err != nil {
			continue
		}

		switch acc.Platform {
		case "codeforces":
			dash.CF = parseCFDashboard(acc.Handle, stat)
		case "leetcode":
			dash.LC = parseLCDashboard(acc.Handle, stat)
		}
	}
	return dash, nil
}

// GetLatestStats returns the most recent stats for all connected platforms.
func (s *StatsService) GetLatestStats(ctx context.Context, userID uuid.UUID) ([]*models.UserStats, error) {
	return s.stats.ListByUserID(ctx, userID)
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
		_ = s.platforms.UpdateLastSynced(ctx, userID, acc.Platform, time.Now().UTC())
	}
	return nil
}

func (s *StatsService) syncCF(ctx context.Context, userID uuid.UUID, handle string) error {
	info, err := s.cf.GetUserInfo(ctx, handle)
	if err != nil {
		return err
	}
	subs, _ := s.cf.GetSubmissions(ctx, handle, 500)
	history, _ := s.cf.GetRatingHistory(ctx, handle)

	// Last 24 rating points for the sparkline.
	historyPoints := make([]int, 0, 24)
	start := 0
	if len(history) > 24 {
		start = len(history) - 24
	}
	for _, h := range history[start:] {
		historyPoints = append(historyPoints, h.NewRating)
	}

	tagFreq := BuildTagFrequency(subs)

	// Unique accepted problems.
	seenProblem := make(map[string]bool)
	// Language frequency (accepted only).
	langFreq := make(map[string]int)
	// Rating bucket frequency: "800", "900", ..., "3500", "unrated".
	ratingBuckets := make(map[string]int)
	// Problem index frequency: "A", "B", "C", "D", "E", "F+".
	indexFreq := make(map[string]int)
	// Recent accepted (up to 10, most recent first).
	var recentAC []models.CFRecentProblem

	for _, sub := range subs {
		if sub.Verdict != "OK" {
			continue
		}
		key := fmt.Sprintf("%d/%s", sub.Problem.ContestID, sub.Problem.Index)
		if seenProblem[key] {
			continue
		}
		seenProblem[key] = true

		langFreq[sub.ProgrammingLanguage]++

		if sub.Problem.Rating != nil {
			bucket := fmt.Sprintf("%d", *sub.Problem.Rating)
			ratingBuckets[bucket]++
		} else {
			ratingBuckets["unrated"]++
		}

		idx := sub.Problem.Index
		if len(idx) > 0 {
			letter := string(idx[0])
			switch letter {
			case "A", "B", "C", "D", "E":
				indexFreq[letter]++
			default:
				indexFreq["F+"]++
			}
		}

		if len(recentAC) < 10 {
			recentAC = append(recentAC, models.CFRecentProblem{
				Name:      sub.Problem.Name,
				ContestID: sub.Problem.ContestID,
				Index:     sub.Problem.Index,
				Rating:    sub.Problem.Rating,
				Tags:      sub.Problem.Tags,
				SolvedAt:  sub.CreationTimeSeconds,
			})
		}
	}
	solvedCount := len(seenProblem)

	rawData := map[string]interface{}{
		"user":            info,
		"tag_freq":        tagFreq,
		"sub_count":       solvedCount,
		"rating_history":  historyPoints,
		"contest_count":   len(history),
		"lang_freq":       langFreq,
		"rating_buckets":  ratingBuckets,
		"index_freq":      indexFreq,
		"recent_ac":       recentAC,
	}
	rawJSON, _ := json.Marshal(rawData)

	rating := info.Rating
	rank := info.Rank
	maxRating := info.MaxRating
	contestCount := len(history)

	stat := &models.UserStats{
		ID:           uuid.New(),
		UserID:       userID,
		Platform:     "codeforces",
		Rating:       &rating,
		Rank:         &rank,
		MaxRating:    &maxRating,
		ContestCount: &contestCount,
		RawData:      rawJSON,
		FetchedAt:    time.Now().UTC(),
	}
	return s.stats.Insert(ctx, stat)
}

func (s *StatsService) syncLC(ctx context.Context, userID uuid.UUID, handle string) error {
	profile, err := s.lc.GetProfile(ctx, handle)
	if err != nil {
		return err
	}
	contest, _ := s.lc.GetContest(ctx, handle)
	skill, _ := s.lc.GetSkill(ctx, handle)
	calendar, _ := s.lc.GetCalendar(ctx, handle)
	langStats, _ := s.lc.GetLanguageStats(ctx, handle)
	contestHistory, _ := s.lc.GetContestHistory(ctx, handle)

	// Build recent AC from acSubmissions.
	acSubs, _ := s.lc.GetAcSubmissions(ctx, handle)
	recentAC := make([]models.LCRecentProblem, 0, 10)
	for i, sub := range acSubs {
		if i >= 10 {
			break
		}
		ts, _ := strconv.ParseInt(sub.Timestamp, 10, 64)
		recentAC = append(recentAC, models.LCRecentProblem{
			Title:     sub.Title,
			TitleSlug: sub.TitleSlug,
			SolvedAt:  ts,
			Lang:      sub.Lang,
		})
	}

	rawData := map[string]interface{}{
		"profile":         profile,
		"contest":         contest,
		"skill":           skill,
		"calendar":        calendar,
		"language_stats":  langStats,
		"contest_history": contestHistory,
		"recent_ac":       recentAC,
	}
	rawJSON, _ := json.Marshal(rawData)

	solved := profile.TotalSolved
	contestRating := 0
	contestAttend := 0
	if contest != nil {
		contestRating = int(contest.ContestRating)
		contestAttend = contest.ContestAttend
	}
	rank := fmt.Sprintf("#%d", profile.Ranking)

	stat := &models.UserStats{
		ID:             uuid.New(),
		UserID:         userID,
		Platform:       "leetcode",
		Rating:         &contestRating,
		Rank:           &rank,
		ProblemsSolved: &solved,
		ContestCount:   &contestAttend,
		RawData:        rawJSON,
		FetchedAt:      time.Now().UTC(),
	}
	return s.stats.Insert(ctx, stat)
}

func parseCFDashboard(handle string, stat *models.UserStats) *CFDashboard {
	d := &CFDashboard{
		Handle: handle,
	}
	if stat.Rating != nil {
		d.Rating = *stat.Rating
	}
	if stat.MaxRating != nil {
		d.MaxRating = *stat.MaxRating
	}
	if stat.Rank != nil {
		d.Rank = *stat.Rank
	}
	if stat.ContestCount != nil {
		d.ContestCount = *stat.ContestCount
	}

	if len(stat.RawData) > 0 {
		var raw struct {
			TagFreq       map[string]int           `json:"tag_freq"`
			SubCount      int                      `json:"sub_count"`
			RatingHistory []int                    `json:"rating_history"`
			ContestCount  int                      `json:"contest_count"`
			LangFreq      map[string]int           `json:"lang_freq"`
			RatingBuckets map[string]int           `json:"rating_buckets"`
			IndexFreq     map[string]int           `json:"index_freq"`
			RecentAC      []models.CFRecentProblem `json:"recent_ac"`
		}
		if json.Unmarshal(stat.RawData, &raw) == nil {
			d.TagFreq = raw.TagFreq
			d.RatingHistory = raw.RatingHistory
			d.ProblemsSolved = raw.SubCount
			d.LangFreq = raw.LangFreq
			d.RatingBuckets = raw.RatingBuckets
			d.IndexFreq = raw.IndexFreq
			d.RecentAC = raw.RecentAC
			if raw.ContestCount > 0 {
				d.ContestCount = raw.ContestCount
			}
		}
	}
	return d
}

func parseLCDashboard(handle string, stat *models.UserStats) *LCDashboard {
	d := &LCDashboard{Handle: handle}
	if stat.Rank != nil {
		fmt.Sscanf(*stat.Rank, "#%d", &d.Ranking)
	}

	if len(stat.RawData) == 0 {
		return d
	}

	var raw struct {
		Profile *models.LeetCodeProfile `json:"profile"`
		Contest *models.LeetCodeContest `json:"contest"`
		Skill   *struct {
			Data struct {
				Advanced     []LCSkill `json:"advanced"`
				Intermediate []LCSkill `json:"intermediate"`
				Fundamental  []LCSkill `json:"fundamental"`
			} `json:"data"`
		} `json:"skill"`
		Calendar       map[string]int                 `json:"calendar"`
		LanguageStats  []models.LeetCodeLanguageStat  `json:"language_stats"`
		ContestHistory []models.LeetCodeContestEntry  `json:"contest_history"`
		RecentAC       []models.LCRecentProblem        `json:"recent_ac"`
	}
	if err := json.Unmarshal(stat.RawData, &raw); err != nil {
		return d
	}

	if raw.Profile != nil {
		d.ProblemsSolved = raw.Profile.TotalSolved
		d.EasySolved = raw.Profile.EasySolved
		d.MediumSolved = raw.Profile.MediumSolved
		d.HardSolved = raw.Profile.HardSolved
		d.Ranking = raw.Profile.Ranking
	}
	if raw.Contest != nil {
		d.ContestRating = raw.Contest.ContestRating
		d.ContestAttend = raw.Contest.ContestAttend
		d.TopPercentage = raw.Contest.ContestTopPercentage
	}
	if raw.Skill != nil {
		all := append(raw.Skill.Data.Fundamental, raw.Skill.Data.Intermediate...)
		all = append(all, raw.Skill.Data.Advanced...)
		d.Skills = all
	}
	d.Calendar = raw.Calendar
	if len(raw.Calendar) > 0 {
		d.Streak = calcStreak(raw.Calendar)
	}
	if len(raw.LanguageStats) > 0 {
		d.LanguageStats = make(map[string]int, len(raw.LanguageStats))
		for _, l := range raw.LanguageStats {
			d.LanguageStats[l.LanguageName] = l.ProblemsSolved
		}
	}
	// Keep last 20 contests only (most recent first from API).
	hist := raw.ContestHistory
	if len(hist) > 20 {
		hist = hist[len(hist)-20:]
	}
	d.ContestHistory = hist
	d.RecentAC = raw.RecentAC
	return d
}

// calcStreak counts consecutive days with at least one submission, counting back from today.
func calcStreak(calendar map[string]int) int {
	now := time.Now().UTC()
	streak := 0
	for {
		dayStart := time.Date(now.Year(), now.Month(), now.Day()-streak, 0, 0, 0, 0, time.UTC).Unix()
		found := false
		for ts, count := range calendar {
			tsInt, err := strconv.ParseInt(ts, 10, 64)
			if err != nil {
				continue
			}
			if tsInt >= dayStart && tsInt < dayStart+86400 && count > 0 {
				found = true
				break
			}
		}
		if !found {
			break
		}
		streak++
		if streak > 365 {
			break
		}
	}
	return streak
}
