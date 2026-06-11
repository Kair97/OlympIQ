package services

import (
	"encoding/json"
	"strings"
	"testing"
)

const fullRecsJSON = `{
  "meta": {
    "username": "alex_coder_2024",
    "generated_at": "2026-06-10T17:22:39.546+00:00",
    "codeforces_rating": 1450,
    "leetcode_solved": 247,
    "weak_topics": ["Dynamic Programming", "Graph", "Backtracking"],
    "next_best_topic": "Dynamic Programming"
  },
  "leetcode": {
    "any": [
      {"title": "Minimum Window Substring", "url": "https://leetcode.com/problems/minimum-window-substring", "difficulty": "Hard", "rating": null, "tags": ["Hash Table"], "reason": "r1"}
    ],
    "dynamic_programming": [
      {"title": "Edit Distance", "url": "https://leetcode.com/problems/edit-distance", "difficulty": "Hard", "rating": null, "tags": ["Dynamic Programming"], "reason": "r2"}
    ],
    "graphs": [
      {"title": "Clone Graph", "url": "https://leetcode.com/problems/clone-graph", "difficulty": "Medium", "rating": null, "tags": ["Graph"], "reason": "r3"}
    ]
  },
  "codeforces": {
    "any": [
      {"title": "Theatre Square", "url": "https://codeforces.com/problemset/problem/1/A", "difficulty": null, "rating": 1000, "tags": ["math"], "reason": "r4"}
    ],
    "graph": [
      {"title": "Fox And Names", "url": "https://codeforces.com/problemset/problem/510/C", "difficulty": null, "rating": 1600, "tags": ["graphs"], "reason": "r5"}
    ]
  }
}`

func TestFilterStructuredRecsAny(t *testing.T) {
	out, err := FilterStructuredRecs(fullRecsJSON, "any")
	if err != nil {
		t.Fatalf("FilterStructuredRecs: %v", err)
	}
	var got struct {
		AvailableTopics []string                           `json:"available_topics"`
		Leetcode        map[string][]structuredRecsProblem `json:"leetcode"`
		Codeforces      map[string][]structuredRecsProblem `json:"codeforces"`
	}
	if err := json.Unmarshal([]byte(out), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(got.AvailableTopics) == 0 || got.AvailableTopics[0] != "any" {
		t.Fatalf("expected 'any' first in available_topics, got %v", got.AvailableTopics)
	}
	// graphs/graph must be deduplicated to one entry
	graphCount := 0
	for _, s := range got.AvailableTopics {
		if strings.HasPrefix(s, "graph") {
			graphCount++
		}
	}
	if graphCount != 1 {
		t.Fatalf("expected 1 graph topic, got %v", got.AvailableTopics)
	}
	if len(got.Leetcode["any"]) != 1 || len(got.Codeforces["any"]) != 1 {
		t.Fatalf("expected only the best-fit 'any' buckets, got lc=%v cf=%v", got.Leetcode, got.Codeforces)
	}
}

func TestFilterStructuredRecsTopicPluralMatch(t *testing.T) {
	// Selecting "graphs" must match LC key "graphs" AND CF key "graph".
	out, err := FilterStructuredRecs(fullRecsJSON, "graphs")
	if err != nil {
		t.Fatalf("FilterStructuredRecs: %v", err)
	}
	var got struct {
		Leetcode   map[string][]structuredRecsProblem `json:"leetcode"`
		Codeforces map[string][]structuredRecsProblem `json:"codeforces"`
	}
	if err := json.Unmarshal([]byte(out), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(got.Leetcode["graphs"]) != 1 {
		t.Fatalf("expected LC graphs bucket, got %v", got.Leetcode)
	}
	if len(got.Codeforces["graphs"]) != 1 {
		t.Fatalf("expected CF graph bucket matched under 'graphs', got %v", got.Codeforces)
	}
}

func TestRepairTruncatedJSON(t *testing.T) {
	// Simulate an n8n max-tokens cutoff mid-URL, exactly like production.
	cut := strings.Index(fullRecsJSON, `"https://leetcode.com/problems/clone-graph"`)
	truncated := fullRecsJSON[:cut+20] // cut inside the URL string

	repaired, err := repairTruncatedJSON(truncated)
	if err != nil {
		t.Fatalf("repairTruncatedJSON: %v", err)
	}
	var recs structuredRecsResponse
	if err := json.Unmarshal([]byte(repaired), &recs); err != nil {
		t.Fatalf("repaired JSON still invalid: %v\n%s", err, repaired)
	}
	if recs.Meta.Username != "alex_coder_2024" {
		t.Fatalf("meta lost in repair: %+v", recs.Meta)
	}
	if len(recs.Leetcode["any"]) != 1 || len(recs.Leetcode["dynamic_programming"]) != 1 {
		t.Fatalf("complete buckets lost in repair: %v", recs.Leetcode)
	}
}

func TestNormalizeStructuredRecsRepairsTruncation(t *testing.T) {
	cut := strings.Index(fullRecsJSON, `"Clone Graph"`)
	truncated := fullRecsJSON[:cut+5]

	out, err := normalizeStructuredRecs(truncated)
	if err != nil {
		t.Fatalf("normalizeStructuredRecs on truncated input: %v", err)
	}
	var recs structuredRecsResponse
	if err := json.Unmarshal([]byte(out), &recs); err != nil {
		t.Fatalf("normalized output invalid: %v", err)
	}
	if recs.Meta.Username == "" || len(recs.Leetcode) == 0 {
		t.Fatalf("normalized output lost data: %s", out)
	}
}
