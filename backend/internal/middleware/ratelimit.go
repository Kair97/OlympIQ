package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"

	"olympiq/backend/internal/services"
)

// RateLimit returns a fixed-window rate limiter middleware backed by Redis.
// The counter resets after window duration from the first request in that window.
func RateLimit(cache services.CacheStore, max int, window time.Duration, group string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		key := fmt.Sprintf("ratelimit:%s:%s", group, c.IP())
		ctx := context.Background()

		count, err := cache.Incr(ctx, key, window)
		if err != nil {
			// Redis unavailable — fail open so the app still works
			return c.Next()
		}

		if count > int64(max) {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"data":    nil,
				"error":   "rate limit exceeded — try again later",
			})
		}

		return c.Next()
	}
}
