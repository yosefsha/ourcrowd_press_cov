# syntax=docker/dockerfile:1

# ---- Build: type-check and bundle the SPA -----------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime: static files + reverse proxy to the API -----------------------
# nginx-unprivileged runs as uid 101 and listens on an unprivileged port.
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

# Where /api and /health are forwarded. The compose service is named `api`.
ENV API_UPSTREAM=http://api:8000
# Makes the entrypoint export NGINX_LOCAL_RESOLVERS from /etc/resolv.conf for
# the template's `resolver` directive (Docker's embedded DNS on compose networks).
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
