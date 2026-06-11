package handlers

import (
	"errors"
	"regexp"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"olympiq/backend/internal/services"
)

var (
	validate        = validator.New()
	usernamePattern = regexp.MustCompile(`^[A-Za-z0-9_]+$`)
)

func init() {
	_ = validate.RegisterValidation("username", func(fl validator.FieldLevel) bool {
		return usernamePattern.MatchString(fl.Field().String())
	})
}

func ok(c *fiber.Ctx, data interface{}) error {
	return c.JSON(fiber.Map{"success": true, "data": data, "error": nil})
}

func errResponse(c *fiber.Ctx, status int, msg string) error {
	return c.Status(status).JSON(fiber.Map{"success": false, "data": nil, "error": msg})
}

func parseAndValidate(c *fiber.Ctx, dest interface{}) error {
	if err := c.BodyParser(dest); err != nil {
		return err
	}
	return validate.Struct(dest)
}

func mapServiceErr(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, services.ErrNotFound):
		return errResponse(c, fiber.StatusNotFound, "not found")
	case errors.Is(err, services.ErrUnauthorized):
		return errResponse(c, fiber.StatusUnauthorized, "incorrect email or password")
	case errors.Is(err, services.ErrConflict):
		return errResponse(c, fiber.StatusConflict, stripSentinel(err, services.ErrConflict))
	case errors.Is(err, services.ErrBadRequest):
		return errResponse(c, fiber.StatusBadRequest, stripSentinel(err, services.ErrBadRequest))
	case errors.Is(err, services.ErrExternal):
		msg := stripSentinel(err, services.ErrExternal)
		if msg == "" {
			msg = "external platform unavailable - other platforms may still have synced"
		}
		return errResponse(c, fiber.StatusBadGateway, msg)
	default:
		return errResponse(c, fiber.StatusInternalServerError, "internal server error")
	}
}

// stripSentinel removes the "<sentinel>: " prefix that fmt.Errorf("%w: msg", sentinel) produces,
// leaving only the human-readable message part.
func stripSentinel(err, sentinel error) string {
	return strings.Replace(err.Error(), sentinel.Error()+": ", "", 1)
}
