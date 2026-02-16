# Data Model

DeliveryHub uses a domain-driven MongoDB schema. Each collection maps to one conceptual domain.

## Core Collections
- `users`
- `work_items`
- `wiki_pages`
- `wiki_assets`
- `wiki_history`
- `wiki_spaces`
- `wiki_themes`
- `applications`
- `architecture_diagrams`
- `interfaces`
- `milestones`
- `bundles`
- `capabilities`
- `taxonomy_categories`
- `taxonomy_document_types`
- `ai_settings`
- `ai_audit_logs`
- `ai_rate_limits`
- `wiki_ai_insights`

## Notes
- MongoDB is schema-flexible but types are defined in `src/types.ts`
- Images extracted from Word are stored within `wiki_assets` and served through an API route
