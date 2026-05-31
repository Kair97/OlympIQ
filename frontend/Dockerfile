# Pre-built: run `npm run build` locally first, then `docker-compose build frontend`
# No npm install or build step inside Docker — avoids registry network timeouts
# and native-binding platform mismatches (Windows node_modules ≠ Linux container)

FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
