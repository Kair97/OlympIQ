FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server  ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -o migrate ./cmd/migrate

FROM alpine:3.19
RUN adduser -D -u 1000 appuser
WORKDIR /app
COPY --from=builder /app/server  .
COPY --from=builder /app/migrate .
COPY --from=builder /app/db      ./db
USER appuser
EXPOSE 8080
CMD ["./server"]
