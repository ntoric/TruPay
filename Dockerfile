# syntax=docker/dockerfile:1

# ---- Dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app

# Install OpenSSL for Prisma + curl for healthchecks
RUN apk add --no-cache openssl curl

COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm ci --legacy-peer-deps

# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js needs the env at build for some static analysis; provide safe defaults
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://subsmgr:subsmgrpass@db:5432/subscription_manager?schema=public"
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime"

# Generate Prisma client
RUN npx prisma generate

RUN npm run build

# ---- Runner ----
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy built Next.js standalone artifacts
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["./docker-entrypoint.sh"]
