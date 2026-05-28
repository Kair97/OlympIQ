package handlers_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http/httptest"
	"testing"

	"olympiq/backend/internal/handlers"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockDB is a test double for DBPinger.
type mockDB struct{ err error }

func (m *mockDB) Ping(_ context.Context) error { return m.err }

// mockRedis is a test double for RedisPinger.
type mockRedis struct{ err error }

func (m *mockRedis) Ping(_ context.Context) error { return m.err }

func newTestApp(db handlers.DBPinger, rdb handlers.RedisPinger) *fiber.App {
	app := fiber.New()
	h := handlers.New(db, rdb)
	app.Get("/health", h.Health)
	app.Get("/ready", h.Ready)
	return app
}

func TestHealth_AlwaysReturns200(t *testing.T) {
	app := newTestApp(&mockDB{}, &mockRedis{})

	req := httptest.NewRequest("GET", "/health", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(body, &result))
	assert.Equal(t, true, result["success"])
}

func TestReady_BothHealthy_Returns200(t *testing.T) {
	app := newTestApp(&mockDB{}, &mockRedis{})

	req := httptest.NewRequest("GET", "/ready", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(body, &result))
	assert.Equal(t, true, result["success"])

	data, ok := result["data"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "ready", data["status"])
	assert.Equal(t, "ok", data["postgres"])
	assert.Equal(t, "ok", data["redis"])
}

func TestReady_DBDown_Returns503(t *testing.T) {
	app := newTestApp(&mockDB{err: errors.New("connection refused")}, &mockRedis{})

	req := httptest.NewRequest("GET", "/ready", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)

	assert.Equal(t, fiber.StatusServiceUnavailable, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(body, &result))
	assert.Equal(t, false, result["success"])
	assert.Equal(t, "database unavailable", result["error"])
}

func TestReady_RedisDown_Returns503(t *testing.T) {
	app := newTestApp(&mockDB{}, &mockRedis{err: errors.New("connection refused")})

	req := httptest.NewRequest("GET", "/ready", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)

	assert.Equal(t, fiber.StatusServiceUnavailable, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(body, &result))
	assert.Equal(t, false, result["success"])
	assert.Equal(t, "redis unavailable", result["error"])
}
