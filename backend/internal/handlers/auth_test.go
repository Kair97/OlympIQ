package handlers_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"olympiq/backend/internal/handlers"
)

// buildAuthApp wires a real AuthService with in-memory repos into a test Fiber app.
func buildAuthApp(t *testing.T) *fiber.App {
	t.Helper()
	users := newMockUserRepo()
	tokens := newMockTokenRepo()
	authSvc := newTestAuthService(t, users, tokens)

	authH := handlers.NewAuthHandler(authSvc, 15*time.Minute, 7*24*time.Hour, false)

	app := fiber.New()
	app.Post("/auth/register", authH.Register)
	app.Post("/auth/login", authH.Login)
	app.Post("/auth/logout", authH.Logout)
	app.Post("/auth/refresh", authH.Refresh)
	return app
}

func jsonBody(t *testing.T, v interface{}) io.Reader {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return bytes.NewReader(b)
}

func parseResp(t *testing.T, resp *fiber.Response) map[string]interface{} {
	t.Helper()
	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(resp.Body(), &result))
	return result
}

func TestRegisterHandler_Success(t *testing.T) {
	app := buildAuthApp(t)
	req := httptest.NewRequest("POST", "/auth/register", jsonBody(t, map[string]string{
		"email": "a@b.com", "username": "alice", "password": "password123",
	}))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(body, &result))
	assert.Equal(t, true, result["success"])
}

func TestRegisterHandler_DuplicateEmail(t *testing.T) {
	app := buildAuthApp(t)
	payload := map[string]string{"email": "a@b.com", "username": "alice", "password": "password123"}

	req1 := httptest.NewRequest("POST", "/auth/register", jsonBody(t, payload))
	req1.Header.Set("Content-Type", "application/json")
	_, err := app.Test(req1)
	require.NoError(t, err)

	payload["username"] = "bob"
	req2 := httptest.NewRequest("POST", "/auth/register", jsonBody(t, payload))
	req2.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req2)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusConflict, resp.StatusCode)
}

func TestRegisterHandler_InvalidInput(t *testing.T) {
	app := buildAuthApp(t)
	req := httptest.NewRequest("POST", "/auth/register", jsonBody(t, map[string]string{
		"email": "not-an-email", "username": "a", "password": "short",
	}))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
}

func TestRegisterHandler_InvalidUsernameReturnsFriendlyMessage(t *testing.T) {
	app := buildAuthApp(t)
	req := httptest.NewRequest("POST", "/auth/register", jsonBody(t, map[string]string{
		"email": "kair@gmail.com", "username": "kair@gmail.com", "password": "password123",
	}))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(body, &result))
	assert.Equal(t, "Username can contain only letters, numbers, and underscores.", result["error"])
}

func TestRegisterHandler_UsernameAllowsUnderscore(t *testing.T) {
	app := buildAuthApp(t)
	req := httptest.NewRequest("POST", "/auth/register", jsonBody(t, map[string]string{
		"email": "kair@gmail.com", "username": "kair_user", "password": "password123",
	}))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)
}

func TestLoginHandler_Success(t *testing.T) {
	app := buildAuthApp(t)

	req := httptest.NewRequest("POST", "/auth/register", jsonBody(t, map[string]string{
		"email": "a@b.com", "username": "alice", "password": "password123",
	}))
	req.Header.Set("Content-Type", "application/json")
	_, err := app.Test(req)
	require.NoError(t, err)

	req2 := httptest.NewRequest("POST", "/auth/login", jsonBody(t, map[string]string{
		"email": "a@b.com", "password": "password123",
	}))
	req2.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req2)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(body, &result))
	assert.Equal(t, true, result["success"])
}

func TestLoginHandler_WrongPassword(t *testing.T) {
	app := buildAuthApp(t)

	req := httptest.NewRequest("POST", "/auth/register", jsonBody(t, map[string]string{
		"email": "a@b.com", "username": "alice", "password": "password123",
	}))
	req.Header.Set("Content-Type", "application/json")
	_, err := app.Test(req)
	require.NoError(t, err)

	req2 := httptest.NewRequest("POST", "/auth/login", jsonBody(t, map[string]string{
		"email": "a@b.com", "password": "wrongpassword",
	}))
	req2.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req2)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
}

func TestLogoutHandler(t *testing.T) {
	app := buildAuthApp(t)
	req := httptest.NewRequest("POST", "/auth/logout", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)
}
