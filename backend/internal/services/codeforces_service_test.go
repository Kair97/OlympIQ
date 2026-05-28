package services_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"olympiq/backend/internal/models"
	"olympiq/backend/internal/services"
)

func TestBuildTagFrequency(t *testing.T) {
	rating := 1500
	subs := []models.CodeforcesSubmission{
		{Verdict: "OK", Problem: models.CodeforcesProblem{ContestID: 1, Index: "A", Tags: []string{"dp", "greedy"}, Rating: &rating}},
		{Verdict: "WRONG_ANSWER", Problem: models.CodeforcesProblem{ContestID: 1, Index: "B", Tags: []string{"dp"}}},
		{Verdict: "OK", Problem: models.CodeforcesProblem{ContestID: 2, Index: "A", Tags: []string{"graphs"}, Rating: &rating}},
		// Duplicate solved problem — should only count once
		{Verdict: "OK", Problem: models.CodeforcesProblem{ContestID: 1, Index: "A", Tags: []string{"dp", "greedy"}}},
	}

	freq := services.BuildTagFrequency(subs)
	assert.Equal(t, 1, freq["dp"])     // contest 1/A counted once despite duplicate
	assert.Equal(t, 1, freq["greedy"])
	assert.Equal(t, 1, freq["graphs"])
	assert.Zero(t, freq["math"])
}

func TestBuildTagFrequency_Empty(t *testing.T) {
	freq := services.BuildTagFrequency(nil)
	assert.Empty(t, freq)
}

func TestBuildTagFrequency_NoAccepted(t *testing.T) {
	subs := []models.CodeforcesSubmission{
		{Verdict: "WRONG_ANSWER", Problem: models.CodeforcesProblem{ContestID: 1, Index: "A", Tags: []string{"dp"}}},
		{Verdict: "TLE", Problem: models.CodeforcesProblem{ContestID: 1, Index: "B", Tags: []string{"graphs"}}},
	}
	freq := services.BuildTagFrequency(subs)
	assert.Empty(t, freq)
}

// ---- mock cache for service tests ----

type mockCache struct{ data map[string]string }

func newMockCache() *mockCache { return &mockCache{data: make(map[string]string)} }

func (m *mockCache) Get(_ context.Context, key string) (string, error) {
	if v, ok := m.data[key]; ok {
		return v, nil
	}
	return "", assert.AnError
}

func (m *mockCache) Set(_ context.Context, key, value string, _ time.Duration) error {
	m.data[key] = value
	return nil
}

func (m *mockCache) Del(_ context.Context, keys ...string) error {
	for _, k := range keys {
		delete(m.data, k)
	}
	return nil
}
