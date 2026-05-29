package handlers

import (
	"github.com/gofiber/fiber/v2"

	"olympiq/backend/internal/services"
)

// AccountsHandler handles /api/v1/accounts and /api/v1/stats routes.
type AccountsHandler struct {
	accounts *services.AccountsService
	stats    *services.StatsService
	ai       *services.AIService
}

// NewAccountsHandler constructs an AccountsHandler.
func NewAccountsHandler(accounts *services.AccountsService, stats *services.StatsService, ai *services.AIService) *AccountsHandler {
	return &AccountsHandler{accounts: accounts, stats: stats, ai: ai}
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
func (h *AccountsHandler) Sync(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	if err := h.stats.SyncAll(c.Context(), uid); err != nil {
		return mapServiceErr(c, err)
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

// TestAI handles GET /ai/test — pings the Gemini API and returns the result.
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
