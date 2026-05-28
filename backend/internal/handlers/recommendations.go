package handlers

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"

	"olympiq/backend/internal/services"
)

// RecommendationsHandler handles /api/v1/recommendations.
type RecommendationsHandler struct {
	ai *services.AIService
}

// NewRecommendationsHandler constructs a RecommendationsHandler.
func NewRecommendationsHandler(ai *services.AIService) *RecommendationsHandler {
	return &RecommendationsHandler{ai: ai}
}

// List handles GET /recommendations.
func (h *RecommendationsHandler) List(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}

	topic := c.Query("topic", "")
	mode := c.Query("mode", "general")

	sc, err := h.ai.BuildStudentContext(c.Context(), uid)
	if err != nil {
		return mapServiceErr(c, err)
	}

	raw, err := h.ai.GenerateRecommendations(c.Context(), sc, topic, mode)
	if err != nil {
		return mapServiceErr(c, err)
	}

	var parsed interface{}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return errResponse(c, fiber.StatusInternalServerError, "failed to parse recommendations")
	}
	return ok(c, parsed)
}
