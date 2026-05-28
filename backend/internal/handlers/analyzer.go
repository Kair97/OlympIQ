package handlers

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"olympiq/backend/internal/models"
	"olympiq/backend/internal/repository"
	"olympiq/backend/internal/services"
)

// AnalyzerHandler handles /api/v1/analyze and /api/v1/analyses routes.
type AnalyzerHandler struct {
	ai       *services.AIService
	analyses repository.AnalysesRepository
}

// NewAnalyzerHandler constructs an AnalyzerHandler.
func NewAnalyzerHandler(ai *services.AIService, analyses repository.AnalysesRepository) *AnalyzerHandler {
	return &AnalyzerHandler{ai: ai, analyses: analyses}
}

// Analyze handles POST /analyze.
func (h *AnalyzerHandler) Analyze(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	var in struct {
		ProblemURL string `json:"problem_url" validate:"required,url"`
	}
	if err := parseAndValidate(c, &in); err != nil {
		return errResponse(c, fiber.StatusBadRequest, "problem_url is required and must be a valid URL")
	}

	raw, err := h.ai.AnalyzeProblem(c.Context(), in.ProblemURL)
	if err != nil {
		return mapServiceErr(c, err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return errResponse(c, fiber.StatusInternalServerError, "failed to parse AI response")
	}

	title, _ := parsed["problem_title"].(string)
	platform, _ := parsed["platform"].(string)

	analysis := &models.Analysis{
		ID:           uuid.New(),
		UserID:       uid,
		ProblemURL:   in.ProblemURL,
		ProblemTitle: &title,
		Platform:     &platform,
		AnalysisText: raw,
		CreatedAt:    time.Now().UTC(),
	}
	if err := h.analyses.Insert(c.Context(), analysis); err != nil {
		return mapServiceErr(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    fiber.Map{"id": analysis.ID, "analysis": parsed},
		"error":   nil,
	})
}

// ListAnalyses handles GET /analyses.
func (h *AnalyzerHandler) ListAnalyses(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	items, total, err := h.analyses.ListByUserID(c.Context(), uid, page, limit)
	if err != nil {
		return mapServiceErr(c, err)
	}
	return ok(c, fiber.Map{"items": items, "total": total, "page": page, "limit": limit})
}

// GetAnalysis handles GET /analyses/:id.
func (h *AnalyzerHandler) GetAnalysis(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return errResponse(c, fiber.StatusBadRequest, "invalid analysis ID")
	}
	a, err := h.analyses.FindByID(c.Context(), id)
	if err != nil {
		return mapServiceErr(c, err)
	}
	if a.UserID != uid {
		return errResponse(c, fiber.StatusForbidden, "forbidden")
	}

	var parsed interface{}
	_ = json.Unmarshal([]byte(a.AnalysisText), &parsed)
	return ok(c, fiber.Map{"id": a.ID, "problem_url": a.ProblemURL, "analysis": parsed, "created_at": a.CreatedAt})
}
