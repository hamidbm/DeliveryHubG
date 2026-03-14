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

## AI Insights (Phase 12A)
- Cache-first portfolio report experience:
  - `GET /api/ai/portfolio-summary` reads latest persisted report from `ai_analysis_cache`
  - `POST /api/ai/portfolio-summary` manually regenerates report and persists it
- No automatic provider generation on page visit
- First-run explicit generate flow when no cached report exists
- Freshness policy:
  - `fresh` if generated within 24 hours
  - `stale` if older than 24 hours (still displayed, with stale banner)
- Provider failure handling:
  - normalized quota/rate-limit/credentials errors
  - attempted provider metadata retained for diagnostics
  - cached success returned when live generation fails
- Report rendering/export:
  - markdown rendered in app with wiki-style presentation
  - markdown export
  - styled PDF direct download

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
Auth and Access
- `AUTH_MODE`
- `AUTH_DISABLE_LOCAL_SIGNUP`
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_CLIENT_SECRET`
- `ENTRA_REDIRECT_URI`
- `ENTRA_SCOPES`
- `JWT_SECRET`
- `ADMIN_BOOTSTRAP_EMAILS`

Database
- `MONGO_URL`

AI Providers and Routing
- `AI_DEFAULT_PROVIDER`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `HUGGINGFACE_API_KEY`
- `COHERE_API_KEY`

Integrations
- `GITHUB_TOKEN`
- `GITHUB_REPOS`
- `JIRA_HOST`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_PROJECT_KEYS`
- `JIRA_STORY_POINTS_FIELD_ID`
- `JIRA_STATUS_MAPPING`

Bootstrap and Seeding
- `AUTO_BOOTSTRAP_BASELINE`
- `INSTALL_SAMPLE_DATA`
- `BOOTSTRAP_FORCE`
- `SEED_SAMPLE_DIR`
- `DEBUG_BOOTSTRAP`

Schedulers and Jobs
- `DIGEST_CRON_SECRET`
- `COMMIT_DRIFT_CRON_SECRET`
- `WEEKLY_BRIEF_CRON_SECRET`

Admin and Runtime
- `ADMIN_EXPORT_SECRET`
- `FEEDBACK_DOCUMENT_TYPE`
- `DEBUG_ROADMAP`
- `NODE_ENV`
- `NEXT_PHASE`
