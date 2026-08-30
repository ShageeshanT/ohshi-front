# Ohshi frontend — the built React app served by Caddy, which also proxies
# /api, /v1 and /health to the backend service so the browser sees ONE origin
# (cookies stay same-site, no CORS). Caddy idles at ~15 MB RSS.

# ── Stage 1: build the static bundle ─────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# Vite bakes VITE_* into the bundle at BUILD time, so the key has to exist right
# here — setting it as a runtime service variable does nothing. Railway does
# inject service variables into the build, but a Dockerfile only sees them
# through an ARG declared in the stage that needs it. Without this line the
# build quietly succeeds and ships a bundle with Clerk switched off, while a
# backend that has OHSHI_CLERK_PUBLISHABLE_KEY set refuses every password
# login — so the deploy looks fine and nobody can sign in.
ARG VITE_CLERK_PUBLISHABLE_KEY=""
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

# Say which way it was built, so the deploy log answers the question directly.
RUN if [ -n "$VITE_CLERK_PUBLISHABLE_KEY" ]; then \
      echo ">> sign-in: CLERK (key ${VITE_CLERK_PUBLISHABLE_KEY%%_*}_… present at build)"; \
    else \
      echo ">> sign-in: EMAIL + PASSWORD (no VITE_CLERK_PUBLISHABLE_KEY at build)"; \
    fi && npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
# Railway injects PORT; BACKEND_URL is the backend service on the private network
# (the service name is the hostname — set it explicitly in the service variables).
ENV PORT=8080 \
    BACKEND_URL=http://ohshi-back.railway.internal:8000
EXPOSE 8080
