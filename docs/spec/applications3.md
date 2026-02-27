> how to track dependencies and risks for bundles? Should they be some tabs in the "Application " module or should we track them in "Work Items" (Jira tasks equivalent)?
>
> Short answer: **track them as Work Items**, surface them in Applications.
>
> Do **not** create a separate “risks & dependencies” subsystem inside Applications. That will fragment workflow and duplicate Jira-like functionality you already have.
>
> But — and this is the important nuance — **Applications (bundle profile) must aggregate and visualize them** so executives and managers don’t have to dig into Work Items.
>
> Below is the clean architecture.
>
> The correct separation of concerns
> ==================================
>
> Work Items = system of record (authoritative)
> ---------------------------------------------
>
> Risks and dependencies are **living workflow objects**. They have:
>
> *   owners
>
> *   comments
>
> *   status changes
>
> *   due dates
>
> *   history
>
> *   cross-team coordination
>
>
> That is exactly what your Work Items module is built for.
>
> So:
>
> ✅ Create / update / comment / assign → **Work Items**❌ Create risks inside Applications → **don’t do this**
>
> Applications (Bundles) = situational awareness layer
> ----------------------------------------------------
>
> Applications should answer:
>
> > “Is this bundle healthy and what is blocking it?”
>
> So the bundle profile **surfaces and summarizes**:
>
> *   open risks count
>
> *   high risks
>
> *   blocking dependencies
>
> *   overdue items
>
>
> But it does **not own the workflow**.
>
> Recommended model (DeliveryHub-native)
> ======================================
>
> Work Item types (add if not present)
> ------------------------------------
>
> You should have (or add):
>
> *   risk
>
> *   dependency
>
> *   (optionally) issue or blocker
>
>
> Each Work Item already behaves like Jira.
>
> Required linkage
> ----------------
>
> Every risk/dependency Work Item should include:

```typescript
context: {
  bundleId: string   // REQUIRED
  appId?: string     // optional (rare)
}
```

> BundleId is the key join.
>
> What to add to Applications (Bundles)
> =====================================
>
> Add a new tab in Bundle Profile:
> --------------------------------
>
> ### 👉 Risks & Dependencies
>
> This is **read-only + quick actions**, not a full editor.
>
> ### Inside the tab
>
> #### Section 1 — Risk summary (top)
>
> Show:
>
> *   Open risks count
>
> *   High severity risks
>
> *   Overdue risks
>
> *   Trend (optional later)
>
>
> #### Section 2 — Blocking dependencies
>
> Show dependencies where:
>
> *   status != done
>
> *   or flagged as blocking
>
>
> #### Section 3 — Table (shared list)
>
> Columns:
>
> *   Type (Risk / Dependency)
>
> *   Title
>
> *   Severity / Priority
>
> *   Owner
>
> *   Status
>
> *   Due date
>
> *   Last updated
>
>
> Row click → opens the Work Item.
>
> Add quick-create buttons
> ------------------------
>
> Inside Bundle Profile:
>
> *   **\+ Add Risk**
>
> *   **\+ Add Dependency**
>
>
> Behavior:
>
> *   opens Work Item create modal
>
> *   pre-fills:
>
>     *   type
>
>     *   bundleId
>
>     *   (optionally) bundle name in title prefix
>
>
> This keeps creation fast without fragmenting systems.
>
> What NOT to do (important)
> ==========================
>
> ❌ Do not create a separate “bundle\_risks” collection❌ Do not create a second workflow engine❌ Do not store risk status inside bundle\_profiles❌ Do not duplicate ownership logic
>
> If you do, you will create data drift within months.
>
> How dashboards will benefit later
> =================================
>
> Because risks live in Work Items with bundleId:
>
> Dashboards can easily compute:
>
> *   bundles at risk
>
> *   risk heatmaps
>
> *   dependency bottlenecks
>
> *   vendor performance
>
> *   readiness scoring
>
>
> This is exactly why Work Items should remain the source of truth.
>
> What to tell Codex (paste-ready)
> ================================
>
> We will track risks and dependencies as Work Items (system of record), not inside bundle\_profiles.
>
> Implementation plan:
>
> 1.  Ensure Work Items support types:
>
>     *   risk
>
>     *   dependency
>
> 2.  Each risk/dependency must include context.bundleId (required) and optional context.appId.
>
> 3.  In Bundle Profile UI (/applications/bundles/\[bundleId\]), add a new tab:
>
>     *   “Risks & Dependencies”
>
> 4.  This tab should:
>
>     *   query Work Items filtered by bundleId
>
>     *   show summary (open risks, high risks, blocking dependencies)
>
>     *   show a table of related items
>
>     *   row click opens the Work Item
>
> 5.  Add quick-create actions:
>
>     *   “Add Risk”
>
>     *   “Add Dependency”which open Work Item create flow prefilled with bundleId.
>
>
> Do NOT create a separate risks store in Applications.


Below is a \*\*concrete, implementable spec\*\* for: \*\*risk severity model\*\*, \*\*what counts as “Bundle At Risk”\*\*, and a \*\*Delivery Health Score\*\* (0–100). It’s designed to be: - consistent with “risks/dependencies are Work Items” - bundle-centric - deterministic (same inputs → same outputs) - simple enough for v1, extensible later You can paste this to Codex. ---

## Codex Spec — Risks, Dependencies, Bundle Health Scoring (v1)

### 0) Principles - Risks and dependencies are \*\*Work Items\*\* (system of record). - Applications/Bundle Profile \*\*surfaces + aggregates\*\*, but does not own workflow state. - Bundle health can be \*\*computed\*\* (auto) and optionally \*\*overridden\*\* (manual). ---

# 1) Work Item Types and Required Fields

## 1.1 Add / confirm Work Item types - \`risk\` - \`dependency\`

## 1.2 Required linkage All risk/dependency work items must carry: \`\`\`ts context: { bundleId: string // REQUIRED appId?: string // optional } \`\`\`

## 1.3 Risk fields (v1) Add these fields to WorkItem when \`type === "risk"\`: \`\`\`ts risk: { probability: 1|2|3|4|5 // required impact: 1|2|3|4|5 // required severity: 'low'|'medium'|'high'|'critical' // computed from probability\*impact (see below) area?: 'schedule'|'cost'|'scope'|'security'|'compliance'|'operations'|'vendor'|'other' // optional mitigation?: string // optional } \`\`\` ## 1.4 Dependency fields (v1) Add these fields to WorkItem when \`type === "dependency"\`: \`\`\`ts dependency: { blocking: boolean // required (default true) dependsOn?: { type: 'bundle'|'app'|'external', id?: string, name?: string } // optional } \`\`\`

## 1.5 Shared Work Item fields used by health logic Assumes you already have these; if not, add: - \`status\`: \`open | in\_progress | blocked | done | canceled\` - \`priority\`: optional (\`low|medium|high\`) - \`dueDate\`: optional (but strongly recommended) - \`ownerUserId\` or \`assignees\[\]\` - \`updatedAt\` --- # 2) Risk Severity Model (deterministic) ## 2.1 Probability scale (1–5) - 1 = Rare - 2 = Unlikely - 3 = Possible - 4 = Likely - 5 = Almost certain ## 2.2 Impact scale (1–5) - 1 = Negligible - 2 = Minor - 3 = Moderate - 4 = Major - 5 = Severe

## 2.3 Risk score \`\`\`ts riskScore = probability \* impact // range 1..25 \`\`\`

## 2.4 Severity mapping (computed) \`\`\`ts if riskScore <= 4 => low if riskScore <= 9 => medium if riskScore <= 16 => high else => critical \`\`\` Rules: - \`severity\` is computed server-side on create/update. - UI shows probability + impact inputs; displays computed severity. --- # 3) Bundle “At Risk” definition (v1) A bundle is considered \*\*At Risk\*\* if ANY of the following are true:

## 3.1 Hard triggers (immediate at-risk) - Any \*\*open\*\* risk with \`severity === 'critical'\` - Any \*\*open\*\* dependency where \`blocking === true\` and \`status !== 'done'\` and \`dueDate < today\` (overdue blocking dependency) - Any milestone in the bundle profile has \`status === 'blocked'\`

## 3.2 Threshold triggers - Count of \*\*open\*\* risks with \`severity === 'high'\` is \*\*>= 2\*\* - Count of \*\*overdue\*\* risks with severity >= \`medium\` is \*\*>= 1\*\* - Current milestone is past its planned end date and not done: - find “current milestone” = first milestone with status != done - if currentMilestone.plannedEnd exists and \`plannedEnd < today\` and status != done => at risk

## 3.3 Manual override (optional but recommended) In \`bundle\_profiles\`, allow: \`\`\`ts status: 'on\_track'|'at\_risk'|'blocked'|'unknown' statusSource: 'manual'|'computed' \`\`\` Rules: - If statusSource = manual, display it as “Manual”. - If computed, derive from health logic (below). - v1 can default to computed and allow manual set via dropdown in bundle profile. --- # 4) Delivery Health Score (0–100)

## 4.1 Overview Compute a numeric score for each bundle to support dashboards and health pulse charts. - Start at 100 - Subtract penalties for schedule slip, open risks, overdue items, blocked milestone - Clamp 0..100

## 4.2 Inputs From bundle profile: - milestones\[\] (planned/actual/status) - goLivePlanned From work items filtered by context.bundleId: - risks - dependencies

## 4.3 Penalties

### A) Schedule slip penalty (based on current milestone planned end) If current milestone has plannedEnd and not done: \`\`\`ts slipDays = max(0, today - plannedEnd in days) schedulePenalty = min(30, slipDays \* 2) // 2 points per day, capped at 30 \`\`\`

### B) Open risks penalty For each risk where status != done/canceled: - low: 2 points - medium: 5 points - high: 10 points - critical: 20 points \`\`\`ts openRiskPenalty = sum(severityWeight) cap openRiskPenalty at 40 \`\`\`

### C) Overdue work penalty Overdue = dueDate exists AND dueDate < today AND status != done/canceled - overdue risk: +5 additional points (on top of openRiskPenalty) - overdue blocking dependency: +10 points - overdue non-blocking dependency: +3 points Cap overdue penalties at 30.

### D) Blocked milestone penalty If any milestone status = blocked: - +20 points (cap once)

## 4.4 Final health score \`\`\`ts healthScore = 100 - schedulePenalty - openRiskPenalty - overduePenalty - blockedPenalty healthScore = clamp(healthScore, 0, 100) \`\`\`

## 4.5 Health band (for UI chips) - 80–100 = Healthy (green) - 60–79 = Watch (amber) - 0–59 = At Risk (red)

## 4.6 Derive bundle status from healthScore (if computed) If statusSource = computed: - if any “hard trigger” in 3.1 => status = at\_risk (or blocked if milestone blocked) - else if healthScore < 60 => at\_risk - else if healthScore < 80 => on\_track (but show “Watch” band) - else => on\_track (You can keep \`blocked\` reserved for milestone-blocked or manually set.) --- # 5) UI requirements

## 5.1 Bundle Profile: add tab “Risks & Dependencies” Route: \`/applications/bundles/\[bundleId\]\` Tab content: 1) Summary tiles: - Health score + band - Open risks (by severity) - Overdue items count - Blocking dependencies count 2) Two tables: - Risks table (filtered by type=risk, bundleId) - Dependencies table (type=dependency, bundleId) Columns: - Title - Severity (risk) / Blocking (dependency) - Status - Owner - Due date - Updated at Actions: - “Add Risk” button → opens Work Item create with: - type=risk - context.bundleId prefilled - “Add Dependency” button → similar Click row → navigates to Work Item detail.

## 5.2 Applications list + Bundle tiles Wherever bundle is summarized (apps table, bundle tiles): - show derived health band and/or score - show “At Risk” badge if triggers met --- # 6) API requirements

## 6.1 Work item query Need endpoint support to query work items by: - \`context.bundleId\` - \`type in \['risk','dependency'\]\` - status filters (open/overdue)

## 6.2 Bundle health aggregation endpoint (recommended) Add: - \`GET /api/bundles/health?bundleIds=...\` Returns per bundle: \`\`\`ts { bundleId, healthScore, healthBand, computedStatus, openRisksBySeverity, overdueCount, blockingDependenciesCount, scheduleSlipDays } \`\`\` This avoids duplicating calculation logic in UI. ---

# 7) Acceptance criteria 1) Creating/updating a risk auto-computes severity from probability\*impact. 2) Bundle health score is stable and updates when: - milestone dates/status change OR - risk/dependency items change. 3) Bundle is flagged “At Risk” when any trigger rules are met. 4) Bundle Profile shows Risks & Dependencies tab with counts + tables. 5) “Add Risk” and “Add Dependency” prefill bundleId context. --- If you want, I can also specify the \*\*exact Work Item create/edit UI fields\*\* (probability/impact pickers, severity display, overdue highlighting) so Codex doesn’t guess the form layout