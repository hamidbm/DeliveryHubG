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

## Program Capacity (v1)
- Capacity is defined per bundle as points per week or points per sprint.
- Allocation rule: remaining milestone points are distributed evenly from now until the milestone end date (forecast end date if available).
- Overcommit is flagged when bucket demand exceeds bucket capacity.
- Recommended actions are heuristics: reduce scope, slip a milestone, or add capacity.
- Configure bundle capacity in Admin → Operations → Bundle Capacity.
