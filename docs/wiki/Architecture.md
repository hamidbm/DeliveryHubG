# Architecture and Structure

DeliveryHub follows a simple BFF architecture with Next.js App Router and a MongoDB backend. All data access is server-side.

## Key Decisions
- Next.js App Router is mandatory
- MongoDB access is server-side only
- UI is client components where interaction is needed
- API routes are the primary integration surface

## Source Structure
- `src/app`: Next.js routes, layouts, and API handlers
- `src/components`: UI components and module views
- `src/services`: server-side services and AI integrations
- `src/lib`: shared helpers and utilities
- `src/types.ts`: shared types and shape definitions

## Data Access
- MongoDB connection is centralized in `src/lib/mongodb.ts`
- Repository-style functions live in `src/services/db.ts`

## Runtime
- Development uses `npm run dev`
- Production uses `next build` and `next start`
- Optional Docker compose for local MongoDB
