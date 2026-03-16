# Implementation Gaps

This page summarizes the main gaps between the authoritative wiki intent and the current codebase.

Guest Access is intentionally excluded from this assessment.

## Strong Areas

- reviews, comments, events, and review-linked work items
- applications and APM extensions
- dashboards and program intelligence
- AI Insights and executive intelligence
- bootstrap, seeding, and admin operations

## Main Gaps

### 1. Route-level auth and authorization are inconsistent

Some routes use shared visibility and authorization helpers, but others still parse cookies ad hoc or allow writes with weak enforcement.

This is most visible in older wiki routes.

### 2. DB access is still too centralized

The codebase works, but much of the persistence logic remains concentrated in `src/services/db.ts` instead of being split into smaller domain repositories.

### 3. Wiki Word-image handling does not match the target design

The documented direction prefers extracted images served via stable URLs. The current code often embeds images as base64 data URIs during conversion instead.

### 4. App Router adoption is incomplete in the frontend shell

Routes use App Router, but the UI shell still carries some legacy app-level routing patterns.

### 5. Notifications remain split

There is a classic notifications path and a separate AI notifications path, which makes the overall notification model harder to reason about.

## Why This Page Exists

This page is not a criticism of the codebase. It is meant to help engineers distinguish between:

- what is already implemented
- what is partially implemented
- what still needs architectural cleanup
