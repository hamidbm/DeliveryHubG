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
- Bundle capacity configuration stored in `bundle_capacity`
- Capacity planning uses milestone rollups (`remainingPoints`) and committed milestone dates

## Program Capacity (v1)
- Capacity is defined per bundle as points per week or points per sprint.
- Allocation rule: remaining milestone points are distributed evenly from now until the milestone end date (forecast end date if available).
- Overcommit is flagged when bucket demand exceeds bucket capacity.
- Recommended actions are heuristics: reduce scope, slip a milestone, or add capacity.
- Configure bundle capacity in Admin → Operations → Bundle Capacity.
