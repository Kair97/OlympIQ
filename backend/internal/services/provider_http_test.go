package services

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCodeforcesGetUserInfoClassifiesUpstreamFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "bad gateway", http.StatusBadGateway)
	}))
	defer server.Close()

	svc := NewCodeforcesService(&serviceTestCache{})
	svc.baseURL = server.URL

	_, err := svc.GetUserInfo(context.Background(), "tourist")
	require.ErrorIs(t, err, ErrExternal)
}

func TestLeetCodeProfileClassifiesUpstreamFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
	}))
	defer server.Close()

	svc := NewLeetCodeService(server.URL, &serviceTestCache{})

	_, err := svc.GetProfile(context.Background(), "tourist")
	require.ErrorIs(t, err, ErrExternal)
}

type serviceTestCache struct{}

func (*serviceTestCache) Get(context.Context, string) (string, error) {
	return "", errors.New("cache miss")
}

func (*serviceTestCache) Set(context.Context, string, string, time.Duration) error { return nil }
func (*serviceTestCache) Del(context.Context, ...string) error                     { return nil }
func (*serviceTestCache) Incr(context.Context, string, time.Duration) (int64, error) {
	return 0, nil
}
