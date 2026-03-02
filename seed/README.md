# Seed Data

DeliveryHub uses a two-tier seeding system:

- **Baseline** (required): installed automatically at startup.
- **Sample** (optional): demo data installed manually by Admin or via env flag.

## Folder Layout

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

Each file contains **an array of MongoDB documents**.

## Baseline Auto-Bootstrap

Baseline seeding runs at startup unless explicitly disabled.

Environment variable:

```
AUTO_BOOTSTRAP_BASELINE=true
```

## Sample Seeding

Sample seeding is **manual** by default:

- Admin → Samples → Install Sample Data

Or automatically by env flag:

```
INSTALL_SAMPLE_DATA=true
```

## CLI

```bash
npm run db:bootstrap     # baseline
npm run db:seed-sample   # sample
```

## Export Helpers

```bash
MONGODB_URI="mongodb://..." npm run db:export-baseline
MONGODB_URI="mongodb://..." npm run db:export-sample
```

## Reset Sample Data

Admin → Samples → Reset Sample Data

This removes only documents tagged with `demoTag: "sample-v1"`.
