# DeliveryHub

DeliveryHub is an internal Software Delivery + Application Portfolio Management portal that consolidates program governance, execution, architecture, and documentation in one place. It is designed for large migration programs with hundreds of applications moving to cloud platforms.

Documentation
- Entry point: `docs/wiki/Home.md`
- Full docs index: `docs/wiki/Modules-Overview.md`

## Documentation Table of Contents
1. [docs/wiki/Home.md](docs/wiki/Home.md)
2. [docs/wiki/Architecture.md](docs/wiki/Architecture.md)
3. [docs/wiki/Modules-Overview.md](docs/wiki/Modules-Overview.md)
4. [docs/wiki/Modules-Wiki.md](docs/wiki/Modules-Wiki.md)
5. [docs/wiki/Modules-WorkItems.md](docs/wiki/Modules-WorkItems.md)
6. [docs/wiki/Modules-Applications.md](docs/wiki/Modules-Applications.md)
7. [docs/wiki/Modules-Architecture.md](docs/wiki/Modules-Architecture.md)
8. [docs/wiki/Modules-Dashboards.md](docs/wiki/Modules-Dashboards.md)
9. [docs/wiki/Admin.md](docs/wiki/Admin.md)
10. [docs/wiki/AI.md](docs/wiki/AI.md)
11. [docs/wiki/Data-Model.md](docs/wiki/Data-Model.md)
12. [docs/wiki/Operations.md](docs/wiki/Operations.md)
13. [docs/wiki/Development.md](docs/wiki/Development.md)
14. [docs/wiki/Roadmap.md](docs/wiki/Roadmap.md)

## What It Does
- Work Items management with hierarchy, kanban, and analytics
- Wiki for pages and uploaded assets with AI assistance
- Architecture diagrams and integration views
- Applications portfolio inventory
- Dashboards and AI Insights for executive rollups
- Admin tooling for taxonomy, themes, and AI governance

## Architecture
- Next.js App Router with server-side MongoDB access
- BFF design with API routes as the integration surface
- Assistive AI with explicit user actions
- Auditability for AI usage and content insights

## Project Structure
- `src/app`: routes, layouts, API handlers
- `src/components`: UI components
- `src/lib`: shared helpers
- `src/services`: DB and AI services
- `src/types.ts`: shared types

## Run Locally
Prerequisites
- Node.js

Steps
1. Install dependencies: `npm install`
2. Set environment variables in `.env.local`
3. Run the app: `npm run dev`
4. Run lint (CI-safe): `npm run lint:ci`

## Environment Variables
- `AUTH_MODE`
- `AUTH_DISABLE_LOCAL_SIGNUP`
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_CLIENT_SECRET`
- `ENTRA_REDIRECT_URI`
- `ENTRA_SCOPES`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
