package config

import (
	"os"
	"time"
)

// Config holds all runtime configuration loaded from environment variables.
type Config struct {
	AppEnv      string
	AppPort     string
	DatabaseURL string
	RedisURL    string
	FrontendURL string

	JWTPrivateKey string
	JWTPublicKey  string
	JWTAccessTTL  time.Duration
	JWTRefreshTTL time.Duration

	N8NAnalyzerURL    string
	N8NRoadmapURL     string
	N8NRecommenderURL string

	LeetCodeAPIURL     string
	TaskRecommenderURL string
}

// Load reads all configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		AppEnv:      getEnv("APP_ENV", "development"),
		AppPort:     getEnv("APP_PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    getEnv("REDIS_URL", "redis://redis:6379"),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),

		JWTPrivateKey: os.Getenv("JWT_PRIVATE_KEY"),
		JWTPublicKey:  os.Getenv("JWT_PUBLIC_KEY"),
		JWTAccessTTL:  parseDuration("JWT_ACCESS_TTL", 15*time.Minute),
		JWTRefreshTTL: parseDuration("JWT_REFRESH_TTL", 168*time.Hour),

		N8NAnalyzerURL:    os.Getenv("N8N_ANALYZER_URL"),
		N8NRoadmapURL:     os.Getenv("N8N_ROADMAP_URL"),
		N8NRecommenderURL: os.Getenv("N8N_RECOMMENDER_URL"),

		LeetCodeAPIURL:     getEnv("LEETCODE_API_URL", "http://leetcode-api:3000"),
		TaskRecommenderURL: getEnv("TASK_RECOMMENDER_URL", "http://task-recommender:8000"),
	}
}

// IsProduction returns true when APP_ENV is production.
func (c *Config) IsProduction() bool { return c.AppEnv == "production" }

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		d, err := time.ParseDuration(v)
		if err == nil {
			return d
		}
	}
	return fallback
}
