package services

import (
	"context"
	"time"
)

// CacheStore is a simple key-value cache interface backed by Redis.
type CacheStore interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key, value string, ttl time.Duration) error
	Del(ctx context.Context, keys ...string) error
}
