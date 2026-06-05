package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"olympiq/backend/internal/services"
)

// AuthHandler handles /api/v1/auth/* routes.
type AuthHandler struct {
	auth       *services.AuthService
	accessTTL  time.Duration
	refreshTTL time.Duration
	secure     bool
}

// NewAuthHandler constructs an AuthHandler.
func NewAuthHandler(auth *services.AuthService, accessTTL, refreshTTL time.Duration, secure bool) *AuthHandler {
	return &AuthHandler{auth: auth, accessTTL: accessTTL, refreshTTL: refreshTTL, secure: secure}
}

// Register handles POST /auth/register.
// Creates the account and immediately issues JWT cookies so the user is
// logged in without a separate login step.
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var in services.RegisterInput
	if err := parseAndValidate(c, &in); err != nil {
		return errResponse(c, fiber.StatusBadRequest, "invalid input: "+err.Error())
	}
	user, err := h.auth.Register(c.Context(), in)
	if err != nil {
		return mapServiceErr(c, err)
	}
	pair, err := h.auth.IssueTokens(c.Context(), user)
	if err != nil {
		return mapServiceErr(c, err)
	}
	h.setTokenCookies(c, pair)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    fiber.Map{"id": user.ID, "email": user.Email, "username": user.Username},
		"error":   nil,
	})
}

// Login handles POST /auth/login.
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var in services.LoginInput
	if err := parseAndValidate(c, &in); err != nil {
		return errResponse(c, fiber.StatusBadRequest, "invalid input")
	}
	user, pair, err := h.auth.Login(c.Context(), in)
	if err != nil {
		return mapServiceErr(c, err)
	}
	h.setTokenCookies(c, pair)
	return ok(c, fiber.Map{"id": user.ID, "email": user.Email, "username": user.Username})
}

// Logout handles POST /auth/logout.
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	token := c.Cookies("refresh_token")
	if token != "" {
		_ = h.auth.Logout(c.Context(), token)
	}
	h.clearTokenCookies(c)
	return ok(c, nil)
}

// Refresh handles POST /auth/refresh.
func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	token := c.Cookies("refresh_token")
	if token == "" {
		return errResponse(c, fiber.StatusUnauthorized, "missing refresh token")
	}
	user, pair, err := h.auth.Refresh(c.Context(), token)
	if err != nil {
		return mapServiceErr(c, err)
	}
	h.setTokenCookies(c, pair)
	return ok(c, fiber.Map{"id": user.ID, "email": user.Email, "username": user.Username})
}

// ChangePassword handles PUT /profile/password.
func (h *AuthHandler) ChangePassword(c *fiber.Ctx) error {
	var in struct {
		CurrentPassword string `json:"current_password" validate:"required"`
		NewPassword     string `json:"new_password"     validate:"required,min=8"`
		ConfirmPassword string `json:"confirm_password" validate:"required"`
	}
	if err := parseAndValidate(c, &in); err != nil {
		return errResponse(c, fiber.StatusBadRequest, "invalid input")
	}
	if in.NewPassword != in.ConfirmPassword {
		return errResponse(c, fiber.StatusBadRequest, "new password and confirm password do not match")
	}

	from, err := userUUID(c)
	if err != nil {
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	}

	if err := h.auth.ChangePassword(c.Context(), from, in.CurrentPassword, in.NewPassword); err != nil {
		return mapServiceErr(c, err)
	}
	return ok(c, nil)
}

func (h *AuthHandler) setTokenCookies(c *fiber.Ctx, pair *services.TokenPair) {
	c.Cookie(&fiber.Cookie{
		Name:     "access_token",
		Value:    pair.AccessToken,
		Expires:  pair.AccessExp,
		HTTPOnly: true,
		Secure:   h.secure,
		SameSite: "Strict",
		Path:     "/",
	})
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    pair.RefreshToken,
		Expires:  pair.RefreshExp,
		HTTPOnly: true,
		Secure:   h.secure,
		SameSite: "Strict",
		Path:     "/api/v1/auth",
	})
}

func (h *AuthHandler) clearTokenCookies(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{Name: "access_token", Value: "", MaxAge: -1, HTTPOnly: true, Path: "/"})
	c.Cookie(&fiber.Cookie{Name: "refresh_token", Value: "", MaxAge: -1, HTTPOnly: true, Path: "/api/v1/auth"})
}
