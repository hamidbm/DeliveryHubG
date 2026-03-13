# AI Capabilities and Governance

AI in DeliveryHub is assistive only. It never writes to the database without explicit user action.

## Capabilities
- Wiki summary, key decisions, assumptions
- Q&A over pages and assets
- Template generation for new wiki pages
- Cross-module insights in AI Insights
- Diagram generation helpers where enabled
- Work item refinement and standup summaries
- Work item reassignment suggestions
- Portfolio summaries

## Governance
- Provider routing per task type
- Admin-controlled toggles by provider
- Supported providers include OpenAI, Open Router, Gemini, Anthropic, Hugging Face, and Cohere
- Default-provider resolution: Task Routing -> Admin default -> `AI_DEFAULT_PROVIDER`
- There is no hardcoded runtime default provider; if no task provider and no active default/env default is available, AI requests return a clear configuration error
- Task Routing supports `Use Active Default` per task (including `Portfolio Summary`) so tasks can inherit the resolved default provider instead of being pinned
- AI provider selection and execution are centralized in `src/services/aiRouting.ts`; AI routes call shared resolver/executor logic instead of duplicating provider decisions
- API keys are environment-managed and are not persisted in `ai_settings`
- Admin UI exposes selected default provider and active effective default provider
- Rate limiting per task
- Retention controls
- Audit logging of AI usage
- Explicit user actions required to apply AI outputs

## Storage
- Settings in `ai_settings`
- Audit logs in `ai_audit_logs`
- Rate limits in `ai_rate_limits`
- Persisted wiki insights in `wiki_ai_insights`
- Persisted AI Insights portfolio report in `ai_analysis_cache` (`_id: portfolio-summary`)

## AI Insights Portfolio Summary (Phase 12A)
- API contract split:
  - `GET /api/ai/portfolio-summary`: read latest persisted report only (no provider call)
  - `POST /api/ai/portfolio-summary`: manual regenerate, persist, return fresh report
- Cache-first UX:
  - Page load uses cached report first
  - No automatic provider generation on page visit
  - First-run empty state prompts explicit `Generate Analysis`
- Freshness policy:
  - `fresh`: generated within 24 hours
  - `stale`: older than 24 hours
  - stale reports still render with a stale banner; manual regenerate remains available
- Persisted report metadata includes:
  - `generatedAt`, `provider`, `model`, `freshnessStatus`, `snapshotHash`, `updatedAt`
- Provider normalization and fallback:
  - quota/credits/rate-limit errors normalized (not `AI_UNKNOWN_ERROR`)
  - attempted provider/model metadata preserved on terminal failures
  - if generation fails and a cached success exists, cached report is returned
- Rendering/export:
  - in-app report renders markdown with Wiki-style presentation (Aurora styling)
  - Markdown download available
  - PDF download is direct file download with styled report layout (no popup viewer tab)

## AI Insights Structured Intelligence (Phase 12B)
- 12B.1 introduced structured report contracts in `PortfolioSummaryResponse.report`:
  - `overallHealth`
  - `executiveSummary`
  - `topRisks`
  - `recommendedActions`
  - `concentrationSignals`
  - `questionsToAsk`
  - `markdownReport` (compatibility/export)
- 12B.1 also added:
  - deterministic signal derivation (`src/services/ai/portfolioSignals.ts`)
  - structured normalization + legacy conversion (`src/services/ai/normalizePortfolioReport.ts`)
  - structured-to-markdown formatter (`src/services/ai/formatPortfolioReportAsMarkdown.ts`)
- 12B.1.1 bugfix pass:
  - improved legacy markdown section extraction
  - deterministic enrichment when legacy extraction is weak
  - collapsible **Full Narrative Report** retained in UI
- 12B.2 refined presentation quality:
  - section cards and badges (health/severity/urgency)
  - clearer evidence rendering and empty-state messaging
  - responsive overflow-safe section layouts
- 12B.3 strengthened explainability and deterministic anchoring:
  - per-item `provenance`: `ai | deterministic | legacy`
  - risk evidence enforcement (minimum evidence grounding)
  - deterministic severity normalization using ratio thresholds
  - action urgency normalization + evidence linkage
  - concentration/question deterministic synthesis when AI output is thin
  - normalization telemetry includes section synthesis flags
- 12B.5 added interactive portfolio Q&A:
  - `POST /api/ai/portfolio-query` with authenticated, cache-backed querying over the latest structured portfolio summary
  - deterministic-first query answering with best-effort AI interpretation fallback
  - standardized response contract:
    - `answer`
    - `explanation`
    - `evidence[]` (module, label, metric/value, confidence, recommendation, source)
    - `followUps[]`
  - graceful behavior when provider/parsing fails: still returns useful deterministic guidance from cached structured data
  - new query services:
    - `src/services/ai/queryEngine.ts`
    - `src/services/ai/suggestionGenerator.ts`
  - AI Insights UI now includes **Ask DeliveryHub AI**:
    - free-text question input
    - contextual quick suggestions from report/signals
    - evidence-backed answer rendering
    - follow-up chips that can be clicked to immediately re-query

## Where AI Shows Up
- Wiki page view: AI dropdown for summary, key decisions, assumptions
- Wiki assets: same AI dropdown plus Q&A panel
- Work Items: summary, refinement, and assignment assistance
- Dashboards: AI Insights rollups
- Ops Center: `POST /api/ai/operations-intelligence` for SRE anomaly/scaling insights

## How AI Is Applied
- AI responses are generated in API routes
- Users explicitly apply or copy AI output
- No automatic DB writes from AI output
