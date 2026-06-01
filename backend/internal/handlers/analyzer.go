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

	parsed, err := parseAndNormalizeAnalysis(raw)
	if err != nil {
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

// parseAndNormalizeAnalysis unmarshals a raw JSON string from the AI, flattens the
// n8n envelope format, normalizes changed field names, and fills safe defaults.
//
// New n8n response shape:
//   { "analysis": { ...fields... }, "similar_problems": [...] }
// Old/flat shape:
//   { "problem_title": "...", "similar_problems": [...], ... }
// Both are normalized to the flat shape so the frontend doesn't need to branch.
func parseAndNormalizeAnalysis(raw string) (map[string]interface{}, error) {
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return nil, err
	}

	// Flatten envelope: if "analysis" key exists, lift its fields to the top level
	// and merge the top-level "similar_problems" key (which lives outside "analysis").
	if inner, ok := m["analysis"].(map[string]interface{}); ok {
		sp := m["similar_problems"] // may be nil
		for k, v := range inner {
			m[k] = v
		}
		delete(m, "analysis")
		if sp != nil {
			m["similar_problems"] = sp
		}
	}

	// Normalize hints: new format uses { "level": "easy"|"intermediate"|"advanced", "hint": "..." }
	// Old format uses { "level": 1|2|3, "text": "..." }
	// Normalize to always have "text" populated so the frontend uses one field.
	if aa, ok := m["algorithm_approach"].(map[string]interface{}); ok {
		if hints, ok := aa["hints"].([]interface{}); ok {
			for i, h := range hints {
				if hm, ok := h.(map[string]interface{}); ok {
					if hm["text"] == nil {
						if hint, ok := hm["hint"].(string); ok {
							hm["text"] = hint
						}
					}
					hints[i] = hm
				}
			}
			aa["hints"] = hints
		}
	}

	// Normalize complexity: new format splits note into time_note + space_note.
	// Synthesize a combined "note" for backwards compatibility if it's missing.
	if cx, ok := m["complexity"].(map[string]interface{}); ok {
		if cx["note"] == nil || cx["note"] == "" {
			tn, _ := cx["time_note"].(string)
			sn, _ := cx["space_note"].(string)
			switch {
			case tn != "" && sn != "":
				cx["note"] = tn + " " + sn
			case tn != "":
				cx["note"] = tn
			case sn != "":
				cx["note"] = sn
			default:
				cx["note"] = ""
			}
		}
	}

	// Safe defaults for required fields.
	if m["problem_title"] == nil { m["problem_title"] = "Unknown Problem" }
	if m["platform"] == nil      { m["platform"] = "unknown" }

	if m["classification"] == nil {
		m["classification"] = map[string]interface{}{"type": "", "subtype": "", "difficulty_label": "", "confidence": 0.0}
	}
	if c, ok := m["classification"].(map[string]interface{}); ok {
		if c["type"] == nil       { c["type"] = "" }
		if c["subtype"] == nil    { c["subtype"] = "" }
		if c["difficulty_label"] == nil { c["difficulty_label"] = "" }
		if c["confidence"] == nil { c["confidence"] = 0.0 }
	}

	for _, key := range []string{"key_observations", "solution_steps", "common_mistakes", "similar_problems"} {
		if m[key] == nil { m[key] = []interface{}{} }
	}

	if m["algorithm_approach"] == nil {
		m["algorithm_approach"] = map[string]interface{}{"summary": "", "hints": []interface{}{}}
	}
	if a, ok := m["algorithm_approach"].(map[string]interface{}); ok {
		if a["summary"] == nil { a["summary"] = "" }
		if a["hints"] == nil   { a["hints"] = []interface{}{} }
	}

	if m["complexity"] == nil {
		m["complexity"] = map[string]interface{}{"time": "—", "space": "—", "note": ""}
	}
	if cx, ok := m["complexity"].(map[string]interface{}); ok {
		if cx["time"] == nil  { cx["time"] = "—" }
		if cx["space"] == nil { cx["space"] = "—" }
		if cx["note"] == nil  { cx["note"] = "" }
	}

	return m, nil
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

	parsed, _ := parseAndNormalizeAnalysis(a.AnalysisText)
	return ok(c, fiber.Map{"id": a.ID, "problem_url": a.ProblemURL, "analysis": parsed, "created_at": a.CreatedAt})
}
