package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
)

// DBPinger is satisfied by *pgxpool.Pool.
type DBPinger interface {
	Ping(ctx context.Context) error
}

// RedisPinger wraps the redis client ping behind a simple error-returning interface.
type RedisPinger interface {
	Ping(ctx context.Context) error
}

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	db         DBPinger
	redis      RedisPinger
	geminiModel string
}

// New constructs a Handler with the given database and Redis connections.
func New(db DBPinger, redis RedisPinger, geminiModel ...string) *Handler {
	model := "gemini-2.0-flash"
	if len(geminiModel) > 0 && geminiModel[0] != "" {
		model = geminiModel[0]
	}
	return &Handler{db: db, redis: redis, geminiModel: model}
}

// Config returns public runtime configuration the frontend needs.
func (h *Handler) Config(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
		"data":    fiber.Map{"ai_model": h.geminiModel, "version": "1.0.0"},
		"error":   nil,
	})
}

// Health is the liveness endpoint — always returns 200 if the process is running.
func (h *Handler) Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
		"data":    fiber.Map{"status": "ok"},
		"error":   nil,
	})
}

// Ready is the readiness endpoint — returns 200 only when PostgreSQL and Redis are reachable.
func (h *Handler) Ready(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := h.db.Ping(ctx); err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"data":    nil,
			"error":   "database unavailable",
		})
	}

	if err := h.redis.Ping(ctx); err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"data":    nil,
			"error":   "redis unavailable",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    fiber.Map{"status": "ready", "postgres": "ok", "redis": "ok"},
		"error":   nil,
	})
}
