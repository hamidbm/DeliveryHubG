Phase 13D Specification
Strategic AI Advisor & High-Level Q&A
1. Purpose
Phase 13D introduces a Strategic AI Advisor layer — an interface through which users (especially leadership) can ask high-level, natural-language questions about portfolio strategy, future risk, trade-offs, and recommendations. This layer builds on the structured deterministic engines (trend, forecast, propagation) but leverages an LLM only as a reasoning/refinement layer on top of strong deterministic context.
Example strategic queries:
“What are the top three delivery risks this quarter and how should we prioritize them?”
“If we reallocate five engineers from Bundle A to Bundle B, what risk shifts might occur?”
“Summarize why milestone X is at risk and recommend the most impactful actions.”
“Compare the risk profiles of major bundles and recommend where leadership should intervene.”
This phase does not replace the deterministic engines; it uses them as grounding to ensure answers are explainable and based on real portfolio data.
2. Goals
Functional Goals
Provide a Strategic AI Advisor API that accepts natural-language strategic queries.
Build a Prompt Engineering Layer grounded in deterministic signals.
Add a Strategic Q&A UI in AI Insights.
Include Evidence-backed reasoning, citations, and safe fallback behavior.
Surface interactive follow-ups and action suggestions.
Non-Functional Goals
Maintain auditability and reference back to deterministic signals and entities.
Avoid overfitting to LLM hallucination; use strong context conditioning.
Support caching and cost control.
Keep UI responsive.
3. Strategic Query API Contract
Add a new backend route:
POST /api/ai/strategic-query
Request Body
{
  question: string;
  options?: {
    useLLM?: boolean;       // default true
    maxTokens?: number;
  };
}
Response
interface StrategicQueryResponse {
  answer: string;
  explanation: string;
  evidence: EvidenceItem[];
  relatedEntities: EntityReference[];
  followUps: string[];
  success: boolean;
  errorMessage?: string;
}
answer: concise direct answer.
explanation: narrative context and reasoning.
evidence: array of EvidenceItem from deterministic engines.
relatedEntities: key linked entities for drill-down.
followUps: suggested next questions.
success: success flag.
4. Deterministic Context Extraction
Before hitting the model (LLM), extract structured context:
Latest portfolio snapshot
Structured report
Trend signals
Forecast signals
Risk propagation signals
Active alerts
Health score
Related investigations
This context should be serialized into a deterministic prompt template.
5. Prompt Engineering Layer
Create:
src/services/ai/strategicPromptBuilder.ts
Purpose: Build a structured prompt doc that includes:
System instructions (executive advisor persona)
Portfolio state summary (latest structured report)
Trend snapshot
Forecast signals
Risk propagation signals
Active alerts
Health score
User question
Safety directives (e.g., avoid speculation beyond data scope)
Prompt structure (pseudocode):
SYSTEM:
You are DeliveryHub Strategic AI Advisor.

CONTEXT:
-- Portfolio Health --
[health summary]
-- Trend Signals --
[trend list]
-- Forecast Signals --
[forecast list]
-- Risk Propagation --
[propagation list]
-- Active Alerts --
[alert list]

QUESTION:
[user question here]

OUTPUT INSTRUCTIONS:
Answer directly, cite evidence,
provide explanation and follow-ups.
6. Deterministic First Answer Generation
When useLLM is false or as a first pass:
Attempt a deterministic Q&A match using:
forecast signals
trend signals
alert engine
risk propagation
structured summarization (13A)
Implement logic in:
src/services/ai/strategicDeterministicEngine.ts
This module analyzes patterns such as:
frequent risks
entity comparisons
threshold evaluations
Fallback to LLM refinement if deterministic result is weak.
7. Model Invocation & Normalization
If deterministic path is insufficient OR useLLM=true:
Build the prompt via strategicPromptBuilder.
Call LLM (OpenAI / configured provider).
Normalize response:
parse narrative
enforce JSON safety schemas
extract follow-ups
map entities back to EntityReference
Normalization module:
src/services/ai/strategicResponseNormalizer.ts
8. Evidence & Entity Anchoring
All strategic answers must include:
Evidence items from deterministic engines
Related entities that support claims
Links to bundle/app/milestone/work-item pages
This ensures transparency and traceability of advice.
9. UI: Strategic Advisor Panel
Add a UI section under AI Insights:
Strategic AI Advisor
------------------------------
[Input textbox/question prompt]
[Ask button]
[Suggested Quick Questions chips]
[Answer panel: answer, explanation]
[Evidence list with entity links]
[Follow-up suggestion chips]
Components:
src/components/ai/StrategicAdvisorPanel.tsx
src/components/ai/StrategicAnswerCard.tsx
10. Suggested Quick Questions
Seed the panel with strategic quick suggestions such as:
“What are the top 3 strategic delivery risks?”
“Which milestones are most at risk and why?”
“Where should resources be reallocated for maximal impact?”
“How does backlog growth affect delivery timelines?”
“Summarize the forecasted delivery outcomes.”
These can be generated via:
suggestionGenerator.ts
Add a strategic category.
11. Caching & Cost Control
Add caching for strategic answers:
Key: hash of {questionNormalized, snapshotHash}
TTL: 24 hours
Only regenerate if question or snapshot changes.
Implement cache logic in:
ai_analysis_cache
with reportType: "strategic-query" and queryHash.
12. Error Handling & Safety
Strategic queries should:
never hallucinate beyond provided context
gracefully degrade if model fails
fall back to deterministic summary only with warning
If LLM output is malformed:
return {
  success: false,
  answer: "",
  explanation: "",
  errorMessage: "Model response could not be parsed."
}
13. Strategic Query API Endpoints
13.1 POST /api/ai/strategic-query
As defined above.
13.2 GET /api/ai/strategic-suggestions
Optional: return seeded suggestions.
Response:
{
  "status": "success",
  "suggestions": [string[]]
}
14. Query Engine Integration
Extend deterministic query engine to flag strategic intents such as:
“recommend”
“compare”
“summarize risks”
“resource allocation advice”
Routing logic in:
queryEngine.ts
strategic intents should call Strategic AI Advisor API.
15. UI Interaction Flow
User enters a strategic question.
Frontend send to POST /api/ai/strategic-query.
Backend:
tries deterministic engine
if insufficient, uses LLM with strategic context
Return strategic answer.
UI displays:
answer
explanation
evidence
related entity links
follow-up suggestions
16. Acceptance Criteria
Strategic API returns structured strategic answers.
Deterministic fallback works without LLM, when appropriate.
LLM invocation is grounded by deterministic context.
UI supports strategic question input and display.
Evidence and entities anchor answers.
Follow-ups are appropriate and relevant.
Cache avoids unnecessary LLM calls.
No regressions in existing capabilities.
npx tsc --noEmit passes.
17. Files to Create / Modify
Backend
src/services/ai/strategicPromptBuilder.ts
src/services/ai/strategicDeterministicEngine.ts
src/services/ai/strategicResponseNormalizer.ts
src/services/ai/strategicAdvisor.ts
src/app/api/ai/strategic-query/route.ts
src/app/api/ai/strategic-suggestions/route.ts
Frontend
src/components/ai/StrategicAdvisorPanel.tsx
src/components/ai/StrategicAnswerCard.tsx
src/components/ai/StrategicFollowUpChips.tsx
Query Engine
src/services/ai/queryEngine.ts
src/services/ai/suggestionGenerator.ts
Types
src/types/ai.ts
18. Deliverable Summary
Phase 13D implements a Strategic AI Advisor that:
accepts high-level natural language
generates grounded, evidence-backed strategic answers
integrates deterministic signals with LLM refinement
supports follow-up reasoning and entity navigation
surfaces insights in dedicated UI
This completes the strategic intelligence layer of DeliveryHub AI.