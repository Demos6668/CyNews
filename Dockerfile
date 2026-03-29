# Stage 1: Install dependencies and build
FROM node:24-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

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

# Build libraries and frontend
RUN pnpm run build

# Stage 2: Production image
FROM node:24-slim AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/.npmrc ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/artifacts/api-server ./artifacts/api-server
COPY --from=builder /app/artifacts/cyfy-news/dist ./artifacts/cyfy-news/dist
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/.env.example ./.env.example
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["./docker-entrypoint.sh"]
