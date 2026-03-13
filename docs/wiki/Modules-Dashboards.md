# Dashboards and AI Insights

Dashboards provide program-level rollups for milestones, risks, and delivery status. AI Insights provide summaries and highlights.

## Features
- Portfolio-level dashboards
- Delivery and milestone analytics
- AI Insights module for synthesized reporting
- Executive rollups across applications, bundles, and milestones
- Visual summaries for risks and progress
- Program Capacity planning (bundle capacity vs. committed milestone demand)

## Data
- Stored in module-specific collections
- AI Insights uses AI settings and audit logs
- AI Insights portfolio report persistence uses `ai_analysis_cache` (`portfolio-summary`)
- Bundle capacity configuration stored in `bundle_capacity`
- Capacity planning uses milestone rollups (`remainingPoints`) and committed milestone dates

## AI Insights (Phase 12A)
- Page load is cache-first (`GET /api/ai/portfolio-summary`), with no automatic live generation.
- Manual refresh only (`POST /api/ai/portfolio-summary`) via `Generate/Regenerate Analysis`.
- Freshness policy:
  - `fresh` within 24 hours
  - `stale` older than 24 hours (still shown with stale banner)
- First-run experience:
  - empty state when no cached report exists
  - explicit generate action required
- Failure behavior:
  - normalized provider quota/rate-limit errors
  - fallback to last successful cached report when live generation fails
- Exports:
  - Markdown download
  - styled PDF download (direct file save)

## AI Insights (Phase 12B)
- Structured report sections now drive the primary UI:
  - Overall Health
  - Executive Summary
  - Top Risks
  - Recommended Actions
  - Concentration Signals
  - Questions To Ask
  - Full Narrative Report (collapsible)
- Structured report items now include evidence and provenance metadata:
  - `provenance: ai | deterministic | legacy`
- Deterministic enrichment/fallback layer now improves weak or malformed AI output:
  - risk/action/signal/question synthesis using snapshot-derived ratios and counts
  - severity/urgency normalization rules
- Legacy cache normalization remains supported and visible, with narrative fallback available.
- 12B.5 introduced interactive Q&A in AI Insights:
  - **Ask DeliveryHub AI** panel for free-text portfolio questions
  - quick suggestions generated from the current structured report/signals
  - evidence-backed responses with concise explanation and follow-up prompts
  - follow-up prompts are actionable chips that can be re-run as new queries
  - API endpoint: `POST /api/ai/portfolio-query`
- 12C.1 added evidence exploration and drill-down:
  - structured and query evidence now use typed `EvidenceItem[]` with `entities[]`
  - entity references include `workitem`, `application`, `bundle`, `milestone`, `review`
  - AI Insights evidence blocks now render clickable entity chips and grouped **Related Entities**
  - drill-down links navigate to existing DeliveryHub pages/views without regenerating AI content
  - when no entity refs exist, evidence still renders as plain text
- 12C.2 refined related-entity usability:
  - related entities now render in bounded contextual panels per type (work items, milestones, reviews, applications, bundles)
  - per-group ordering is relevance-first (e.g., blocked/overdue/unassigned before less urgent work items)
  - panel limits and toggle behavior:
    - default 5 items shown per group
    - if group has more than 50 items, initial display is 15
    - `View all` / `Show less` supported for oversized groups
  - backend-driven secondary metadata is provided through `relatedEntitiesMeta` and rendered as actionable subtitles
- 12C.3 expanded Ask DeliveryHub AI query coverage:
  - deterministic query intents now include operational/ranking categories (work items, bundles, applications, milestones, reviews, owners, risk ranking)
  - list-style deterministic answers are evidence-backed with entity references
  - contextual deterministic follow-up suggestions are generated per query result
  - extractor-backed deterministic metrics are reused across intents (`src/services/ai/knowledgeExtractors.ts`)
  - query-time behavior remains snapshot/signals/report-based (no additional DB fetches required for deterministic answer generation)
- Visual sequence diagrams for cache/regenerate/query/drill-down are documented in `docs/wiki/AI.md` under **Visual Flows**.

## Program Capacity (v1)
- Capacity is defined per bundle as points per week or points per sprint.
- Allocation rule: remaining milestone points are distributed evenly from now until the milestone end date (forecast end date if available).
- Overcommit is flagged when bucket demand exceeds bucket capacity.
- Recommended actions are heuristics: reduce scope, slip a milestone, or add capacity.
- Configure bundle capacity in Admin → Operations → Bundle Capacity.
