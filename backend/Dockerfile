# syntax=docker/dockerfile:1

# One image, two roles (ADR-009): the same build runs the HTTP API
# (`node dist/main.js`, the default) and the collector (`node dist/worker.js`).
# It also ships the compiled migrations and the TypeORM CLI datasource so
# `npm run migration:run` works as a one-off task.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY scripts ./scripts
USER node
EXPOSE 8000
# dumb-init is PID 1 so SIGTERM reaches Node and enableShutdownHooks() can drain.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
