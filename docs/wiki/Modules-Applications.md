# Applications Module

The Applications module is the portfolio inventory for systems and services, with bundle-level profiles for executive visibility.

## Core Features
- Application registry and metadata
- Bundle profiles and ownership mapping
- Lifecycle, criticality, and migration status fields
- Portfolio-level search and filtering
- Cross-linking to architecture and wiki artifacts

## Bundle Profiles
- Bundle summary and key metrics
- Ownership and executive accountability (driven by Admin → Bundle Assignments)
- Milestone status rollups
- Recent activity feed for bundle-scoped governance, scope, and dependency changes
- Weekly Executive Brief card (bundle-level narrative and drivers)
- Risks & Dependencies tab (read-only summary from Work Items)
  - Open risks count
  - High severity risks
  - Blocking dependencies
  - Quick-create risk/dependency work items

## Application Planning Metadata (Phase 9.2A Extension)
- Planning metadata is stored in `application_planning_metadata` with **bundle scope** and **application scope**
- Bundle metadata provides shared defaults across apps; application metadata overrides bundle values when set
- Bundle profile → Schedule edits the bundle-level defaults directly
- Applications → Schedule uses an environment grid (DEV, SIT, INT, UAT, PROD) with Edit/Save/Cancel
- Go‑Live has a dedicated planned/actual field (separate from PROD)
- Planning defaults, capacity defaults, and notes are persisted in the same metadata record
- Core application records remain in `applications`
- This metadata will drive Work Items delivery plan intake defaults in Phase 9.2B

## Data
- Applications stored in `applications`
- Bundles stored in `bundles`
- Bundle profiles stored in `bundle_profiles`
- Bundle assignments stored in `bundle_assignments`
- Application planning metadata stored in `application_planning_metadata`
