<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DeliveryHub

DeliveryHub is an internal Software Delivery + Application Portfolio Management portal that consolidates program governance, execution, architecture, and documentation in one place. It is designed for large migration programs with hundreds of applications moving to cloud platforms.

Documentation
- Product wiki: `docs/wiki/Home.md`
- GitHub Wiki publishing: copy `docs/wiki/*` into the GitHub Wiki repository for this project

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
