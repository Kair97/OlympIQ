# Multi-stage build: compiles the React app inside a Linux container, so a fresh
# `git clone` + `docker-compose up --build` works with no local `npm run build`.
# Building in-container also sidesteps Windows↔Linux node_modules / native-binding
# mismatches (the reason the old single-stage Dockerfile required a prebuilt dist/).

# Stage 1 — build
FROM node:22-alpine AS builder
WORKDIR /app
# Install deps first for better layer caching (only re-runs when lockfile changes)
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — serve static files with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
