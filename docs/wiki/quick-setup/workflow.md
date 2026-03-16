# Local Workflow and Troubleshooting

This page helps you work comfortably once the app is running.

## Recommended Daily Workflow

1. Start MongoDB:

```bash
docker compose up mongodb -d
```

Alternative if you want to bypass Docker Compose:

```bash
./run.sh mongo
```

2. Start the app:

```bash
npm run dev
```

Alternative if you want to run the app as a container instead of local Next.js development:

```bash
./run.sh
```

To rebuild the app image first:

```bash
./run.sh --rebuild
```

3. Open the product:

```text
http://localhost:3000
```

4. When needed, run:

```bash
npm run lint
npm run test:api
```

## When You Want Demo Content

Keep demo content optional.

To install sample data:

```bash
npm run db:seed-sample
```

To remove it:

```bash
npm run db:reset-sample
```

## Common Problems

### App cannot connect to MongoDB

Check:

- Docker Desktop is running
- the MongoDB container is up
- `MONGO_URL` points to `localhost:27017` for local Next.js development

Useful command:

```bash
docker ps
```

### Baseline data is missing

Run:

```bash
npm run db:bootstrap
```

### You changed environment variables but nothing changed

Restart the local Next.js process after updating `.env.local`.

### You want a clean demo reset

Use:

```bash
npm run db:reset-sample
npm run db:seed-sample
```

## When To Use Docker Compose for the Full Stack

Use full Docker Compose when:

- you want to test the containerized app
- you want fewer host-tool differences
- you are checking startup/bootstrap behavior

Use local `npm run dev` when:

- you are actively changing UI or route handlers
- you want fast reload during development

## When To Use `run.sh`

Use the root-level `run.sh` helper when:

- you want a quick path to start MongoDB with `docker run`
- you want to run the app container without using the compose file
- you want a simple rebuild-and-run flow for the containerized app

Use `npm run dev` instead when you are doing active development and want the fastest feedback loop.
