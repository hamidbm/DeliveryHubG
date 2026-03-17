# Persistence Boundaries

This note defines the intended ownership boundaries for persistence and startup concerns in DeliveryHub.

## Current Boundary Model

- module repositories own domain persistence
- `src/shared/db` owns shared DB infrastructure and connection access
- `src/shared/events` owns centralized event emission
- `src/shared/bootstrap` owns startup, bootstrap, and seed entry points
- `src/services/db.ts` is legacy compatibility infrastructure only

## What Goes Where

### Domain persistence

Domain collections and domain-oriented queries belong in repository modules under `src/server/db/repositories`.

Examples:

- work items: `src/server/db/repositories/workItemsRepo.ts`
- reviews: `src/server/db/repositories/reviewsRepo.ts`
- wiki: `src/server/db/repositories/wikiRepo.ts`
- notifications: `src/server/db/repositories/notificationPlatformRepo.ts`

### Shared DB infrastructure

Connection and process-wide DB access helpers belong in shared DB infrastructure.

Examples:

- `src/lib/mongodb.ts`
- `src/server/db/client.ts`
- `src/shared/db/client.ts`

### Centralized events

Append-only event emission remains centralized and should not be reimplemented in route handlers or domain repositories.

Canonical event entry point:

- `src/shared/events/emitEvent.ts`

### Bootstrap and seed

Bootstrap orchestration and simple seed entry points belong in shared bootstrap infrastructure.

Examples:

- `src/shared/bootstrap/runBootstrap.ts`
- `src/shared/bootstrap/seed.ts`
- `src/shared/bootstrap/seedDatabase.ts`

## Legacy Compatibility Rule

`src/services/db.ts` may remain as a thin compatibility facade during transition work, but:

- no new domain persistence logic should be added there
- no new routes or services should prefer it over repositories or shared modules
- it should only shrink over time

## Practical Guidance

When adding new behavior:

1. put persistence in the correct repository
2. put shared runtime infrastructure in `src/shared/*`
3. call repositories or shared modules from route handlers and services
4. use `src/services/db.ts` only when preserving older compatibility paths
