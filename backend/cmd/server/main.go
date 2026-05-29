package main

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"olympiq/backend/internal/cache"
	"olympiq/backend/internal/config"
	"olympiq/backend/internal/handlers"
	"olympiq/backend/internal/middleware"
	"olympiq/backend/internal/repository"
	"olympiq/backend/internal/services"
)

type redisPinger struct{ client *redis.Client }

func (r *redisPinger) Ping(ctx context.Context) error { return r.client.Ping(ctx).Err() }

func main() {
	_ = godotenv.Load()

	logger, err := zap.NewProduction()
	if err != nil {
		panic(fmt.Sprintf("logger init: %v", err))
	}
	defer func() { _ = logger.Sync() }()

	cfg := config.Load()

	db, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("db pool", zap.Error(err))
	}
	defer db.Close()

	redisOpt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		logger.Fatal("redis URL", zap.Error(err))
	}
	rdb := redis.NewClient(redisOpt)
	defer func() {
		if e := rdb.Close(); e != nil {
			logger.Error("redis close", zap.Error(e))
		}
	}()

	redisCache := cache.New(rdb)

	userRepo := repository.NewUserRepo(db)
	tokenRepo := repository.NewTokenRepo(db)
	platformRepo := repository.NewPlatformRepo(db)
	statsRepo := repository.NewStatsRepo(db)
	goalsRepo := repository.NewGoalsRepo(db)
	roadmapRepo := repository.NewRoadmapRepo(db)
	analysesRepo := repository.NewAnalysesRepo(db)

	authSvc, err := services.NewAuthService(userRepo, tokenRepo, cfg.JWTPrivateKey, cfg.JWTPublicKey, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	if err != nil {
		logger.Fatal("auth service init", zap.Error(err))
	}

	cfSvc := services.NewCodeforcesService(redisCache)
	lcSvc := services.NewLeetCodeService(cfg.LeetCodeAPIURL, redisCache)

	profileSvc := services.NewProfileService(userRepo, tokenRepo)
	accountsSvc := services.NewAccountsService(platformRepo, redisCache, cfSvc, lcSvc)
	statsSvc := services.NewStatsService(platformRepo, statsRepo, cfSvc, lcSvc)
	aiSvc := services.NewAIService(cfg.GeminiAPIKey, cfg.GeminiModel, platformRepo, statsRepo, goalsRepo, redisCache, cfSvc, lcSvc)

	healthH := handlers.New(db, &redisPinger{client: rdb})
	authH := handlers.NewAuthHandler(authSvc, cfg.JWTAccessTTL, cfg.JWTRefreshTTL, cfg.IsProduction())
	profileH := handlers.NewProfileHandler(profileSvc)
	accountsH := handlers.NewAccountsHandler(accountsSvc, statsSvc, aiSvc)
	roadmapH := handlers.NewRoadmapHandler(aiSvc, roadmapRepo, goalsRepo)
	recsH := handlers.NewRecommendationsHandler(aiSvc)
	analyzerH := handlers.NewAnalyzerHandler(aiSvc, analysesRepo)

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, e error) error {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false, "data": nil, "error": "internal server error",
			})
		},
	})

	app.Use(middleware.Recover())
	app.Use(middleware.Logger(logger))
	app.Use(middleware.CORS(cfg.FrontendURL))
	app.Use(middleware.SecurityHeaders())

	app.Get("/health", healthH.Health)
	app.Get("/ready", healthH.Ready)

	// Prometheus metrics served on a separate lightweight HTTP server.
	go func() {
		mux := http.NewServeMux()
		mux.Handle("/metrics", promhttp.Handler())
		if listenErr := http.ListenAndServe(":9091", mux); listenErr != nil {
			logger.Error("metrics server", zap.Error(listenErr))
		}
	}()

	authLimit := middleware.RateLimit(redisCache, 10, 60*1000000000, "auth")
	apiLimit := middleware.RateLimit(redisCache, 60, 60*1000000000, "api")

	api := app.Group("/api/v1")

	auth := api.Group("/auth")
	auth.Use(authLimit)
	auth.Post("/register", authH.Register)
	auth.Post("/login", authH.Login)
	auth.Post("/logout", authH.Logout)
	auth.Post("/refresh", authH.Refresh)

	protected := api.Use(apiLimit, middleware.Auth(authSvc))

	protected.Get("/profile", profileH.Get)
	protected.Put("/profile", profileH.Update)
	protected.Put("/profile/password", authH.ChangePassword)
	protected.Delete("/profile", profileH.Delete)

	protected.Get("/accounts", accountsH.ListAccounts)
	protected.Post("/accounts/connect", accountsH.Connect)
	protected.Delete("/accounts/:platform", accountsH.Disconnect)
	protected.Post("/accounts/sync", accountsH.Sync)
	protected.Get("/stats", accountsH.GetStats)
	protected.Get("/ai/test", accountsH.TestAI)

	protected.Get("/goals", roadmapH.GetGoals)
	protected.Put("/goals", roadmapH.UpsertGoals)

	protected.Post("/roadmap/generate", roadmapH.Generate)
	protected.Get("/roadmap", roadmapH.GetLatest)

	protected.Get("/recommendations", recsH.List)

	protected.Post("/analyze", analyzerH.Analyze)
	protected.Get("/analyses", analyzerH.ListAnalyses)
	protected.Get("/analyses/:id", analyzerH.GetAnalysis)

	logger.Info("server starting", zap.String("port", cfg.AppPort))
	if e := app.Listen(":" + cfg.AppPort); e != nil {
		logger.Fatal("listen", zap.Error(e))
	}
}
