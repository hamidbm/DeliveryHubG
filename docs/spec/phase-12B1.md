# Phase 12B.1 Specification

## Structured Intelligence Report Contract for AI Insights

---

# 1. Purpose Phase **12B.1** upgrades
AI Insights from a single markdown-style executive narrative into a **structured delivery intelligence report** with explicit sections, typed contracts, and UI-ready data. Up to Phase 12A.x, AI Insights became:
- reliable
- cache-aware
- freshness-aware
- markdown-rendered
- exportable
- manually regenerable But the report body is still essentially one AI-generated narrative blob.

Phase 12B.1 introduces a **structured report schema** so the system can present AI analysis as first-class product data rather than a text block. This phase establishes the backend and contract foundation for richer AI Insights behavior in later 12B phases.

---

# 2. Goals

## Functional goals
1. `/api/ai/portfolio-summary` must return a **structured report object** instead of only a markdown narrative blob.
2. AI generation must produce explicit sections: - overall health - executive summary - top risks - recommended actions - concentration signals - questions to ask
3. The structured response must be persisted in `ai_analysis_cache`.
4. The AI Insights UI must render these structured sections from typed data.
5. Existing caching, freshness, manual regeneration, and export behavior must continue to work.

## Non-functional goals
- improve explainability
- reduce UI dependence on parsing markdown prose
- create stable contracts for future features
- keep fallback behavior safe if structured AI output is malformed

---

# 3. Scope

## In scope
- structured `report` response schema
- LLM prompt redesign for structured output
- backend validation and normalization
- persistence of structured report objects
- UI rendering of structured sections
- compatibility layer for markdown export
- graceful fallback behavior when AI output is malformed

## Out of scope
- natural-language query box functionality
- quick suggestions click behavior
- drill-down links into work items/reviews/apps
- interactive evidence tables
- charts and graphs
- multi-turn chat
- auto-actions or write-backs Those belong to later 12B subphases.

---

# 4. Product intent
AI Insights should now feel like a **delivery intelligence console**, not just a generated memo. The report should communicate:
- overall portfolio state
- most important delivery risks
- recommended management actions
- concentration/bottleneck signals
- sensible next questions to ask

The UI should remain executive-friendly while being more structured and inspectable.

---

# 5. High-level architecture
Current approximate flow:
```text
GET /api/ai/portfolio-summary -> load cached structured report POST /api/ai/portfolio-summary -> build deterministic portfolio snapshot -> prompt AI provider -> receive narrative report -> persist result ``` Phase 12B.1 target flow: ```text GET /api/ai/portfolio-summary -> load cached structured report -> normalize legacy cache if needed -> return structured report payload POST /api/ai/portfolio-summary -> build deterministic portfolio snapshot -> derive deterministic signals -> prompt AI provider for structured JSON report -> validate/normalize output -> persist structured report -> return structured report payload
```

---

# 6. Core design principles

## 6.1 Deterministic foundation first
The AI report must continue to be grounded in the deterministic portfolio snapshot created in Phase 12A. The model is not the source of truth for counts and state; it is the source of **interpretation and prioritization**.

## 6.2 Structured over free-form
The model should generate a structured object, not a single markdown-only blob.

## 6.3 Explainability over flourish
Every risk and recommendation should be backed by short evidence strings derived from the snapshot and/or AI synthesis.

## 6.4 Safe fallback over brittle parsing
If the AI fails to return valid structured output, the system must still produce a usable report via normalization/fallback logic rather than hard-failing unnecessarily.

---

# 7. Response contract

## 7.1 API endpoint
Continue using:
```text
GET /api/ai/portfolio-summary POST /api/ai/portfolio-summary
```
No endpoint split is needed beyond what 12A.3 already established.

---

## 7.2 Top-level response shape
Update the current `PortfolioSummaryResponse` contract to support structured report content. Create/update type definitions in:
```ts
src/types/ai.ts
```

### Required response type
```ts
export type PortfolioSummaryStatus = "success" | "error" | "empty"; export type PortfolioHealthSignal = "green" | "amber" | "red" | "unknown"; export type PortfolioRiskSeverity = "low" | "medium" | "high" | "critical"; export interface StructuredRiskItem { id: string; title: string; severity: PortfolioRiskSeverity; summary: string; evidence: string[]; } export interface StructuredActionItem { id: string; title: string; urgency: "now" | "7d" | "30d" | "later"; summary: string; ownerHint?: string; evidence?: string[]; } export interface StructuredConcentrationSignal { id: string; title: string; summary: string; impact?: string; evidence?: string[]; } export interface StructuredQuestionItem { id: string; question: string; rationale?: string; } export interface StructuredPortfolioReport { overallHealth: PortfolioHealthSignal; executiveSummary: string; topRisks: StructuredRiskItem[]; recommendedActions: StructuredActionItem[]; concentrationSignals: StructuredConcentrationSignal[]; questionsToAsk: StructuredQuestionItem[]; /** * Backward-compatible markdown narrative used for export/fallback. * This should continue to exist in 12B.1. */ markdownReport?: string; } export interface PortfolioSummaryMetadata { generatedAt: string; provider: string; model: string; cached?: boolean; freshnessStatus?: "fresh" | "stale"; snapshotHash?: string; lastAttemptedProvider?: string; lastAttemptedModel?: string; attemptedProviders?: Array<{ provider: string; model: string; }>; } export interface PortfolioSummaryResponse { status: PortfolioSummaryStatus; error?: { code: string; message: string; }; metadata?: PortfolioSummaryMetadata; snapshot?: PortfolioSnapshot; report?: StructuredPortfolioReport; }
```

---

# 8. Report content requirements

## 8.1 Overall health `overallHealth` is a portfolio-level signal summarizing the current state. Allowed values:
- `green`
- `amber`
- `red`
- `unknown`

### Expected semantics
- `green`: portfolio broadly healthy, manageable risk profile
- `amber`: meaningful delivery concerns exist, but not systemic failure
- `red`: severe execution risk or systemic delivery health concerns
- `unknown`: insufficient signal or failed normalization

### Important rule
The AI may suggest the health level, but the backend must validate it against allowed enum values.

---

## 8.2 Executive summary `executiveSummary` should be:
- a short narrative paragraph or two
- concise and management-friendly
- grounded in real portfolio facts
- no markdown headings embedded in this field

### Length guidance
Target roughly:
- 2 to 5 sentences
- not more than about 1200 characters unless necessary

---

## 8.3 Top risks
`topRisks` is a ranked list of the most important delivery risks.

### Constraints
- 0 to 5 items
- ordered from highest importance to lowest
- each item must include:
  - `title`
  - `severity`
  - `summary`
  - at least 1 evidence string if possible

### Examples
- Resource allocation crisis
- Excessive unassigned workload
- Blocking trend in active work
-  Review bottleneck risk
-  Low delivery velocity

### Evidence examples
- `80 of 89 work items are unassigned`
- `Only 3 work items are actively in progress`
- `3 work items are currently blocked`

---

## 8.4 Recommended actions `recommendedActions` is a prioritized list of management actions.

### Constraints
- 0 to 5 items
- each item must include:
  - `title`
  - `urgency`
  - `summary`
  - `ownerHint` is optional but recommended

### Allowed urgency values
- `now`
- `7d`
- `30d`
- `later`

### Examples
- Assign owners to the highest-priority unassigned work
- Review staffing model for under-resourced bundles
- Triage blocked work items with delivery leads
- Validate review capacity ahead of milestone commitments

---

## 8.5 Concentration signals
`concentrationSignals` identifies areas where risk is concentrated. This is intentionally broader than “risk” and should capture bottlenecks, dependency concentrations, or unhealthy distributions.

### Constraints
- 0 to 5 items
- each item must include:
  - `title`
  - `summary`

### Example themes
- work concentrated in too few active owners
- high workload spread across too many unassigned items
- blocked items clustered in specific statuses or areas
- delivery throughput dependent on a small active subset
- too much portfolio progress inferred from healthy apps but weak execution capacity

---

## 8.6 Questions to ask
`questionsToAsk` gives follow-up prompts leadership or delivery managers should explore.

### Constraints
- 2 to 6 items preferred
- each entry should be a direct actionable question
- no markdown bullets embedded

### Example questions
- Which bundles contain the largest share of unassigned work?
- Which blocked work items threaten near-term milestones?
- Which applications are healthy technically but under-supported from a delivery standpoint?
- Where is review capacity most constrained?

---

## 8.7 Backward-compatible markdown report
The structured report should also preserve a markdown-compatible version for export and compatibility.

### Field
```ts
markdownReport?: string;
```

### Purpose
- existing Markdown export
- PDF export template input
- fallback rendering if structured UI has incomplete data
- compatibility with old stored reports

### Rule
In 12B.1, this field should still be generated and stored. This is not the primary UI contract anymore, but it remains useful.

---

# 9. Deterministic signal derivation layer
Before prompting the AI, compute a small set of deterministic summary signals from the snapshot. Create a helper service, for example:
```ts
src/services/ai/portfolioSignals.ts
```

## Purpose
This service prepares concise, stable, explainable signal inputs for the model.

## Example type
```ts
export interface PortfolioSignalSummary { applicationsTotal: number; healthyApplications: number; warningApplications: number; criticalApplications: number; workItemsTotal: number; unassignedWorkItems: number; overdueWorkItems: number; blockedWorkItems: number; inProgressWorkItems: number; reviewsOpen: number; reviewsOverdue: number; milestonesTotal: number; milestonesOverdue: number; notableSignals: string[]; }
```

## Required behavior
Compute at minimum:
- total applications
- critical app count
- healthy app count
- total work items
- unassigned work items
- blocked work items
- overdue work items
- in-progress work items
- open reviews
- overdue reviews
- total milestones
- overdue milestones Also compute `notableSignals`, which can contain deterministic strings such as:
  - `80 of 89 work items are unassigned`
  - `Only 3 work items are in progress`
  - `No applications are currently rated critical`
  - `3 review cycles remain open`
  These strings can be reused directly as evidence and prompt grounding.

---

# 10. AI prompt redesign

## 10.1 Prompt objective
The AI should return a **strict structured JSON object** matching the expected report contract.

## 10.2 Prompt location
Update the prompt logic in the current AI generation path inside:
```ts
src/app/api/ai/portfolio-summary/route.ts
```
If prompt construction is large enough, extract to something like:
```ts
src/services/ai/prompts/buildPortfolioSummaryPrompt.ts
```

## 10.3 Prompt requirements
The prompt must include:
- deterministic snapshot
- deterministic signal summary
- explicit schema instructions
- instruction to avoid unsupported enum values
- instruction to keep content concise and executive-friendly

## 10.4 Suggested prompt skeleton
```text
You are an enterprise delivery portfolio analyst. You will receive:
1. A deterministic portfolio snapshot
2. A deterministic signal summary Your task is to produce a structured portfolio intelligence report as strict JSON. Rules:
  - Return valid JSON only.
  - Do not wrap the JSON in markdown fences.
  - Use only the allowed enum values.
  - Ground all conclusions in the provided data.
  - Keep the executive summary concise.
  - topRisks: max 5
  - recommendedActions: max 5
  - concentrationSignals: max 5
  - questionsToAsk: 2 to 6
  Allowed values:
    overallHealth: "green" | "amber" | "red" | "unknown" risk severity: "low" | "medium" | "high" | "critical"
    action urgency: "now" | "7d" | "30d" | "later"
    Return this JSON shape: { "overallHealth": "...", "executiveSummary": "...", "topRisks": [ { "title": "...", "severity": "...", "summary": "...", "evidence": ["..."] } ], "recommendedActions": [ { "title": "...", "urgency": "...", "summary": "...", "ownerHint": "...", "evidence": ["..."] } ], "concentrationSignals": [ { "title": "...", "summary": "...", "impact": "...", "evidence": ["..."] } ], "questionsToAsk": [ { "question": "...", "rationale": "..." } ] } Deterministic signal summary: {...} Portfolio snapshot: {...}
```

---

# 11. Backend normalization and validation
AI output cannot be trusted as-is. The backend must validate and normalize it before storing or returning it.

## 11.1 Required normalization function
Create a normalization helper, for example:
```ts
src/services/ai/normalizePortfolioReport.ts
```

## 11.2 Responsibilities
The function must:
- parse provider response
- accept either raw JSON string or already parsed object
- validate required keys
- coerce invalid or missing fields into safe defaults
- trim arrays to max allowed lengths
- enforce enum values
- assign stable item IDs
- generate `markdownReport` if missing - return a valid `StructuredPortfolioReport`

## 11.3 Example normalization rules

### `overallHealth`
If invalid, default to: ```ts "unknown" ```

### `executiveSummary`
If missing or empty, synthesize a fallback from deterministic signals.

### `topRisks`
If missing or invalid: - return empty array or derive a small deterministic fallback list

### `severity`
If invalid, default to: ```ts "medium" ```

### `recommendedActions`
If missing, derive at least 1 to 3 deterministic actions when possible.

### `questionsToAsk`
If missing, synthesize follow-up questions from snapshot signals.

### IDs Assign backend-stable
IDs like: ```ts risk-1 risk-2 action-1 signal-1 question-1 ```

---

# 12. Legacy cache compatibility
There may already be cached reports from earlier phases that only contain a markdown narrative or an older structure.

## Required behavior
On `GET /api/ai/portfolio-summary`:
- if stored report already matches structured contract, return it
- if stored report is legacy markdown-only, normalize it into 12B.1 response shape as best as possible
- do not discard existing cached report data unnecessarily

## Acceptable fallback for legacy cache
If a legacy report only contains markdown text:
- preserve it as `markdownReport`
- set `executiveSummary` to the first reasonable section or whole body excerpt
- leave arrays empty if structured extraction is not feasible
- set `overallHealth` to `unknown`
This avoids breaking previously saved data.

---

# 13. Persistence requirements
Continue using:
```text
ai_analysis_cache
```

## Required persisted shape
The stored document should now include the structured report. Example persisted document:
```ts
{ _id: "portfolio-summary", reportType: "portfolio-summary", status: "success", metadata: { generatedAt: "2026-03-12T20:28:16.333Z", provider: "OPEN_ROUTER", model: "qwen/qwen3-coder", cached: false, freshnessStatus: "fresh", snapshotHash: "..." }, snapshot: { ... }, report: { overallHealth: "amber", executiveSummary: "...", topRisks: [ ... ], recommendedActions: [ ... ], concentrationSignals: [ ... ], questionsToAsk: [ ... ], markdownReport: "..." }, updatedAt: ISODate("...") }
```

## Important rule
The report stored in cache must already be normalized and UI-safe. Do not store raw AI output as the primary persisted artifact.

---

# 14. UI requirements

## Target component
Modify: ```ts src/components/AIInsights.tsx ```

## 14.1 Current behavior to preserve
Do not break:
- cached-read behavior
- manual regenerate behavior
- stale banner behavior
- metadata display
- markdown and PDF export
- first-run empty state

## 14.2 New rendering approach
Replace the single primary reliance on markdown-rendered narrative with structured sections.

### Render, in order:
1. Overall health signal
2. Executive summary
3. Top risks
4. Recommended actions
5. Concentration signals
6. Questions to ask
The existing markdown report may still be shown in export or hidden compatibility paths, but the main screen should now be driven by structured fields.

---

# 15. UI section details

## 15.1 Overall health signal
Add a visible health indicator near the top of the report card.

### Display labels
- `Green`
- `Amber`
- `Red`
- `Unknown`

### Styling guidance
Use the app’s existing badge/pill/card styling if available. Do not invent a radically new visual language.

---

## 15.2 Executive summary section
Render the `executiveSummary` text as styled narrative prose. This should appear first and be prominent.

---

## 15.3 Top risks section
Render risk items as a vertical list or cards. Each item must show:
- title
- severity
- summary
- evidence bullet list

### Severity display
Show a small severity badge or inline label:
- Critical
- High
- Medium
- Low

---

## 15.4 Recommended actions section
Render action items as a vertical list or cards. Each item must show:
- title
- urgency
- summary
- owner hint if present
- evidence if present

### Urgency display labels
- `Now`
- `Next 7 Days`
- `Next 30 Days`
- `Later`

---

## 15.5 Concentration signals section
Render these as concise insight blocks. Each item must show:
- title
- summary
- impact if present
- evidence if present

---

## 15.6 Questions to ask section
Render follow-up questions as a short list. Each item should show:
- question
- rationale if present
These are not interactive in 12B.1.

---

# 16. Markdown export compatibility
Even though the UI is now structured-first, exports must still work.

## Required behavior
Markdown export and PDF export should continue to use a coherent report body.

## Preferred approach
Generate the markdown export from:
1. `report.markdownReport` if present
2. otherwise a backend or frontend formatter that converts structured sections into markdown

## Rule
Do not make export depend on screen scraping the UI.

---

# 17. Structured-to-markdown formatter
To keep export stable, add a formatter helper, for example:
```ts
src/services/ai/formatPortfolioReportAsMarkdown.ts
```

## Responsibilities
Convert structured report sections into export-ready markdown, including:
- title
- metadata block
- overall health
- executive summary
- top risks
- recommended actions
- concentration signals
- questions to ask

## Example output pattern ```md

# AI Portfolio Insights Report
- Generated At: ...
- Provider: ...
- Model: ...
- Cached: Yes
- Overall Health: Amber

---

## Executive Summary ...

## Top Risks

### 1. Resource Allocation Crisis
- Severity: High
- Summary: ...
- Evidence: - ... - ...

## Recommended Actions

### 1. Assign owners to top-priority work
- Urgency: Next 7 Days
- Owner Hint: Delivery Leads
- Summary: ... ```

---

# 18. Error and fallback behavior

## 18.1 Structured AI output malformed
If AI response cannot be parsed cleanly into the structured schema:
- do not fail immediately if text exists
- normalize as much as possible
- generate a minimal structured report using deterministic fallbacks
- log the normalization issue

## 18.2 Provider success but report normalization weak
Still persist and return a valid structured report, with fallback sections populated where needed.

## 18.3 No meaningful output
If provider returns empty output and no cached fallback is available, preserve existing Phase 12A error handling.

---

# 19. Logging and observability
Continue `ai_portfolio_summary` logging. Add structured normalization fields when useful.

## Recommended additional log fields
- `normalizationFallbackUsed: boolean`
- `legacyCacheNormalized: boolean`
- `structuredReportGenerated: boolean`
These are optional but recommended.

---

# 20. Acceptance criteria
Phase 12B.1 is complete when all of the following are true:
1. `POST /api/ai/portfolio-summary` returns a structured report object.
2. `GET /api/ai/portfolio-summary` returns the structured report from cache when available.
3. Structured report includes:
  - `overallHealth`
  - `executiveSummary`
  - `topRisks`
  - `recommendedActions`
  - `concentrationSignals`
  - `questionsToAsk`
4. UI renders structured sections rather than depending only on markdown.
5. Existing cache/freshness/manual regenerate behavior remains intact.
6. Existing Markdown/PDF export continues to work.
7. Legacy cached report data does not break the page.
8. Invalid or partial AI output is normalized into a safe structured report.
9. `npx tsc --noEmit` passes.

---

# 21. Files to create
Recommended new files:
```ts
src/services/ai/portfolioSignals.ts src/services/ai/normalizePortfolioReport.ts src/services/ai/formatPortfolioReportAsMarkdown.ts
```
Optional if prompt extraction is warranted:
```ts
src/services/ai/prompts/buildPortfolioSummaryPrompt.ts
```

---

# 22. Files to modify
At minimum:
```ts
src/app/api/ai/portfolio-summary/route.ts src/components/AIInsights.tsx src/types/ai.ts src/services/db.ts
```
Potentially also:
```ts
src/services/aiRouting.ts
```
Only if needed for response handling or logging improvements.

---

# 23. Implementation guidance for Codex

## Reuse rules
Before adding new rendering or formatting infrastructure:
- reuse current AI Insights metadata flow
- reuse current export flow
- reuse Wiki markdown styling only where still relevant
- keep current cache collection and normalization approach

## Keep 12B.1 tight
Do not add yet:
- clickable questions
- query box behavior
- interactive filters
- links into work items/apps/reviews
- charts
- dashboard widgets outside current AI Insights scope

## Main objective
The main objective is to move the report from **blob narrative** to **structured intelligence contract** without regressing reliability or exports.

---

# 24. Deliverable summary
Phase **12B.1** delivers the foundation for structured AI Insights by adding:
- typed structured report schema
- grounded deterministic signal layer
- structured AI prompt and normalization
- structured UI rendering
- export compatibility
- legacy compatibility This prepares the codebase for later 12B subphases like evidence refinement, quick suggestions, and the Ask DeliveryHub AI experience.