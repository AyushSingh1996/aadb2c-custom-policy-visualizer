# ── Stage 1: build shared types ──────────────────────────────────────────────
FROM node:20-alpine AS shared-builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/backend/package*.json ./packages/backend/
RUN npm ci
COPY packages/shared ./packages/shared
RUN npm run build --workspace=packages/shared

# ── Stage 2: build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/backend/package*.json ./packages/backend/
RUN npm ci
COPY packages/shared ./packages/shared
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/frontend ./packages/frontend
RUN npm run build --workspace=packages/frontend

# ── Stage 3: build Fastify backend ───────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/backend/package*.json ./packages/backend/
RUN npm ci
COPY packages/shared ./packages/shared
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/backend ./packages/backend
RUN npm run build --workspace=packages/backend

# ── Stage 4: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# All package.json files needed so npm workspace can resolve @policy-analyzer/shared
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/backend/package*.json ./packages/backend/
RUN npm ci --workspace=packages/backend --omit=dev

# Compiled backend
COPY --from=backend-builder /app/packages/backend/dist ./packages/backend/dist

# Bundled sample policies
COPY --from=backend-builder /app/packages/backend/samples ./packages/backend/samples

# React build output → served by @fastify/static from /app/packages/backend/public
COPY --from=frontend-builder /app/packages/frontend/dist ./packages/backend/public

EXPOSE 4000
ENV NODE_ENV=production

CMD ["node", "packages/backend/dist/index.js"]
