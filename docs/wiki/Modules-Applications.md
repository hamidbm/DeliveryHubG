# Applications Module

The Applications module is the portfolio inventory and APM context layer for systems and services, with bundle-level profiles for executive visibility.

## Core Features
- Application registry and metadata
- Bundle profiles and ownership mapping
- Lifecycle, criticality, and migration status fields
- Portfolio-level search and filtering
- Cross-linking to architecture and wiki artifacts
- Application portfolio management (Phase 11):
  - portfolios
  - release trains
  - cross-application dependencies
  - lifecycle records
  - environment strategy

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

## APM Deep Build (Phase 11)
Phase 11 extends Applications into an Application Portfolio Management surface.

### Application Dashboard (Apps View)
Implemented summary cards:
- Applications count
- Lifecycle-tracked count
- Critical systems count
- Dependency count

### Application Detail Tabs
Implemented tabs:
- Overview
- Environments
- Dependencies
- Lifecycle
- Delivery Impact

### Overview (Context Metadata)
Implemented editable context fields:
- `portfolioId`
- `releaseTrain`
- `lifecycleStatus`
- `businessCriticality`
- `availabilityTier`
- `dataSensitivity`
- `operationalOwner`
- `businessOwner`
- `technicalOwner`

### Environments
Implemented:
- Schedule metadata editor (bundle/application scope behavior preserved)
- Environment grid and Go-Live fields
- Persisted planning and capacity defaults

### Dependencies
Implemented:
- Create/delete cross-application dependencies
- Dependency types: `API`, `DATA`, `EVENT`, `SHARED_INFRA`
- Criticality: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- Inbound/outbound display in application detail

### Lifecycle
Implemented:
- Lifecycle record API + UI persistence
- Stages: `ACTIVE`, `MAINTENANCE`, `SUNSETTING`, `RETIRED`
- Lifecycle owner and notes
- Sync of lifecycle stage to `applications.lifecycleStatus`

### Delivery Impact
Implemented:
- App-level impact summary:
  - inbound/outbound dependency counts
  - connected applications
  - shared release-train applications
  - impacted milestones
  - related work item count

## APIs (Implemented)
Applications:
- `GET /api/applications`
- `POST /api/applications`
- `GET /api/applications/{id}`
- `PUT /api/applications/{id}`
- `PATCH /api/applications/{id}`

Application portfolios:
- `GET /api/application-portfolios`
- `POST /api/application-portfolios`
- `GET /api/application-portfolios/{id}`
- `PUT /api/application-portfolios/{id}`

Release trains:
- `GET /api/release-trains`
- `POST /api/release-trains`
- `GET /api/release-trains/{id}`
- `PUT /api/release-trains/{id}`

Application dependencies:
- `GET /api/application-dependencies`
- `POST /api/application-dependencies`
- `DELETE /api/application-dependencies/{id}`
- `GET /api/applications/{id}/dependencies`

Lifecycle / environment strategy / impact:
- `GET /api/applications/{id}/lifecycle`
- `PUT /api/applications/{id}/lifecycle`
- `GET /api/applications/{id}/environment-strategy`
- `PUT /api/applications/{id}/environment-strategy`
- `GET /api/applications/{id}/delivery-impact`

## Data
- Applications stored in `applications`
- Bundles stored in `bundles`
- Bundle profiles stored in `bundle_profiles`
- Bundle assignments stored in `bundle_assignments`
- Application planning metadata stored in `application_planning_metadata`
- Application portfolios stored in `application_portfolios`
- Application dependencies stored in `application_dependencies`
- Lifecycle records stored in `application_lifecycle`
- Environment strategy stored in `application_environment_strategy`
- Release trains stored in `release_trains`

## Tests (Implemented)
- `scripts/test-application-portfolios.ts`
- `scripts/test-application-dependencies.ts`
- `scripts/test-environment-strategy.ts`
