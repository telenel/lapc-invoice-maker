# syntax=docker/dockerfile:1.7

FROM node:22-slim AS base

# Install Chromium dependencies for server-side PDF rendering
ENV TZ=America/Los_Angeles

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    tzdata \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
COPY scripts/postinstall.js ./scripts/postinstall.js
RUN --mount=type=cache,target=/root/.npm npm ci

# Build stage
FROM base AS builder
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ENV NEXT_PUBLIC_BUILD_SHA=${BUILD_SHA}
ENV NEXT_PUBLIC_BUILD_TIME=${BUILD_TIME}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Dummy DATABASE_URL so Next.js build can collect page data without a live DB
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN --mount=type=cache,target=/app/.next/cache npm run build

# Production stage
FROM base AS runner
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
LABEL org.opencontainers.image.revision=$BUILD_SHA
LABEL org.opencontainers.image.created=$BUILD_TIME
ENV NODE_ENV=production
ENV HOME=/tmp
ENV XDG_CONFIG_HOME=/tmp/.chromium/config
ENV XDG_CACHE_HOME=/tmp/.chromium/cache
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}
ENV NEXT_PUBLIC_BUILD_SHA=${BUILD_SHA}
ENV NEXT_PUBLIC_BUILD_TIME=${BUILD_TIME}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
# Prisma v7 generates client to src/generated/prisma (not node_modules/.prisma)
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

# Install prisma CLI for migrations at runtime, then copy dotenv on top
# (prisma's npm install creates nested node_modules that swallows dotenv if installed together)
RUN npm install --no-save prisma
COPY --from=deps /app/node_modules/dotenv ./node_modules/dotenv

RUN chmod +x ./scripts/docker-entrypoint.sh
RUN addgroup --system app && adduser --system --ingroup app app
RUN mkdir -p data/pdfs public/uploads && chown -R app:app data public/uploads

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
