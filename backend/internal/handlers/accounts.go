package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"olympiq/backend/internal/services"
)

// AccountsHandler handles /api/v1/accounts and /api/v1/stats routes.
type AccountsHandler struct {
	accounts *services.AccountsService
	stats    *services.StatsService
	ai       *services.AIService
	rec      *services.TaskRecommenderService
	logger   *zap.Logger
}

// NewAccountsHandler constructs an AccountsHandler.
func NewAccountsHandler(accounts *services.AccountsService, stats *services.StatsService, ai *services.AIService, rec *services.TaskRecommenderService, logger *zap.Logger) *AccountsHandler {
	return &AccountsHandler{accounts: accounts, stats: stats, ai: ai, rec: rec, logger: logger}
}

// ListAccounts handles GET /accounts — returns all connected platform accounts.
func (h *AccountsHandler) ListAccounts(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	accounts, err := h.accounts.ListAccounts(c.Context(), uid)
	if err != nil {
		return mapServiceErr(c, err)
	}
	return ok(c, accounts)
}

// Connect handles POST /accounts/connect.
func (h *AccountsHandler) Connect(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	var in services.ConnectInput
	if err := parseAndValidate(c, &in); err != nil {
		return errResponse(c, fiber.StatusBadRequest, "invalid input: "+err.Error())
	}
	acc, err := h.accounts.Connect(c.Context(), uid, in)
	if err != nil {
		return mapServiceErr(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": acc, "error": nil})
}

// Disconnect handles DELETE /accounts/:platform.
func (h *AccountsHandler) Disconnect(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	platform := c.Params("platform")
	if platform != "codeforces" && platform != "leetcode" {
		return errResponse(c, fiber.StatusBadRequest, "invalid platform")
	}
	if err := h.accounts.Disconnect(c.Context(), uid, platform); err != nil {
		return mapServiceErr(c, err)
	}
	return ok(c, nil)
}

// Sync handles POST /accounts/sync.
// After syncing platform stats it also registers the user with the ML recommender
// in the background so future recommendations are personalised immediately.
func (h *AccountsHandler) Sync(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	if err := h.stats.SyncAll(c.Context(), uid); err != nil {
		h.logger.Error("platform sync failed", zap.String("user_id", uid.String()), zap.Error(err))
		return mapServiceErr(c, err)
	}

	// Register user with the ML recommender in the background (non-blocking).
	if h.rec != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()

			sc, err := h.ai.BuildStudentContext(ctx, uid)
			if err != nil {
				return
			}
			_, _ = h.rec.Recommend(ctx, sc, "", 1)
		}()
	}

	return ok(c, fiber.Map{"message": "sync completed"})
}

// GetStats handles GET /stats.
func (h *AccountsHandler) GetStats(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	stats, err := h.stats.GetLatestStats(c.Context(), uid)
	if err != nil {
		return mapServiceErr(c, err)
	}
	return ok(c, stats)
}

// GetDashboard handles GET /dashboard — returns rich parsed stats for the Dashboard page.
func (h *AccountsHandler) GetDashboard(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	dash, err := h.stats.GetDashboard(c.Context(), uid)
	if err != nil {
		return mapServiceErr(c, err)
	}
	return ok(c, dash)
}

// TestAI handles GET /ai/test and verifies n8n workflow configuration.
func (h *AccountsHandler) TestAI(c *fiber.Ctx) error {
	result, err := h.ai.TestConnection(c.Context())
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"success": false,
			"data":    fiber.Map{"status": "error"},
			"error":   err.Error(),
		})
	}
	return ok(c, fiber.Map{"status": "ok", "response": result})
}
