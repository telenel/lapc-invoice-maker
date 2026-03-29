FROM node:22-slim AS base

# Install Chromium dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
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
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build stage
FROM base AS builder
ARG BUILD_SHA=dev
ENV NEXT_PUBLIC_BUILD_SHA=${BUILD_SHA}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# Prisma v7 generates client to src/generated/prisma (not node_modules/.prisma)
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

# Install prisma CLI for migrations at runtime, then copy dotenv on top
# (prisma's npm install creates nested node_modules that swallows dotenv if installed together)
RUN npm install --no-save prisma
COPY --from=deps /app/node_modules/dotenv ./node_modules/dotenv

RUN addgroup --system app && adduser --system --ingroup app app
RUN mkdir -p data/pdfs public/uploads && chown -R app:app data public/uploads

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER app
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
