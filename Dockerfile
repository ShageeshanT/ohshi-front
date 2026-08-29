# Ohshi frontend — the built React app served by Caddy, which also proxies
# /api, /v1 and /health to the backend service so the browser sees ONE origin
# (cookies stay same-site, no CORS). Caddy idles at ~15 MB RSS.

# ── Stage 1: build the static bundle ─────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
# Railway injects PORT; BACKEND_URL is the backend service on the private network
# (the service name is the hostname — set it explicitly in the service variables).
ENV PORT=8080 \
    BACKEND_URL=http://ohshi-back.railway.internal:8000
EXPOSE 8080
