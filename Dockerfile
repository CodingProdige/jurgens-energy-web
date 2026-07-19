FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=jurgens-energy-npm,target=/root/.npm,sharing=locked \
  npm ci --prefer-offline --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run lint
RUN --mount=type=cache,id=jurgens-energy-next,target=/app/.next/cache,sharing=locked \
  npm run build

FROM node:22-alpine AS migrate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules/postgres ./node_modules/postgres
COPY scripts/migrate.mjs scripts/seed-catalog.mjs ./scripts/
COPY src/db/migrations ./src/db/migrations
CMD ["node", "scripts/migrate.mjs"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV FFMPEG_BIN=/usr/bin/ffmpeg

RUN --mount=type=cache,id=jurgens-energy-apk,target=/var/cache/apk,sharing=locked \
  apk add ffmpeg \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /data/media /data/invoices /data/exports /data/backups \
  && chown -R nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
