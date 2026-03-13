Phase 12A Specification
AI Insights Foundation and Reliability Layer
1. Purpose
Phase 12A establishes the foundational reliability and observability layer for the AI Insights feature.
The current AI Insights page can fail silently and does not clearly communicate:
configuration problems
provider failures
missing credentials
rate limits
lack of portfolio data
backend errors
Phase 12A introduces:
robust backend error classification
deterministic portfolio snapshot generation
structured API responses
clear UI states
metadata about the generated analysis
preservation of last successful analysis
This phase does not introduce new AI capabilities yet.
It ensures the system behaves predictably before further AI features are built in Phase 12B and beyond.
2. Goals
Functional goals
AI Insights page must never show a silent failure.
AI Insights must display explicit status messages when the AI analysis cannot be generated.
AI responses must include metadata and structured response fields.
AI generation must use a deterministic portfolio snapshot.
Last successful analysis should be cached and reused when generation fails.
Non-functional goals
Improve debugging and observability
Prepare data model for Phase 12B+ features
Ensure safe fallback when AI provider fails
Avoid unnecessary AI provider calls
3. Scope
In scope
Backend portfolio snapshot builder
Structured AI summary API contract
Error classification system
Improved frontend states
Analysis metadata
Last successful report caching
Out of scope
Natural language query system
Quick suggestion generation
AI decision explanations
Advanced AI reasoning
AI chat
Those will be implemented in later sub-phases.
4. Architecture Overview
Current flow:
AIInsightsPage
   → /api/ai/portfolio-summary
      → AI provider
         → return summary text
New flow:
AIInsightsPage
   → /api/ai/portfolio-summary
        → buildPortfolioIntelligenceSnapshot()
        → AI provider
        → structured result
        → store last successful result
   ← structured response
5. Portfolio Intelligence Snapshot
Purpose
Before invoking AI, the system must build a deterministic snapshot of the portfolio state.
This snapshot ensures:
reproducible AI results
explainability
easier debugging
future analytics reuse
5.1 File Location
Create:
src/services/ai/portfolioSnapshot.ts
5.2 Function
export async function buildPortfolioIntelligenceSnapshot(): Promise<PortfolioSnapshot>
5.3 Snapshot Data Structure
Create type:
src/types/ai.ts
export interface PortfolioSnapshot {
  generatedAt: string

  applications: {
    total: number
    byHealth: {
      healthy: number
      warning: number
      critical: number
      unknown: number
    }
  }

  bundles: {
    total: number
  }

  workItems: {
    total: number
    overdue: number
    blocked: number
    unassigned: number
    byStatus: Record<string, number>
  }

  reviews: {
    open: number
    overdue: number
  }

  milestones: {
    total: number
    overdue: number
  }
}
5.4 Data Sources
Snapshot must aggregate from existing collections:
Applications
Collection: applications
Fields used:
_id
health
Health classification:
healthy
warning
critical
unknown
Bundles
Collection: bundles
Fields used:
_id
Count only.
Work Items
Collection: workItems
Fields used:
_id
status
dueDate
blocked
assignee
Metrics:
total
overdue
blocked
unassigned
byStatus
Overdue logic:
dueDate < now AND status not in ["Done", "Closed"]
Reviews
Collection: reviewCycles
Fields used:
status
dueDate
Metrics:
open
overdue
Milestones
Collection: milestones
Fields used:
targetDate
status
Overdue logic:
targetDate < now AND status != completed
6. AI Summary API Redesign
Endpoint
POST /api/ai/portfolio-summary
File:
src/app/api/ai/portfolio-summary/route.ts
6.1 Response Contract
Replace simple response with structured response:
export interface PortfolioSummaryResponse {
  status: "success" | "error"

  error?: {
    code: string
    message: string
  }

  metadata?: {
    generatedAt: string
    provider: string
    model: string
  }

  snapshot?: PortfolioSnapshot

  report?: {
    executiveSummary: string
  }
}
6.2 Error Codes
API must return explicit error codes.
Missing provider
AI_PROVIDER_NOT_CONFIGURED
Message:
No AI provider is configured for DeliveryHub.
Missing credentials
AI_PROVIDER_CREDENTIALS_MISSING
Provider request failed
AI_PROVIDER_REQUEST_FAILED
Rate limit
AI_PROVIDER_RATE_LIMIT
Snapshot failure
PORTFOLIO_SNAPSHOT_FAILED
Unknown
AI_UNKNOWN_ERROR
6.3 AI Prompt Template
AI should receive structured portfolio snapshot.
Example prompt:
You are an enterprise delivery portfolio analyst.

Analyze the following portfolio snapshot and produce a short executive report.

Portfolio Snapshot:
{JSON snapshot}

Provide:
1. Executive summary (3–5 sentences)
2. Major portfolio signals
3. Delivery risks
4. Observations

Respond with concise language suitable for executives.
6.4 Provider Metadata
The API response must include:
provider
model
generatedAt
Example:
{
  "metadata": {
    "provider": "OPENAI",
    "model": "gpt-5.2",
    "generatedAt": "2026-03-12T08:20:00Z"
  }
}
7. Last Successful Report Cache
To avoid blank screens when AI fails.
7.1 Storage
Collection:
aiAnalysisCache
Document structure:
{
  _id: "portfolio-summary",
  report: PortfolioSummaryResponse,
  updatedAt: Date
}
7.2 Logic
When summary generation succeeds:
save to aiAnalysisCache
When generation fails:
return last cached report
status: "success"
metadata.cached: true
8. Frontend Changes
File:
src/components/AIInsightsPage.tsx
8.1 State Model
Replace current state with:
type AnalysisState =
  | "loading"
  | "success"
  | "error"
  | "cached"
8.2 Display States
Loading
Show spinner and message:
Generating AI portfolio insights...
Success
Render:
Executive summary
Snapshot metrics
Metadata footer
Cached
Show banner:
Displaying last successful analysis.
Latest generation attempt failed.
Error
Show error message returned by API.
Examples:
AI provider is not configured.
Configure one in Admin → AI Settings.
AI provider request failed.
Try again later.
8.3 Metadata Footer
Display below report:
Generated by {provider} ({model})
Generated at {timestamp}
If cached:
Showing cached analysis
9. Snapshot Visualization
Add a Portfolio Snapshot panel above the report.
Metrics displayed:
Metric	Description
Applications	total apps
Critical Apps	apps with critical health
Overdue Work	overdue tasks
Blocked Work	blocked tasks
Open Reviews	open review cycles
This section is deterministic (not AI generated).
10. Logging and Observability
Every AI request must log:
event: ai_portfolio_summary
timestamp
provider
model
duration
success
errorCode
Store in existing audit logging system.
11. Performance Requirements
Snapshot build must complete within:
< 500ms
AI provider timeout:
20 seconds
Cached fallback must return within:
< 100ms
12. Security
Ensure:
API requires authenticated user
AI prompt contains no sensitive secrets
Only portfolio metadata is sent to AI
13. Acceptance Criteria
Phase 12A is complete when:
AI Insights page never shows blank state.
API returns structured responses.
Snapshot service aggregates portfolio metrics.
Metadata is displayed in UI.
Cached report appears when AI fails.
Error messages clearly identify configuration problems.
All AI calls are logged.
14. Files to Create
src/services/ai/portfolioSnapshot.ts
src/types/ai.ts
15. Files to Modify
src/app/api/ai/portfolio-summary/route.ts
src/components/AIInsightsPage.tsx
src/services/ai/providerRouter.ts
16. Deliverable Summary
Phase 12A delivers the AI Insights reliability layer, including:
deterministic portfolio snapshot
structured AI report API
robust error handling
cached fallback analysis
metadata and observability
improved UI states
This provides the foundation for advanced AI functionality in Phase 12B.