# syntax=docker/dockerfile:1

############################
# 1) Dependencies layer
############################
FROM node:20-alpine AS deps
WORKDIR /app

# System deps for some npm modules (e.g., sharp) and git-based deps
RUN apk add --no-cache libc6-compat

# Copy lockfiles first for better caching
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install deps based on the lockfile present
RUN set -eux; \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable && pnpm i --frozen-lockfile; \
  elif [ -f yarn.lock ]; then \
    yarn install --frozen-lockfile; \
  else \
    npm ci; \
  fi

############################
# 2) Build layer
############################
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

# Reuse installed node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js
ENV NODE_ENV=production
RUN set -eux; \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable && pnpm run build; \
  elif [ -f yarn.lock ]; then \
    yarn build; \
  else \
    npm run build; \
  fi

# Ensure /app/public exists even if empty
RUN mkdir -p /app/public && if [ -d public ] && [ "$(ls -A public 2>/dev/null)" ]; then cp -r public/* /app/public/; fi

############################
# 3) Runtime (small) layer
############################
FROM node:20-alpine AS runner
WORKDIR /app

# Create a non-root user
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

ENV NODE_ENV=production
ENV PORT=3000
# Next.js binds to localhost by default in some setups; ensure it listens on all interfaces
ENV HOSTNAME=0.0.0.0

# If you use Next.js "output: 'standalone'" (recommended), this yields a very small image.
# Ensure next.config.js contains: module.exports = { output: 'standalone' }
#
# Copy the standalone server + minimal node_modules it generates:
COPY --from=builder /app/.next/standalone ./
# Copy static assets:
COPY --from=builder /app/.next/static ./.next/static
# Copy public assets (if any):
COPY --from=builder /app/public ./public

# If your app needs runtime env files, copy them explicitly (optional):
# COPY --from=builder /app/.env.production ./.env.production

USER nextjs
EXPOSE 3000

# For standalone output, server.js is at the root of /app after the copy above
CMD ["node", "server.js"]
