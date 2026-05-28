package handlers

import (
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"olympiq/backend/internal/models"
	"olympiq/backend/internal/repository"
	"olympiq/backend/internal/services"
)

// RoadmapHandler handles /api/v1/roadmap and /api/v1/goals routes.
type RoadmapHandler struct {
	ai       *services.AIService
	roadmaps repository.RoadmapRepository
	goals    repository.GoalsRepository
}

// NewRoadmapHandler constructs a RoadmapHandler.
func NewRoadmapHandler(ai *services.AIService, roadmaps repository.RoadmapRepository, goals repository.GoalsRepository) *RoadmapHandler {
	return &RoadmapHandler{ai: ai, roadmaps: roadmaps, goals: goals}
}

// Generate handles POST /roadmap/generate.
func (h *RoadmapHandler) Generate(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	var in struct {
		Mode string `json:"mode" validate:"required,oneof=weekly topic interview"`
	}
	if err := parseAndValidate(c, &in); err != nil {
		return errResponse(c, fiber.StatusBadRequest, "mode must be weekly, topic, or interview")
	}

	sc, err := h.ai.BuildStudentContext(c.Context(), uid)
	if err != nil {
		return mapServiceErr(c, err)
	}

	raw, err := h.ai.GenerateRoadmap(c.Context(), sc, in.Mode)
	if err != nil {
		return mapServiceErr(c, err)
	}

	rm := &models.Roadmap{
		ID:          uuid.New(),
		UserID:      uid,
		Content:     []byte(raw),
		Mode:        in.Mode,
		GeneratedAt: time.Now().UTC(),
	}
	if err := h.roadmaps.Insert(c.Context(), rm); err != nil {
		return mapServiceErr(c, err)
	}

	var parsed interface{}
	_ = json.Unmarshal([]byte(raw), &parsed)
	return ok(c, parsed)
}

// GetLatest handles GET /roadmap.
func (h *RoadmapHandler) GetLatest(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	rm, err := h.roadmaps.LatestByUserID(c.Context(), uid)
	if err != nil {
		return mapServiceErr(c, err)
	}
	var parsed interface{}
	if err := json.Unmarshal(rm.Content, &parsed); err != nil {
		return errResponse(c, fiber.StatusInternalServerError, "failed to parse roadmap")
	}
	return ok(c, fiber.Map{"roadmap": parsed, "mode": rm.Mode, "generated_at": rm.GeneratedAt})
}

// GetGoals handles GET /goals.
func (h *RoadmapHandler) GetGoals(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	g, err := h.goals.FindByUserID(c.Context(), uid)
	if err != nil {
		return ok(c, nil)
	}
	return ok(c, g)
}

// UpsertGoals handles PUT /goals.
func (h *RoadmapHandler) UpsertGoals(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	var in struct {
		GoalType       string     `json:"goal_type"       validate:"required,oneof=rating interview topic_mastery"`
		TargetRating   *int       `json:"target_rating"`
		TargetDate     *time.Time `json:"target_date"`
		NotifyDaily    bool       `json:"notify_daily"`
		NotifyWeekly   bool       `json:"notify_weekly"`
		NotifyProblems bool       `json:"notify_problems"`
	}
	if err := parseAndValidate(c, &in); err != nil {
		return errResponse(c, fiber.StatusBadRequest, "invalid input")
	}
	now := time.Now().UTC()
	g := &models.UserGoal{
		ID:             uuid.New(),
		UserID:         uid,
		GoalType:       in.GoalType,
		TargetRating:   in.TargetRating,
		TargetDate:     in.TargetDate,
		NotifyDaily:    in.NotifyDaily,
		NotifyWeekly:   in.NotifyWeekly,
		NotifyProblems: in.NotifyProblems,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := h.goals.Upsert(c.Context(), g); err != nil {
		return mapServiceErr(c, err)
	}
	return ok(c, g)
}
