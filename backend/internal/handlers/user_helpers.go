package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"olympiq/backend/internal/middleware"
)

func userUUID(c *fiber.Ctx) (uuid.UUID, error) {
	idStr := middleware.UserID(c)
	if idStr == "" {
		return uuid.Nil, fmt.Errorf("no user in context")
	}
	return uuid.Parse(idStr)
}
