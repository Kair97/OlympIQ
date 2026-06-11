package handlers

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"

	"olympiq/backend/internal/services"
)

// RecommendationsHandler handles /api/v1/recommendations.
type RecommendationsHandler struct {
	ai  *services.AIService
	rec *services.TaskRecommenderService
}

// NewRecommendationsHandler constructs a RecommendationsHandler.
func NewRecommendationsHandler(ai *services.AIService, rec *services.TaskRecommenderService) *RecommendationsHandler {
	return &RecommendationsHandler{ai: ai, rec: rec}
}

// List handles GET /recommendations.
// Priority: n8n structured recommender → ML microservice → n8n roadmap.
func (h *RecommendationsHandler) List(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}

	topic := c.Query("topic", "")
	if topic == "" && len(c.Body()) > 0 {
		var in struct {
			Topic string `json:"topic"`
		}
		if json.Unmarshal(c.Body(), &in) == nil {
			topic = in.Topic
		}
	}
	topK := 10

	sc, err := h.ai.BuildStudentContext(c.Context(), uid)
	if err != nil {
		return mapServiceErr(c, err)
	}

	// ── 1. n8n structured recommender (new format) ───────────────────────────
	// The full response is cached server-side; the selected topic is filtered
	// out of the cached payload here, so switching topics costs no n8n call.
	structuredRaw, structErr := h.ai.GenerateStructuredRecommendations(c.Context(), sc)
	if structErr == nil && structuredRaw != "" {
		if filtered, fErr := services.FilterStructuredRecs(structuredRaw, topic); fErr == nil {
			var parsed interface{}
			if json.Unmarshal([]byte(filtered), &parsed) == nil {
				return ok(c, parsed)
			}
		}
	}

	// ── 2. ML microservice ───────────────────────────────────────────────────
	if h.rec != nil {
		mlRecs, mlErr := h.rec.Recommend(c.Context(), sc, topic, topK)
		if mlErr == nil && len(mlRecs) > 0 {
			return ok(c, mlRecs)
		}
	}

	// ── 3. n8n roadmap webhook fallback ──────────────────────────────────────
	n8nRaw, n8nErr := h.ai.GenerateN8NRecommendations(c.Context(), sc, topic, topK)
	if n8nErr == nil && n8nRaw != "" {
		var parsed interface{}
		if json.Unmarshal([]byte(n8nRaw), &parsed) == nil {
			return ok(c, parsed)
		}
	}

	if n8nErr != nil {
		return mapServiceErr(c, n8nErr)
	}
	if structErr != nil {
		return mapServiceErr(c, structErr)
	}
	return errResponse(c, fiber.StatusBadGateway, "recommendation services are unavailable")
}


