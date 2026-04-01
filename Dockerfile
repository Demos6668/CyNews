# Stage 1: Install dependencies and build
FROM node:24-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# Copy workspace config first for better caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY .npmrc ./

# Copy all package.json files
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/cyfy-news/package.json artifacts/cyfy-news/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/db/package.json lib/db/
COPY lib/feed-aggregator/package.json lib/feed-aggregator/
COPY lib/india-detector/package.json lib/india-detector/
COPY lib/cyber-relevance-detector/package.json lib/cyber-relevance-detector/
COPY scripts/package.json scripts/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy all source files
COPY . .

# Build libs (generates .d.ts files) then build all packages
RUN pnpm run typecheck:libs && pnpm -r --if-present run build

# Prune devDependencies after build (CI=true suppresses interactive prompt)
RUN CI=true pnpm prune --prod

# Stage 2: Production image
FROM node:24-slim AS production

ARG VERSION=0.0.0
LABEL org.opencontainers.image.title="CYFY-N" \
      org.opencontainers.image.description="Cybersecurity news aggregator and intelligence platform" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="https://github.com/vinne-1/CYFY-N"

WORKDIR /app

# Copy workspace config (needed for pnpm/node_modules resolution)
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/.npmrc ./

# Copy production-only node_modules
COPY --from=builder /app/node_modules ./node_modules

# Copy built api-server (bundled CJS + runtime deps)
COPY --from=builder /app/artifacts/api-server ./artifacts/api-server

# Copy frontend static dist
COPY --from=builder /app/artifacts/cyfy-news/dist ./artifacts/cyfy-news/dist

# Copy libs (needed for workspace resolution and migrations)
COPY --from=builder /app/lib ./lib

# Copy env example for reference
COPY --from=builder /app/.env.example ./.env.example

# Copy entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["./docker-entrypoint.sh"]
