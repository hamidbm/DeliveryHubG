Phase 14 Specification
Collaborative Workflow Automation & Execution Guidance
1. Purpose
Phase 14 evolves DeliveryHub AI from a strategic and analytic system into a collaborative operational assistant that not only identifies problems and opportunities but also helps drive execution by generating actionable plans, suggesting automated workflows, and integrating with project systems.
This phase focuses on:
action plan generation
automated task suggestion
contextual task templates
workflow recommendations
integration with task status systems
2. Goals
Functional Goals
Implement a Delivery Action Recommendation Engine.
Provide Execution Guidance in context (risks, backlogs, forecasts).
Generate Action Plans with linked work items and tasks.
Enable Automated Task Suggestions and batch creation.
Support Workflow Rule Suggestions (e.g., auto-prioritization, routing).
Expose APIs and UI for actionable insights and task automation.
Non-Functional Goals
Maintain traceability to evidence and deterministic signals.
Keep workflows explainable and tunable, not opaque.
Integrate with existing work item, milestone, and review processes.
Avoid spammy or low-quality suggestions.
3. Core Concepts
3.1 Action Recommendation
A concise, prioritized set of execution steps to address identified risks or opportunities.
Example:
Reassign unassigned work
Resolve blocked work
Add additional reviewers to overdue reviews
Adjust milestone scopes
3.2 Task Suggestion
A proposed work item or action broken down into discrete steps that can be created automatically in systems (e.g., internal DeliveryHub task lists).
3.3 Workflow Rule
A conditional automation recommendation that applies under certain delivery conditions (e.g., “if backlog grows > 20% in 24 h, assign additional resources to critical apps”).
4. Action Recommendation API Contract
Add new output types:
export interface ActionStep {
  id: string;
  description: string;
  relatedEntities: EntityReference[];
  priority: "critical" | "high" | "medium" | "low";
  suggestedBy: "deterministic" | "AI";
  evidence: EvidenceItem[];
}

export interface ActionPlan {
  generatedAt: string;
  summary: string;
  steps: ActionStep[];
  relatedSignals: {
    alerts: PortfolioAlert[];
    forecast: ForecastSignal[];
    propagation: RiskPropagationSignal[];
  };
}
5. Delivery Action Recommendation Engine
File
src/services/ai/actionRecommender.ts
Main Function
generateActionPlan(
  report: StructuredPortfolioReport,
  trendSignals: PortfolioTrendSignal[],
  forecastSignals: ForecastSignal[],
  propagationSignals: RiskPropagationSignal[]
): ActionPlan
Responsibilities
Prioritize risks (alerts, forecast, propagation).
Map risk signals to recommended actions using a ruleset.
Generate discrete ActionSteps with evidence and entity links.
Rank by priority, severity, and impact.
6. Action Heuristics
Examples:
Condition	Action
Unassigned ratio > X	Reassign unowned tasks
Blocked work rising	Investigate blockers, escalate removal
Milestone slip risk	Reprioritize milestone tasks
Review backlog increase	Add reviewers & expedite review cycles
Cross-project propagation	Focus on upstream issues first
7. API Endpoints
7.1 Generate Action Plan
GET /api/ai/action-plan
Returns:
{
  "status": "success",
  "actionPlan": ActionPlan
}
7.2 Manual Refresh
POST /api/ai/action-plan
(force regenerate)
8. Automated Task Suggestions
Extend recommendation engine output:
suggestTasks: TaskSuggestion[]
TaskSuggestion:
interface TaskSuggestion {
  id: string;
  title: string;
  description: string;
  relatedEntities: EntityReference[];
  priority: "critical" | "high" | "medium" | "low";
  evidence: EvidenceItem[];
}
These tasks are actionable items that users can choose to create in the DeliveryHub task tracking system.
9. Task Creation API
POST /api/tasks/batch
Request:
{
  "tasks": [
    { "title": "...", "description": "...", "linkedEntity": {...} },
    ...
  ]
}
Response:
{ "status": "success", "createdTaskIds": [...] }
10. Workflow Rule Suggestions
Encapsulate recommendations for conditional automation.
WorkflowRule:
interface WorkflowRule {
  id: string;
  description: string;
  condition: string; // DSL or structured condition
  recommendedAction: string;
}
Examples:
If unassigned ratio above 30%, auto-assign tasks to available owners
If milestone overdue count increases, email stakeholders
If forecast slip risk > high, escalate in team sync
Expose via API:
GET /api/ai/workflow-rules
11. UI Integration
Add UI components:
src/components/ai/ActionPlanPanel.tsx
src/components/ai/TaskSuggestionCard.tsx
src/components/ai/WorkflowRulePanel.tsx
ActionPlanPanel
summary
prioritized steps
buttons to “create suggested tasks”
links for each related entity
TaskSuggestionCard
title
description
evidence
“Create task” button
WorkflowRulePanel
list of suggested workflow rules
toggle to enable/disable
12. UI Workflows
12.1 Review Action Plan
On Executive Insights or AI Insights, user clicks “View Action Plan”.
ActionPlanPanel shows prioritized steps.
User selects steps to convert to work items.
12.2 Create Suggested Tasks
In TaskSuggestionCard, user clicks “Create Task”
Backend calls task creation endpoint
UI confirms creation
12.3 Enable Workflow Rules
User can enable recommended workflow automations
A lightweight rule engine enforces them in DeliveryHub
13. Lightweight Rule Engine
Implement a simple rule enforcement layer:
src/services/workflowRuleEngine.ts
It evaluates active rules and triggers actions:
auto-assign
notify stakeholders
flag items
Rules are stored in:
ai_workflow_rules
with structures from WorkflowRule.
14. Evidence & Traceability
Every action step and task suggestion must include:
evidence items
linkable entities
severity context
origin (deterministic or AI)
This ensures transparency.
15. Integration With Strategic Advisor
Strategic AI Advisor (13D) should integrate:
Example queries:
“Suggest a step-by-step plan to address our biggest delivery risks.”
“Generate high-priority tasks to improve forecasted delivery outcomes.”
StrategicAdvisor should call generateActionPlan and include it in narrative.
16. Acceptance Criteria
Backend generates ActionPlan based on signals.
UI displays actionable steps with evidence.
Task suggestions can be created as work items.
Workflow rules can be suggested and enabled.
Simple rule engine properly enforces enabled rules.
Strategic Advisor ties into action planning.
No regressions in forecasting, strategic insights, alerting, or notifications.
npx tsc --noEmit passes.
17. Files to Create / Modify
Backend
src/services/ai/actionRecommender.ts
src/services/ai/workflowRuleEngine.ts
src/app/api/ai/action-plan/route.ts
src/app/api/ai/tasks/batch/route.ts
src/app/api/ai/workflow-rules/route.ts
src/types/ai.ts
Frontend
src/components/ai/ActionPlanPanel.tsx
src/components/ai/TaskSuggestionCard.tsx
src/components/ai/WorkflowRulePanel.tsx
src/components/ai/StrategicAdvisorPanel.tsx (integration)
18. Deliverable Summary
Phase 14 introduces Collaborative Workflow Automation:
action plan generation
automated task suggestions
workflow rule recommendations
task creation integrations
enhanced strategic execution guidance
This evolves DeliveryHub AI from analysis → decision support → execution support.
