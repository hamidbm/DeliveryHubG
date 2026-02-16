# Development Workflow

This section describes how to work on DeliveryHub safely and consistently.

## Guidelines
- Follow App Router conventions for new routes
- Keep DB access server-side only
- Prefer repository-style functions in `src/services/db.ts`
- Add UI changes after API shapes are stable
- Avoid breaking markdown rendering and sanitization

## Common Commands
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Source Layout
- `src/app`: Next.js routes and API handlers
- `src/components`: UI components
- `src/lib`: shared helpers
- `src/services`: DB and AI services
- `src/types.ts`: shared types
