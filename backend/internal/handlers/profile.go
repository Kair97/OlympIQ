package handlers

import (
	"github.com/gofiber/fiber/v2"

	"olympiq/backend/internal/services"
)

// ProfileHandler handles /api/v1/profile routes.
type ProfileHandler struct {
	profile *services.ProfileService
}

// NewProfileHandler constructs a ProfileHandler.
func NewProfileHandler(profile *services.ProfileService) *ProfileHandler {
	return &ProfileHandler{profile: profile}
}

// Get handles GET /profile.
func (h *ProfileHandler) Get(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	u, err := h.profile.GetProfile(c.Context(), uid)
	if err != nil {
		return mapServiceErr(c, err)
	}
	return ok(c, fiber.Map{
		"id": u.ID, "email": u.Email, "username": u.Username, "created_at": u.CreatedAt,
	})
}

// Update handles PUT /profile.
func (h *ProfileHandler) Update(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	var in services.UpdateProfileInput
	if err := parseAndValidate(c, &in); err != nil {
		return errResponse(c, fiber.StatusBadRequest, "invalid input")
	}
	u, err := h.profile.UpdateProfile(c.Context(), uid, in)
	if err != nil {
		return mapServiceErr(c, err)
	}
	return ok(c, fiber.Map{"id": u.ID, "email": u.Email, "username": u.Username})
}

// Delete handles DELETE /profile.
func (h *ProfileHandler) Delete(c *fiber.Ctx) error {
	uid, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}
	if err := h.profile.DeleteAccount(c.Context(), uid); err != nil {
		return mapServiceErr(c, err)
	}
	return ok(c, nil)
}
