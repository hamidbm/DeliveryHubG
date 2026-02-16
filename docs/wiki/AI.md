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
- Rate limiting per task
- Retention controls
- Audit logging of AI usage
- Explicit user actions required to apply AI outputs

## Storage
- Settings in `ai_settings`
- Audit logs in `ai_audit_logs`
- Rate limits in `ai_rate_limits`
- Persisted wiki insights in `wiki_ai_insights`

## Where AI Shows Up
- Wiki page view: AI dropdown for summary, key decisions, assumptions
- Wiki assets: same AI dropdown plus Q&A panel
- Work Items: summary, refinement, and assignment assistance
- Dashboards: AI Insights rollups

## How AI Is Applied
- AI responses are generated in API routes
- Users explicitly apply or copy AI output
- No automatic DB writes from AI output
