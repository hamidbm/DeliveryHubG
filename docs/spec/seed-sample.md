# DeliveryHub — Baseline & Sample Data Seeding Specification

## Purpose

This document defines the **official seeding architecture** for NexusDelivery.

Goals:

1. Ensure the application is usable immediately after deployment.
2. Separate **baseline (required)** data from **sample (demo)** data.
3. Avoid database requirements at build time.
4. Make bundle/app metadata configurable.
5. Provide deterministic, idempotent seeding.
6. Support Railway, Docker, and local environments.

---

# 🔷 Data Classification

## Category A — Baseline (Required for all tenants)

This data must exist for the system to function properly.

Examples:

* Wiki themes (CSS)
* Taxonomy categories
* Taxonomy document types
* Wiki templates
* Diagram templates
* Bundle/App names (metadata only)

Characteristics:

* Environment-agnostic
* Installed automatically
* Idempotent
* Version-controlled in repo

---

## Category B — Sample (Demo Only)

Optional data used for demos and testing.

Examples:

* Demo bundles metadata extensions
* Users
* Wiki pages
* Work items
* Architecture diagrams
* Sample relationships

Characteristics:

* Optional
* Installed manually or via env flag
* Safe to wipe
* Not required for production

---

# 🔷 Repository Structure (MANDATORY)

Codex must create:

```
/seed
  /baseline
    bundles.json
    taxonomy_categories.json
    taxonomy_document_types.json
    wiki_themes.json
    wiki_templates.json
    diagram_templates.json

  /samples
    users.json
    bundles_extended.json
    wiki_pages.json
    work_items.json
    diagrams.json

/scripts
  export-baseline.ts
  seed-baseline.ts
  seed-samples.ts
```

---

# 🔷 CRITICAL DESIGN RULES

## ❗ Rule 1 — NO DB REQUIRED AT BUILD TIME

The app **MUST NEVER** require MongoDB during:

* next build
* Docker build
* CI

All DB access must happen:

* at runtime
* or via explicit scripts

---

## ❗ Rule 2 — Idempotent Seeding

Every seeding operation must:

* Upsert by stable key
* Never duplicate data
* Be safe to run multiple times

---

## ❗ Rule 3 — Preserve Documents As-Is

Per your decision (Option 1):

✅ Export documents exactly as stored in MongoDB
✅ Do NOT split CSS from wiki themes
✅ Do NOT transform schema

Example wiki theme document (from DB):



This entire document must be stored verbatim inside:

```
seed/baseline/wiki_themes.json
```

---

# 🔷 Export Format (VERY IMPORTANT)

## ✅ One collection = one JSON file

Each file contains an **array of documents**.

### Example

**taxonomy_categories.json**

```json
[
  { ...doc1 },
  { ...doc2 },
  { ...doc3 }
]
```

NOT:

❌ one file per document
❌ nested by key
❌ transformed

---

# 🔷 Bundle/App Configuration (Special Case)

Bundles/apps are required metadata.

They belong to baseline.

## Required format

`seed/baseline/bundles.json`

```json
[
  {
    "name": "Customer Platform",
    "apps": [
      { "name": "customer-api" },
      { "name": "customer-ui" }
    ]
  }
]
```

## Rules

* Bundle name is the unique key
* App name unique within bundle
* No environment-specific metadata here
* Only names

---

# 🔷 Environment Variables

## Required

```bash
AUTO_BOOTSTRAP_BASELINE=true
INSTALL_SAMPLE_DATA=false
```

## Behavior

### AUTO_BOOTSTRAP_BASELINE=true (default ON)

On server startup:

* Check if baseline installed
* If missing → install automatically
* Must be fast and safe

### INSTALL_SAMPLE_DATA=true

If enabled:

* Install sample data at startup
* Otherwise only via Admin UI

---

# 🔷 Baseline Seeder (Runtime)

Codex must implement:

```
/scripts/seed-baseline.ts
```

## Responsibilities

1. Connect to MongoDB
2. For each baseline file:

   * Load JSON
   * Upsert documents
3. Use stable keys

---

## Upsert Keys

| Collection              | Unique Key  |
| ----------------------- | ----------- |
| wiki_themes             | key         |
| taxonomy_categories     | key or name |
| taxonomy_document_types | key         |
| wiki_templates          | key         |
| diagram_templates       | key         |
| bundles                 | name        |

---

## Example Upsert Pattern

```ts
await collection.updateOne(
  { key: doc.key },
  { $setOnInsert: doc },
  { upsert: true }
);
```

---

# 🔷 Sample Seeder

Codex must implement:

```
/scripts/seed-samples.ts
```

## Behavior

* Only runs when:

  * Admin clicks button OR
  * INSTALL_SAMPLE_DATA=true
* Can insert richer demo data
* Should also be idempotent where possible

---

# 🔷 Baseline Auto-Bootstrap (SERVER SIDE)

Codex must add a bootstrap module:

```
/src/lib/bootstrapBaseline.ts
```

## Behavior

On server start:

1. If `AUTO_BOOTSTRAP_BASELINE !== false`
2. Check sentinel document:

```
collection: system_flags
key: baseline_installed
```

3. If missing:

* run baseline seeder
* set flag

---

## Sentinel Document

```json
{
  "key": "baseline_installed",
  "installedAt": ISODate
}
```

---

# 🔷 Admin UI Requirement (Future Hook)

Admin module must expose:

* “Install Sample Data” tile
* Calls API endpoint:

```
POST /api/admin/install-samples
```

Which triggers:

```
seed-samples.ts
```

---

# 🔷 Export Script

Codex must implement:

```
/scripts/export-baseline.ts
```

## Behavior

For each baseline collection:

1. Read all documents
2. Remove MongoDB internal fields ONLY if necessary:

   * `_id` should be preserved as string OR removed consistently
3. Write to correct file

---

# 🔷 Railway Compatibility

All scripts must:

* Read `MONGODB_URI` at runtime
* Never require DB at build
* Work in container environments

---

# 🔷 Non-Goals (Important)

Codex must NOT:

* ❌ Require Mongo during next build
* ❌ Require Mongo during Docker build
* ❌ Hardcode bundle names
* ❌ Split CSS from theme documents
* ❌ Create one file per document
* ❌ Make seeding non-idempotent

---

# 🔷 Acceptance Criteria

Baseline is considered correct when:

* Fresh DB → app usable immediately
* Baseline runs exactly once
* Re-running seed does nothing harmful
* Sample data optional
* Works on Railway
* Works in Docker
* Works locally
* No build-time DB dependency

---

# 🔷 Next Phase (Not in this task)

Future enhancements may include:

* Baseline versioning
* Tenant-aware seeding
* Partial bundle overrides
* Seed diffing

(Not required now.)

---

# ✅ END OF SPEC

Codex: implement exactly as described.
