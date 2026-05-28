package middleware

import "github.com/gofiber/fiber/v2"

// SecurityHeaders sets the security-related HTTP response headers required by CLAUDE.md.
func SecurityHeaders() fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set("X-Frame-Options", "DENY")
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("Referrer-Policy", "strict-origin")
		c.Set("Content-Security-Policy", "default-src 'self'")
		return c.Next()
	}
}
