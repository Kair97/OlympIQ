FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
# Cache mounts persist the module download and the Go compiler cache between
# builds — incremental rebuilds only recompile changed packages.
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o server  ./cmd/server && \
    CGO_ENABLED=0 GOOS=linux go build -o migrate ./cmd/migrate

FROM alpine:3.19
RUN apk add --no-cache wget ca-certificates tzdata
RUN adduser -D -u 1000 appuser
WORKDIR /app
COPY --from=builder /app/server  .
COPY --from=builder /app/migrate .
COPY --from=builder /app/db      ./db
USER appuser
EXPOSE 8080
CMD ["./server"]
