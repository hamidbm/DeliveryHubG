# DeliveryHub (Next.js + MongoDB) Implementation Guide

## 0) What this project is

DeliveryHub is an internal MVP web application for Software Delivery + Application Portfolio Management used to manage a large migration program (hundreds of apps moving from on-prem to Azure/GCP). It consolidates key capabilities from:

  - Jira → Work Items module
  - Confluence → Wiki module
  - LeanIX → Architecture module
  - Planview → Applications module
  - Plus Dashboards and AI Insights across modules

The app is not multi-tenant SaaS and is only for internal employees (~≤1000 users). It runs locally via docker compose, and will be deployed to Azure.

## 1) Core architectural rules (non-negotiable)

### 1.1 Next.js App Router only

  - Use Next.js App Router conventions (/app routes, layouts, route handlers).
  - Prefer Server Components by default.
  - Use Client Components only when needed (UI interactivity, hooks, browser APIs).

### 1.2 MongoDB access is server-side only

  - No direct DB access from browser/client components.
  - All DB access must go through:
    - Route Handlers (/app/api/.../route.ts) and/or
    - Server Actions (only if you later adopt them—route handlers are fine for MVP)

### 1.3 Simple BFF design

  - Next.js server is the BFF (Backend-for-Frontend).
  - No separate “business layer service” required right now.
  - Avoid Redux; keep state local and fetch via API routes.

### 1.4 Schema strategy: TypeScript = soft enforcement

  - MongoDB is flexible, but core fields are schema-driven.
  - Use types.ts (or /src/types/...) to define “important” shapes.
  - Allow additional fields in MongoDB documents without breaking.

### 1.5 Collections are domain-driven

  - One conceptual domain = one collection.
  - Avoid polymorphic “mega collections”.
  - Fix any accidental cross-use of collections (example: “work items” must not be stored in wiki_items).

## 2) Authentication & authorization

### 2.1 Dual auth mode (env controlled)

The app must support:

  - Local Auth (default for local dev)
    - Users can sign up with email/password.
    - Stored in users collection.
  - Entra ID Auth (Azure AD)
    - Used in production (internal employees).
    - When enabled, we can disable local signup.

Auth mode must be controlled by environment variables, so docker-compose/local can stay local-auth by default.

Recommended env variables (names can be adjusted; keep semantics):

  - AUTH_MODE=local|entra|dual
  - AUTH_DISABLE_LOCAL_SIGNUP=true|false

Entra config:

  - ENTRA_TENANT_ID=...
  - ENTRA_CLIENT_ID=...
  - ENTRA_CLIENT_SECRET=...
  - ENTRA_REDIRECT_URI=...
  - ENTRA_SCOPES="openid profile email"

### 2.2 Auth implementation preference

  - If adding Entra: prefer NextAuth/Auth.js unless it creates heavy complexity.
  - If keeping custom auth: implement a clean OIDC flow, server-only token exchange, secure cookies.

### 2.3 Roles & RBAC + ownership (MVP)

Roles are not “coarse”; keep them meaningful:

  - CMO Architect
  - SVP Architect
  - SVP PM
  - SVP Engineer
  - Engineering Architect
  - Engineering
  - Engineering PM
  - Director
  - VP
  - CIO
  
It’s acceptable for MVP to let users self-select their role at signup (no admin-managed assignments). Still implement:

  - RBAC: define what each role can do per module
  - Ownership: authors and assignees have elevated rights over their artifacts
  - Review workflow gates: only humans approve/reject

## 3) AI usage rules

  - AI is assistive only.
  - AI must never silently write to DB or auto-approve workflows.
  - AI outputs must be explicitly applied by a user action.
  - The default AI provider in local dev can be OpenAI; in production, default is M365 Copilot.
  - Admin can change provider at runtime (stored in ai_settings collection).

## 4) Data model & collections

MongoDB database: deliveryhub.
Known collections (based on current DB screenshot):

  - ai_settings
  - applications
  - architecture_diagrams
  - bundles
  - capabilities
  - counters
  - interfaces
  - milestones
  - settings
  - sprints
  - taxonomy_categories
  - taxonomy_document_types
  - users
  - wiki_assets
  - wiki_history
  - wiki_pages
  - wiki_spaces
  - wiki_themes
  - work_items
  
### 4.1 Collection naming integrity

  - Ensure code uses the correct collection for the correct domain.
  - Example: Work Items must read/write work_items (not wiki_items or any other).

## 5) Server-side DB access pattern (required refactor direction)

### 5.1 One DB helper

Have a single Mongo connection helper, cached per process (typical Next pattern).

### 5.2 Per-domain repositories

Create per-domain repository modules, e.g.:

  - /src/server/db/repositories/usersRepo.ts
  - /src/server/db/repositories/wikiRepo.ts
  - /src/server/db/repositories/workItemsRepo.ts
  - /src/server/db/repositories/applicationsRepo.ts
  - etc.

Repositories:

  - Export small, composable functions (getById, list, create, update, delete, search)
  - Accept explicit filters/inputs; do not hide magic.
  - Do not return passwords or secrets.

### 5.3 Route handlers call repositories

  - Route handlers should:
  - Validate input
  - Authorize user
  - Call repository functions
  - Return JSON with proper status codes

## 6) Wiki module requirements

### 6.1 Document formats

Wiki pages support:

  - Markdown (preferred)
  - HTML (supported if needed; must sanitize)

Wiki assets support uploads:

  - Word, PDF, images, Excel

### 6.2 Word → Markdown conversion (pandoc)

When Word is uploaded:

  - Store original Word binary in wiki_assets
  - Convert to markdown via pandoc
  - Store markdown in wiki_assets
  
**Images from Word**

Images must render in preview:

  - Pandoc typically emits markdown like ![](media/image1.png) or similar.
  - Because binaries are stored inside the same Mongo document, we must map those image references to a served URL.

**Required approach:**

  - On upload, store extracted images in wiki_assets.images[] (or similar), each with:
    - id
    - filename
    - contentType
    - data (base64) or buffer (Binary)
  - Rewrite markdown image links to stable URLs like:
    - /api/wiki-assets/:assetId/images/:imageId
  - Implement that route handler to stream the image with correct content-type and caching.

**Never render** <img src="">. If mapping fails, omit image or show placeholder.

### 6.3 Markdown rendering

Use react-markdown with:
  - remark-gfm
  - rehype-raw (only if required)
  - rehype-sanitize with a strict schema

**Hydration rule (important)**
Avoid emitting whitespace-only text nodes in illegal places (example: inside <colgroup>). If tables generated by the markdown/HTML include whitespace nodes that cause Next hydration warnings, fix by:

  - Removing raw HTML table colgroups during sanitization, OR
  - Writing a rehype plugin to strip whitespace-only nodes from colgroup, OR
  - Disallowing colgroup in sanitize schema

### 6.4 Typography styling

Use Tailwind typography plugin (@tailwindcss/typography) and wrap markdown with prose classes:

  - prose prose-slate dark:prose-invert max-w-none

## 7) Architecture module requirements

Support diagram types with battle-tested renderers:

  - Mermaid diagrams (client-side rendering; load dynamically)
  - Draw.io (either embed viewer or render exported SVG/PNG)
  - Mindmap using a markdown DSL (current code uses markmap-like approach)
  
Keep diagram rendering secure:

  - Sanitize inputs
  - Never execute arbitrary scripts from stored content

## 8) Work Items module requirements (Jira-like)

  - Support tree view (epic → story → task)
  - Support kanban board view
  - Support statuses: TODO, IN_PROGRESS, REVIEW, DONE, BLOCKED
  - Keep activity log on items
  - Notifications: assignment changes, impediments, review requests

## 9) Review workflow & notifications

### 9.1 Document lifecycle

Wiki documents flow through states:
  Draft → Public → In Review → Approved → Rejected → Archived

Rules:
  - Only humans can move into Approved/Rejected.
  - Reviewers must be explicitly assigned/tagged.

### 9.2 Notifications

Notifications are stored in their own collection (e.g. notifications if present or to be added).
A notification document must contain all required context:

  - recipientUserId or recipientEmail
  - author identity (userId, name, org/team if available)
  - link to artifact
  - reason/type (REVIEW_REQUEST, ASSIGNMENT, IMPEDIMENT, PUBLISHED, etc.)
  - createdAt
  - readAt / status

In-app notifications should render at top navigation and update on refresh; real-time push is optional for MVP.
Email/Teams notifications are “nice to have”, not required.

You should never change the following anymore unless discussed:
✅ Event system
events as append-only log
TTL applied
Strict <module>.<entity>.<verb> naming
correlationId consistently present
Event emission centralized in emitEvent()
This is textbook-clean.
✅ Comments → Events relationship
Comments stored as domain data
Events reference comments
ThreadId used as correlationId
Thread lifecycle emits events
This is exactly how Figma / Linear / Notion do it internally.
✅ Unread tracking
user_event_state in MongoDB
Timestamp-based logic
Resource-scoped last seen
No client-side hacks
This is production-grade.

## 10) Folder structure & project hygiene

### 10.1 Prefer /src

We prefer moving to a /src structure eventually:

  - /src/app/...
  - /src/components/...
  - /src/server/... (db, repos, auth helpers)
  - /src/lib/... (shared helpers)
  - /src/types/...

If currently no /src, avoid massive refactors unless already working on related areas. Small incremental moves are okay.

### 10.2 Dependency hygiene

  - Keep dependencies consistent and installable.
  - Do not pin to versions that don’t exist (example issue seen: markmap-common@0.17.2 or 0.19.9 not published).
  - Prefer caret ranges that resolve cleanly.

## 11) Security requirements

  - Never commit secrets (.env.local must stay local).
  - Sanitize all HTML rendering (rehype-sanitize).
  - Cookies:
    - httpOnly, secure in production, sameSite sane defaults
  - Rate limit auth endpoints if feasible (basic in-memory is fine for MVP).
  - Validate file uploads (size/type). Consider max upload size to avoid Mongo doc bloat.

## 12) Local development

Expected local setup:

  - docker compose up runs MongoDB + Next app.
  - Local auth enabled by default.
  - Seed data optional.

Define and maintain these scripts:

  - npm run dev
  - npm run build
  - npm run start
  - npm run lint (if configured)
  - npm run test (optional for MVP, but add later)

## 13) What “good” looks like (acceptance criteria)

A change is “done” when:

  - npm install succeeds cleanly
  - npm run dev boots without runtime crashes
  - No Next hydration warnings from markdown rendering (especially tables/colgroup)
  - Wiki markdown headings, tables, lists render correctly
  - Word-imported images display via stable URLs (no empty src)
  - DB access occurs only server-side
  - Repository pattern is followed for new DB interactions
  - Role checks prevent inappropriate actions (at least on critical operations: approve/reject, admin settings)

## 14) Guidance for Codex CLI / agents

When implementing features:

  - Start from route handler + repository + type definition.
  - Add UI changes only after the API shape is stable.
  - Prefer minimal dependencies; only add battle-tested libs.

When fixing bugs:

  - Reproduce locally.
  - Add a narrow fix (avoid giant refactor).
  - Add one or two regression checks (even simple runtime assertions/logging if no test harness yet).

### A few “known sharp edges” to watch for (from current codebase history)

Markdown rendering previously failed to show headings due to preprocessing/newline handling. Any markdown “normalization” must preserve heading lines exactly.
Hydration warnings can be caused by whitespace text nodes in illegal places (e.g. <colgroup>{"\n"}</colgroup>). Strip or sanitize those nodes.
Images can render with empty src if the markdown references a path that is not rewritten to a valid served URL. Never emit empty src.