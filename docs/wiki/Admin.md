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

## Access
- Admin-only for all sections.

## Samples Import
The Samples module allows admins to import curated seed data from `seed/collections` into the database.

- Idempotent upsert by `_id`
- Optional collection checklist
- “Import All” for full dataset

## Data
- Stored in collections such as `taxonomy_document_types`, `taxonomy_categories`, `bundles`, `wiki_themes`, `diagram_templates`, `ai_settings`, `bundle_assignments`, and `admins`.
