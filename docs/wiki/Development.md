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
- `npm run lint:ci`
- `npm run test:api`
- `npm run db:bootstrap`
- `npm run db:seed-sample`
- `npm run db:reset-sample`
- `npm run db:export-baseline`
- `npm run seed:export`

## API Regression Tests
Run the API regression suite with:
- `npm run test:api`

Required environment:
- `MONGO_URL` (test harness will create isolated test DBs)
- `JWT_SECRET` (optional; defaults to dev secret if omitted)

Notes:
- Tests create temporary databases and drop them after completion.
- If running in CI, ensure MongoDB is reachable and `MONGO_URL` is set.

## Source Layout
- `src/app`: Next.js routes and API handlers
- `src/components`: UI components
- `src/lib`: shared helpers
- `src/services`: DB and AI services
- `src/types.ts`: shared types
