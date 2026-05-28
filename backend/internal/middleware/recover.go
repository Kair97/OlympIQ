package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// Recover returns a panic recovery middleware that returns a clean 500.
func Recover() fiber.Handler {
	return recover.New(recover.Config{
		EnableStackTrace: false,
	})
}
