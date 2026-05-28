package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"olympiq/backend/internal/services"
)

const userIDKey = "userID"
const usernameKey = "username"

// Auth extracts and validates the JWT access token from the httpOnly cookie or Authorization header.
func Auth(authSvc *services.AuthService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Cookies("access_token")
		if token == "" {
			hdr := c.Get("Authorization")
			if strings.HasPrefix(hdr, "Bearer ") {
				token = strings.TrimPrefix(hdr, "Bearer ")
			}
		}
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false, "data": nil, "error": "missing access token",
			})
		}

		claims, err := authSvc.ParseAccessToken(token)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false, "data": nil, "error": "invalid or expired token",
			})
		}

		c.Locals(userIDKey, claims.UserID)
		c.Locals(usernameKey, claims.Username)
		return c.Next()
	}
}

// UserID extracts the authenticated user ID string from locals.
func UserID(c *fiber.Ctx) string {
	id, _ := c.Locals(userIDKey).(string)
	return id
}
