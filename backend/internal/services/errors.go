package services

import "errors"

// Sentinel errors for service-layer business logic failures.
var (
	ErrNotFound     = errors.New("not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrConflict     = errors.New("conflict")
	ErrBadRequest   = errors.New("bad request")
	ErrExternal     = errors.New("external API error")
)
