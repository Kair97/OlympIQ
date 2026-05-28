package models

import (
	"time"

	"github.com/google/uuid"
)

// UserStats is a snapshot of a user's stats on one platform.
type UserStats struct {
	ID             uuid.UUID `json:"id"`
	UserID         uuid.UUID `json:"user_id"`
	Platform       string    `json:"platform"`
	Rating         *int      `json:"rating"`
	Rank           *string   `json:"rank"`
	MaxRating      *int      `json:"max_rating"`
	ProblemsSolved *int      `json:"problems_solved"`
	ContestCount   *int      `json:"contest_count"`
	RawData        []byte    `json:"raw_data,omitempty"`
	FetchedAt      time.Time `json:"fetched_at"`
}

// CodeforcesUser holds fields from the CF user.info endpoint.
type CodeforcesUser struct {
	Handle                  string `json:"handle"`
	Rating                  int    `json:"rating"`
	Rank                    string `json:"rank"`
	MaxRating               int    `json:"maxRating"`
	MaxRank                 string `json:"maxRank"`
	Contribution            int    `json:"contribution"`
	LastOnlineTimeSeconds   int64  `json:"lastOnlineTimeSeconds"`
	RegistrationTimeSeconds int64  `json:"registrationTimeSeconds"`
}

// CodeforcesRatingChange holds one contest result from CF user.rating.
type CodeforcesRatingChange struct {
	ContestID               int    `json:"contestId"`
	ContestName             string `json:"contestName"`
	Rank                    int    `json:"rank"`
	RatingUpdateTimeSeconds int64  `json:"ratingUpdateTimeSeconds"`
	OldRating               int    `json:"oldRating"`
	NewRating               int    `json:"newRating"`
}

// CodeforcesSubmission holds one submission from CF user.status.
type CodeforcesSubmission struct {
	ID                  int64              `json:"id"`
	CreationTimeSeconds int64              `json:"creationTimeSeconds"`
	Problem             CodeforcesProblem  `json:"problem"`
	Verdict             string             `json:"verdict"`
}

// CodeforcesProblem is the nested problem object inside a CF submission.
type CodeforcesProblem struct {
	ContestID int      `json:"contestId"`
	Index     string   `json:"index"`
	Name      string   `json:"name"`
	Rating    *int     `json:"rating"`
	Tags      []string `json:"tags"`
}

// LeetCodeProfile holds data from the LC /{username}/profile endpoint.
type LeetCodeProfile struct {
	Username       string `json:"username"`
	Ranking        int    `json:"ranking"`
	TotalSolved    int    `json:"totalSolved"`
	EasySolved     int    `json:"easySolved"`
	MediumSolved   int    `json:"mediumSolved"`
	HardSolved     int    `json:"hardSolved"`
	AcceptanceRate string `json:"acceptanceRate"`
}

// LeetCodeContest holds data from the LC /{username}/contest endpoint.
type LeetCodeContest struct {
	ContestAttend        int     `json:"contestAttend"`
	ContestRating        float64 `json:"contestRating"`
	ContestGlobalRanking int     `json:"contestGlobalRanking"`
	TotalParticipants    int     `json:"totalParticipants"`
	ContestTopPercentage float64 `json:"contestTopPercentage"`
}

// LeetCodeSubmission holds one accepted submission from /{username}/acSubmission.
type LeetCodeSubmission struct {
	Title         string `json:"title"`
	TitleSlug     string `json:"titleSlug"`
	Timestamp     string `json:"timestamp"`
	StatusDisplay string `json:"statusDisplay"`
	Lang          string `json:"lang"`
}

// LeetCodeSkillTag is one topic from the skill breakdown.
type LeetCodeSkillTag struct {
	TagName        string `json:"tagName"`
	ProblemsSolved int    `json:"problemsSolved"`
}

// LeetCodeSkill holds the full skill breakdown from /{username}/skill.
type LeetCodeSkill struct {
	Data struct {
		Advanced     []LeetCodeSkillTag `json:"advanced"`
		Intermediate []LeetCodeSkillTag `json:"intermediate"`
		Fundamental  []LeetCodeSkillTag `json:"fundamental"`
	} `json:"data"`
}
