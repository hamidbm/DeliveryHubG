# Delivery Plan Phase 4: Roadmap Intelligence Hardening

## Purpose

Phase 4 augments the roadmap views with standardized intelligence signals. No planning logic or persistence changes are introduced; all signals are derived dynamically in view models.

## Goals

- Compute milestone health and capacity utilization signals
- Highlight dependency pressure and blocked milestones
- Apply consistent heatmap semantics across roadmap views
- Centralize intelligence computation in view models

## Non‑Goals

- No new planning entities or persistence
- No simulation or forecasting changes
- No capacity optimization logic

## Intelligence Model

Each milestone computes:

```
MilestoneIntelligence {
  readiness: NOT_READY | PARTIAL | READY
  confidence: LOW | MEDIUM | HIGH
  targetCapacity: number | null
  committedLoad: number
  remainingLoad: number
  utilizationPercent: number | null
  utilizationState: UNDERFILLED | HEALTHY | AT_RISK | OVERLOADED
  blockedItemCount: number
  dependencyInbound: number
  dependencyOutbound: number
  riskLevel: LOW | MEDIUM | HIGH
  overflow: boolean
}
```

## Calculation Rules

### Utilization

```
utilizationPercent = committedLoad / targetCapacity
```

State thresholds:
- < 70% → UNDERFILLED
- 70%–100% → HEALTHY
- 100%–120% → AT_RISK
- > 120% → OVERLOADED

### Risk Score (default heuristic)

- utilizationPercent > 1.1 → +2
- blockedItemCount > 3 → +2
- dependencyInbound > 2 → +1
- milestone starts within 7 days and readiness != READY → +2

Risk Level:
- 0–1 → LOW
- 2–3 → MEDIUM
- 4+ → HIGH

### Readiness

Derived from planning completeness using:
- missing estimates
- missing sprint assignments

### Confidence

- HIGH by default
- MEDIUM if risk is MEDIUM
- LOW if risk is HIGH or overflow

## Implementation

### View Model Helpers

`src/components/roadmap/roadmapViewModels.ts` now includes:

- `computeCapacityUtilization`
- `computeRiskScore`
- `computeDependencyPressure`
- `computeMilestoneIntelligence`
- `buildRoadmapIntelligence`

### Views Updated

- Execution Board: milestone header badges for utilization, risk, blocked, readiness, confidence
- Timeline: heatmap bars with intelligence tooltip
- Swimlane: heatmap cells with readiness, utilization, blocked, risk
- Dependency: milestone nodes with inbound/outbound pressure and risk

## Testing

Add logic tests:

- `scripts/test-roadmap-intelligence.ts`
  - utilization calculation
  - risk scoring
  - dependency pressure
  - readiness classification

Snapshot tests from Phase 3 remain unchanged.

## Acceptance Criteria

- All views reflect the same intelligence logic
- Heatmap colors are consistent
- No new persistence introduced
- Intelligence tests pass

## Implementation Status

Status: Completed

Validation:
- `npm run test:api` passes
- roadmap intelligence tests pass
- roadmap snapshot file regenerated and committed

Notes:
- snapshot determinism is based on a fixed mock dataset and can be re-verified with:
  `node --import tsx scripts/gen-roadmap-views-snapshots.tsx`
