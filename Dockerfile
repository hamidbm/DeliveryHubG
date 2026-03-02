FROM node:20-alpine AS deps
WORKDIR /app

# If you use sharp, you may need libc6-compat; harmless otherwise
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

# Build Next.js
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install pandoc in the runtime image
RUN apk add --no-cache pandoc

# Copy only what you need to run Next.js
COPY --from=build /app/package.json /app/package-lock.json ./
# COPY --from=build /app/next.config.* ./ 2>/dev/null || true
COPY --from=build /app/next.config.* ./
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/seed ./seed

# If you use the App Router and standalone output, you’d copy /app/.next/standalone instead.
# (Optional optimization, depends on your build settings.)

EXPOSE 3000
CMD ["npm", "run", "start"]
