# FINAL DECISION — Seed Architecture (Authoritative Spec)

This document answers the open questions and defines the **final implementation design** for database seeding.

**This spec supersedes earlier versions.**

---

# 0. High-Level Model

We will use a **two-tier seed system**:

* **Tier A — Baseline (auto-installed)**

  * Product-required data
  * Must exist for app to function properly
  * Installed automatically at startup
  * Includes bundles/apps

* **Tier B — Sample (optional demo data)**

  * Demo-only content
  * Installed manually from Admin OR via env flag
  * Fully removable

---

# 1. Final Folder Structure

```
seed/
  baseline/
    taxonomy_categories.json
    taxonomy_document_types.json
    wiki_themes.json
    wiki_templates.json
    diagram_templates.json
    bundles.json
    (optional) system_settings.json

  sample/
    users.json
    bundle_assignments.json
    wiki_pages.json
    work_items.json
    diagrams.json
```

## Important rules

* Each file contains an **array of documents exactly as stored in MongoDB**
* Do NOT split CSS or transform documents
* Preserve `_id` if present
* No manifest files
* No tenant tier

---

# 2. Bundles / Apps Placement (FINAL)

**Bundles/apps belong to BASELINE.**

File:

```
seed/baseline/bundles.json
```

## Rationale

Bundles/apps:

* are required for the platform to function
* are referenced everywhere (wiki, diagrams, work items)
* are simple name metadata
* must exist on first boot

Teams will edit the JSON before deployment if needed.

---

# 3. Bootstrap State Collection (CRITICAL)

We WILL implement the robust versioned bootstrap system.

Collection:

```
system_bootstrap
```

Singleton document:

```
{
  _id: "bootstrap",

  baseline: {
    version: string,
    status: "installed" | "installing" | "failed",
    installedAt?: Date,
    installedBy?: string
  },

  sample: {
    version: string,
    status: "installed" | "installing" | "failed",
    installedAt?: Date,
    installedBy?: string
  },

  locks: {
    baseline?: { owner: string, expiresAt: Date },
    sample?: { owner: string, expiresAt: Date }
  }
}
```

---

# 4. Locking Requirements (MANDATORY)

This prevents multiple Railway instances from seeding simultaneously.

## Lock behavior

Before running a tier:

1. Attempt to acquire lock:

   * owner = hostname + pid
   * expiresAt = now + 5 minutes
2. Use atomic update to acquire
3. If lock exists and not expired → skip
4. Always release lock when done

## Lock TTL

**5 minutes lease** is sufficient.

---

# 5. Versioning Strategy

Hardcode versions in code (no manifest files).

Example constants:

```ts
const BASELINE_VERSION = "1.0.0";
const SAMPLE_VERSION = "1.0.0";
```

## Skip logic

If:

```
system_bootstrap.<tier>.version === CURRENT_VERSION
AND status === "installed"
```

→ skip seeding (no-op)

---

# 6. Upsert Strategy (FINAL — IMPORTANT)

## 6.1 Baseline

**Use `$setOnInsert` ONLY**

Baseline must be safe and never overwrite admin edits.

Pattern:

```
updateOne(filter, { $setOnInsert: doc }, { upsert: true })
```

### Applies to:

* taxonomy
* themes
* templates
* diagram templates
* bundles/apps

---

## 6.2 Sample

**Use `$set` with demo tag**

Every inserted sample document MUST include:

```
demoTag: "sample-v1"
```

Pattern:

```
updateOne(filter, { $set: { ...doc, demoTag } }, { upsert: true })
```

---

# 7. Environment Variables

## AUTO_BOOTSTRAP_BASELINE

Default behavior:

* If undefined → treat as **true**
* Baseline runs automatically at startup

## INSTALL_SAMPLE_DATA

Default:

* false
* If true → install sample automatically once

---

# 8. Startup Hook

Add server startup bootstrap:

```
lib/bootstrap/runBootstrap.ts
```

Behavior on server start:

1. Ensure Mongo connected
2. If AUTO_BOOTSTRAP_BASELINE !== false:

   * run baseline bootstrap
3. If INSTALL_SAMPLE_DATA === "true":

   * run sample bootstrap

**Must not run during Next build phase.**

---

# 9. Admin APIs

Create:

## Install sample

```
POST /api/admin/sample/install
```

Behavior:

* requires admin
* runs sample seeding

## Reset sample

```
POST /api/admin/sample/reset
```

Behavior:

* requires admin
* deletes docs by demoTag from known collections
* resets system_bootstrap.sample

---

# 10. CLI Scripts

Add package.json scripts:

```
"db:bootstrap": "tsx scripts/bootstrap-baseline.ts",
"db:seed-sample": "tsx scripts/bootstrap-sample.ts"
```

Scripts must reuse same bootstrap library.

---

# 11. Critical Guardrails

## ❌ DO NOT require Mongo at build time

No env validation at module import.

Only connect inside runtime functions.

## ❌ DO NOT overwrite baseline data

Baseline uses `$setOnInsert` only.

## ✅ Idempotency required

Running seed multiple times must be safe.

## ✅ Multi-instance safe

Locking is mandatory.

---

# 12. What Codex Should Implement Now (Phase 1)

Implement in this order:

1. system_bootstrap schema + helpers
2. lock acquisition/release
3. baseline seed runner
4. sample seed runner
5. startup hook
6. admin endpoints
7. CLI scripts

---

**This is the final authoritative design. Proceed with implementation.**
