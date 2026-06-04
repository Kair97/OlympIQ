package cache

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisCache adapts *redis.Client to the services.CacheStore interface.
type RedisCache struct {
	client *redis.Client
}

// New constructs a RedisCache from the given client.
func New(client *redis.Client) *RedisCache { return &RedisCache{client: client} }

// Get retrieves a string value by key; returns an error if the key does not exist.
func (r *RedisCache) Get(ctx context.Context, key string) (string, error) {
	return r.client.Get(ctx, key).Result()
}

// Set stores a string value with a TTL.
func (r *RedisCache) Set(ctx context.Context, key, value string, ttl time.Duration) error {
	return r.client.Set(ctx, key, value, ttl).Err()
}

// Del removes one or more keys.
func (r *RedisCache) Del(ctx context.Context, keys ...string) error {
	return r.client.Del(ctx, keys...).Err()
}

// Incr atomically increments key and sets TTL on the first call.
func (r *RedisCache) Incr(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	n, err := r.client.Incr(ctx, key).Result()
	if err != nil {
		return 0, err
	}
	if n == 1 {
		// First increment — set expiry so the window resets correctly
		_ = r.client.Expire(ctx, key, ttl).Err()
	}
	return n, nil
}
