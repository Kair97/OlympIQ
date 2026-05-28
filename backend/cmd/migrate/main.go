package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	path := flag.String("path", "db/migrations", "path to migrations directory")
	flag.Parse()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	cmd := flag.Arg(0)
	if cmd == "" {
		cmd = "up"
	}

	sourceURL := fmt.Sprintf("file://%s", *path)
	m, err := migrate.New(sourceURL, dbURL)
	if err != nil {
		log.Fatalf("failed to create migrator: %v", err)
	}
	defer func() {
		srcErr, dbErr := m.Close()
		if srcErr != nil {
			log.Printf("source close error: %v", srcErr)
		}
		if dbErr != nil {
			log.Printf("db close error: %v", dbErr)
		}
	}()

	switch cmd {
	case "up":
		if err := m.Up(); errors.Is(err, migrate.ErrNoChange) {
			fmt.Println("no new migrations to apply")
		} else if err != nil {
			log.Fatalf("migrate up: %v", err)
		} else {
			fmt.Println("migrations applied successfully")
		}
	case "down":
		if err := m.Down(); errors.Is(err, migrate.ErrNoChange) {
			fmt.Println("no migrations to rollback")
		} else if err != nil {
			log.Fatalf("migrate down: %v", err)
		} else {
			fmt.Println("rollback completed")
		}
	default:
		log.Fatalf("unknown command: %s (use 'up' or 'down')", cmd)
	}
}
