package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// All exported metrics are registered with the default Prometheus registry.
var (
	HTTPRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "olympiq_http_requests_total",
		Help: "Total HTTP requests by method, path, and status.",
	}, []string{"method", "path", "status"})

	HTTPRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "olympiq_http_request_duration_seconds",
		Help:    "HTTP request duration in seconds.",
		Buckets: prometheus.DefBuckets,
	}, []string{"endpoint"})

	AIRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "olympiq_ai_requests_total",
		Help: "Total Claude AI API calls by type.",
	}, []string{"type"})

	AIRequestDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "olympiq_ai_request_duration_seconds",
		Help:    "Claude API call latency in seconds.",
		Buckets: []float64{1, 5, 10, 30, 60, 90},
	})

	CFSyncTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "olympiq_cf_sync_total",
		Help: "Codeforces sync attempts by handle and status.",
	}, []string{"handle", "status"})

	LCSyncTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "olympiq_lc_sync_total",
		Help: "LeetCode sync attempts by handle and status.",
	}, []string{"handle", "status"})

	ActiveUsersGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "olympiq_active_users",
		Help: "Current number of active user sessions.",
	})

	DBConnectionsGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "olympiq_db_connections",
		Help: "Current PostgreSQL connection pool size.",
	})
)
