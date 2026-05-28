package middleware

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"

	"olympiq/backend/internal/services"
)

// RateLimit returns a Redis sliding-window rate limiter middleware.
func RateLimit(cache services.CacheStore, max int, window time.Duration, group string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		key := fmt.Sprintf("ratelimit:%s:%s:%s", group, c.IP(), c.Method())
		ctx := context.Background()

		val, err := cache.Get(ctx, key)
		count := 0
		if err == nil {
			count, _ = strconv.Atoi(val)
		}

		if count >= max {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"data":    nil,
				"error":   "rate limit exceeded — try again later",
			})
		}

		newVal := strconv.Itoa(count + 1)
		if count == 0 {
			_ = cache.Set(ctx, key, newVal, window)
		} else {
			_ = cache.Set(ctx, key, newVal, window)
		}
		return c.Next()
	}
}
