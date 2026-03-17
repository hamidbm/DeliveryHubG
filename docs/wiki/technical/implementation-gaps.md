# Implementation Gaps

This page summarizes the main gaps between the authoritative wiki intent and the current codebase.

Guest Access is intentionally excluded from this assessment.

## Strong Areas

- reviews, comments, events, and review-linked work items
- applications and APM extensions
- dashboards and program intelligence
- AI Insights and executive intelligence
- bootstrap, seeding, and admin operations
- shared auth/guard usage across API routes
- repository-based persistence boundaries across the main domains
- wiki Word image handling through stable served URLs
- centralized event emission outside the legacy DB compatibility layer

## Main Gaps

### 1. App Router adoption is still incomplete in the frontend shell

App Router is used for routes and API handlers, but parts of the frontend shell still run through a legacy client-side container in `src/App.tsx` plus a custom navigation compatibility layer in `src/lib/navigation.tsx`.

### 2. Notifications remain split at the domain-model level

The user-facing inbox is now substantially unified, but the system still has classic notifications and AI notifications as separate persistence paths. That is workable, but the model is still more fragmented than the ideal long-term design.

### 3. `src/services/db.ts` still exists as a compatibility layer

This is no longer a primary persistence gap. The major extraction work is done.

What remains is deliberate compatibility:

- `src/services/db.ts` is frozen and should keep shrinking
- new code should not add domain persistence there
- eventual cleanup should be incremental, not a broad repo-wide rewrite

### 4. Some legacy reference pages still describe older architecture

The code now reflects the repository/shared-module split more accurately than some older wiki pages. Documentation cleanup should continue so older reference pages do not imply that `src/services/db.ts` is still the main repository layer.

## Why This Page Exists

This page is not a criticism of the codebase. It is meant to help engineers distinguish between:

- what is already implemented
- what is partially implemented
- what still needs architectural cleanup
