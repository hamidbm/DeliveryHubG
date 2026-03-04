# Admin Module

The Admin module configures global settings, reference data, and governance controls.

## Modules
- Bundles
- Applications
- Taxonomy (categories, document types)
- Wiki themes
- Wiki templates
- Diagram templates
- AI settings
- Admin registry
- Bundle assignments (ownership mapping)
- Work blueprints
- Work generators
- Samples (import curated seed data)
- Audit • Events
- Audit • Notifications
- Notification Policy (global notification settings)
- Delivery Policy (governance thresholds)
- Jira integration (one-way sync)
- GitHub integration (one-way PR enrichment)
- Backup & Restore (config export/import)

## Access
- Admin-only for configuration and governance sections.
- Admin/CMO can access Audit consoles (events + notifications).

## Samples Import
The Samples module allows admins to import curated seed data from `seed/sample` into the database.

- Idempotent upsert by `_id` (or `_seedKey` fallback)
- Optional collection checklist
- “Import All” for full dataset
- “Reset Sample” removes only `demoTag: "sample-v1"`

## Data
- Stored in collections such as `taxonomy_document_types`, `taxonomy_categories`, `bundles`, `wiki_themes`, `diagram_templates`, `ai_settings`, `bundle_assignments`, and `admins`.

## Notifications Policy
Admins/CMO can configure notification policy in Admin → Settings → Notifications. This controls:
- Which notification types are enabled
- Routing rules (admins, bundle owners, actor-on-blocked)
- Digest behavior (daily, hour)

## Delivery Policy
Admins/CMO can configure global governance thresholds in Admin → Settings → Delivery Policy. This controls:
- readiness thresholds for milestones and sprints
- data quality scoring weights and caps
- forecasting band thresholds
- critical path slack and external defaults
- staleness thresholds and nudge/digest behavior

### Bundle Policy Overrides
Admins/CMO can set bundle-specific overrides that inherit from the global policy.

- Overrides are stored per bundle and only include the fields you change.
- Effective policy = global policy merged with bundle overrides.
- Rollups and readiness calculations show which policy versions were used.
- Use “Reset to Global” to remove the override and revert to global policy.

## Backup & Restore
Admin → Operations → Backup & Restore provides safe export/import for config and planning metadata:
- Export JSON bundles for policies, bundles, milestones, assignments, and scope requests
- Dry-run diffs before applying
- Apply requires confirmation phrase `IMPORT_BACKUP`

## Jira Integration (v1)
DeliveryHub supports a one-way Jira sync (Jira → DeliveryHub) from Admin → Integrations → Jira.

Required environment variables:
- `JIRA_HOST`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_PROJECT_KEYS` (comma-separated)

Optional:
- `JIRA_STORY_POINTS_FIELD_ID`
- `JIRA_STATUS_MAPPING` (JSON map from Jira status to DeliveryHub status)

Admins can preview and run a manual sync. Sync updates titles, status, story points, and assignee, and creates new work items when needed.

## GitHub Integration (v1)
DeliveryHub supports a one-way GitHub PR enrichment from Admin → Integrations → GitHub.

Required environment variables:
- `GITHUB_TOKEN`
- `GITHUB_REPOS` (comma-separated `owner/repo`)

Admins can preview and run a manual sync. Sync links pull requests to work items when the PR title/body/branch contains a work item key (e.g., `ABC-123`). Linked PRs appear on work item details and GitHub activity signals appear in critical path panels.
