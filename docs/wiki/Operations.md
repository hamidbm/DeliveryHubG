# Operations and Deployment

DeliveryHub is designed for internal deployment and supports local development with Docker and Next.js.

## Local Development
- `npm install`
- `npm run dev`

## Build and Run
- `npm run build`
- `npm run start`

## Seeding
Baseline seeding runs automatically at startup unless disabled:

- `AUTO_BOOTSTRAP_BASELINE=true` (default)
- `INSTALL_SAMPLE_DATA=true` (optional)

CLI helpers:
- `npm run db:bootstrap` (baseline)
- `npm run db:seed-sample` (sample)
- `npm run db:reset-sample` (remove demo data)
- `npm run db:export-baseline` (export baseline JSON)
- `npm run seed:export` (export all collections to `seed/all`)

## Docker
- `docker-compose.yml` provides MongoDB and app containers
- Use local auth by default

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
- `ANTHROPIC_API_KEY`
- `HUGGINGFACE_API_KEY`
- `COHERE_API_KEY`
- `DIGEST_CRON_SECRET`
- `COMMIT_DRIFT_CRON_SECRET`
- `WEEKLY_BRIEF_CRON_SECRET`
- `ADMIN_EXPORT_SECRET`

## Digest Automation
Daily digests can be sent via a cron-invoked endpoint:

- `POST /api/admin/notifications/digest/run`
- Header: `X-Cron-Secret: <DIGEST_CRON_SECRET>`
- Optional query: `dryRun=true`, `force=true`, `batchSize`, `maxUsers`

MVP assumption: the cron runs at the configured hour in server time (no per-user timezone yet).

Digest enrichment:
- A stale work summary (`workitem.stale.summary`) is queued during digest runs when applicable.

Staleness nudges:
- Nudge activity is stored in `staleness_nudges` for cooldown and rate limiting.

## Commitment Drift Scheduler
Commitment drift can be batch-evaluated on a schedule to avoid per-milestone UI calls.

Endpoint:
- `POST /api/admin/commit-drift/run`
- Header: `X-Cron-Secret: <COMMIT_DRIFT_CRON_SECRET>`
- Optional query: `dryRun=true`, `force=true`, `batchSize`, `maxMilestones`

Recommended cadence:
- Hourly or daily (hourly for active programs, daily for small pilots)

UI behavior:
- Roadmap/Program surfaces use cached drift snapshots.
- If a snapshot is missing or stale, the UI shows “Drift unknown” with a manual refresh.

## Weekly Brief Scheduler
Weekly executive briefs can be generated via cron:

- `POST /api/admin/briefs/weekly/run`
- Header: `X-Cron-Secret: <WEEKLY_BRIEF_CRON_SECRET>`
- Optional query: `weekKey=YYYY-WW`, `includeMilestones=true`, `force=true`

Recommended cadence:
- Weekly (Monday morning), optionally daily during heavy change windows.

## Ops Dashboard (SLO + Performance)
Admin → Operations → Ops Dashboard surfaces operational health without external tooling.

What you can monitor:
- Job health (digest runs, drift scheduler, weekly briefs, GitHub sync)
- API latency (p50/p95) for core endpoints
- Cache effectiveness (policy, critical path, and other expensive computations)
- Notification volume by type/day

Filters:
- Window: 1d / 7d / 30d (controls aggregation window)

Troubleshooting:
- High p95 latency: open Admin → Audit → Events filtered by the perf event type to inspect recent payloads.
- Rising cache misses: verify caches are enabled and request patterns are stable.
- Job failures: compare failuresLast7d and lastOk to identify recurring errors.

## Backup & Restore (Admin/CMO)
DeliveryHub supports export/import of configuration and planning metadata to promote between environments.

Export:
- `GET /api/admin/backup/export?include=policies,overrides,bundles,...`
- Optional header: `X-Admin-Export-Secret` if `ADMIN_EXPORT_SECRET` is set.

Import:
- `POST /api/admin/backup/import`
- Modes: `DRY_RUN` or `APPLY`
- `APPLY` requires confirmation phrase `IMPORT_BACKUP`
- Supports safe upserts and optional overwrite of global policy/overrides

Recommended cadence:
- Export before major governance changes
- Import during environment promotions (dev → staging → prod)

## Event Taxonomy
DeliveryHub events are stored as append-only logs. To stabilize naming without breaking history, the system normalizes event types at read time.

Canonical fields:
- `type` (raw stored type)
- `canonicalType`
- `category`
- `modulePrefix`

Core categories:
- `governance` (milestones/sprints status and readiness)
- `scope` (scope change lifecycle)
- `dependency` (dependency relationships)
- `criticalpath` (critical path actions)
- `integrations` (Jira/GitHub sync and related activity)
- `notifications`
- `security`
- `perf`

Alias mapping examples:
- `workitem.github.linked` → `workitem.github.pr.linked`
- `workitem.github.merged` → `workitem.github.pr.merged`

APIs returning events (`/api/feed`, `/api/admin/events`) include canonical fields so UI filtering is stable.
