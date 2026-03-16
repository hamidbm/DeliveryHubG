# Architecture and Structure

This section is the technical entry point for how DeliveryHub is organized.

## High-Level Model

DeliveryHub is a Next.js application using App Router conventions and MongoDB on the server side. The product acts as a BFF: the Next.js server owns route handlers, page rendering, and backend coordination.

## Main Source Areas

- `src/app`: routes, layouts, and API handlers
- `src/components`: UI components and module-level views
- `src/services`: server-side services, DB access, and AI logic
- `src/lib`: shared helpers and infrastructure utilities
- `src/types.ts`: shared type definitions

## Current Architectural Reality

The documented direction prefers smaller repository-style modules per domain. The current implementation still centralizes much of the DB behavior in `src/services/db.ts`.

That means:

- the architecture is functional
- the codebase is not yet as modular as the target design

## Reference Pages

For the current reference material, also see:

- [../Architecture.md](../Architecture.md)
- [../Modules-Overview.md](../Modules-Overview.md)
