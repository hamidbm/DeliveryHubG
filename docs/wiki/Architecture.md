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
- Domain repositories live under `src/server/db/repositories`
- Shared DB access lives under `src/shared/db`
- Centralized event emission lives under `src/shared/events`
- `src/services/db.ts` is legacy compatibility infrastructure, not the preferred repository layer

## Runtime
- Development uses `npm run dev`
- Production uses `next build` and `next start`
- Optional Docker compose for local MongoDB
