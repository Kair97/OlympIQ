package handlers

import (
	"errors"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"olympiq/backend/internal/services"
)

var validate = validator.New()

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
		return errResponse(c, fiber.StatusUnauthorized, "unauthorized")
	case errors.Is(err, services.ErrConflict):
		return errResponse(c, fiber.StatusConflict, err.Error())
	case errors.Is(err, services.ErrBadRequest):
		return errResponse(c, fiber.StatusBadRequest, err.Error())
	default:
		return errResponse(c, fiber.StatusInternalServerError, "internal server error")
	}
}
