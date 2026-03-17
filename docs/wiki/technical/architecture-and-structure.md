# Architecture and Structure

This section is the technical entry point for how DeliveryHub is organized.

## High-Level Model

DeliveryHub is a Next.js application using App Router conventions and MongoDB on the server side. The product acts as a BFF: the Next.js server owns route handlers, page rendering, and backend coordination.

## Main Source Areas

- `src/app`: routes, layouts, and API handlers
- `src/components`: UI components and module-level views
- `src/services`: server-side services, DB access, and AI logic
- `src/lib`: shared helpers and infrastructure utilities
- `src/shared`: shared DB, events, bootstrap, and other cross-cutting infrastructure
- `src/types.ts`: shared type definitions

## Current Architectural Reality

The codebase now follows the repository direction much more closely than the earlier MVP shape.

The important current boundaries are:

- domain persistence lives in `src/server/db/repositories/*`
- shared DB access lives in `src/shared/db/*`
- centralized event emission lives in `src/shared/events/*`
- bootstrap and seed entry points live in `src/shared/bootstrap/*`
- `src/services/db.ts` is now a legacy compatibility layer, not the preferred home for new persistence logic

## What Still Uses `src/services/db.ts`

`src/services/db.ts` still exists because it provides compatibility exports for older code paths, but it is intentionally frozen:

- new code should import repositories or shared modules directly
- event consumers should import from `src/shared/events/emitEvent.ts`
- bootstrap and seed code should import from `src/shared/bootstrap/*`

The goal is controlled compatibility, not another broad rewrite.

## Frontend Shell Status

Routing is App Router based, but the main UI shell is still partially bridged through `src/App.tsx` and the custom navigation compatibility layer in `src/lib/navigation.tsx`.

That is acceptable for now, but it is not the clean final shape. It should be treated as an incremental cleanup area rather than a reason for a broad frontend rewrite.

## Reference Pages

For the current reference material, also see:

- [../Architecture.md](../Architecture.md)
- [../Modules-Overview.md](../Modules-Overview.md)
- [persistence-boundaries.md](persistence-boundaries.md)
