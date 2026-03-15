# ---------- deps ----------
    FROM node:20-alpine AS deps
    WORKDIR /app

    RUN apk add --no-cache libc6-compat

    COPY package.json package-lock.json ./
    RUN npm ci

    # ---------- build ----------
    FROM node:20-alpine AS build
    WORKDIR /app

    ENV NEXT_DISABLE_TURBOPACK=1
    ENV NEXT_FORCE_TURBOPACK=0
    ENV TURBOPACK=0
    ENV NEXT_TELEMETRY_DISABLED=1

    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    COPY seed ./seed

    RUN npm run build

    # ---------- runtime ----------
    FROM node:20-alpine AS runner
    WORKDIR /app

    ENV NODE_ENV=production
    ENV NEXT_TELEMETRY_DISABLED=1

    # Install only if truly required at runtime
    RUN apk add --no-cache pandoc

    COPY --from=build /app/public ./public
    COPY --from=build /app/seed ./seed
    COPY --from=build /app/.next/standalone ./
    COPY --from=build /app/.next/static ./.next/static

    EXPOSE 3000

    CMD ["node", "server.js"]