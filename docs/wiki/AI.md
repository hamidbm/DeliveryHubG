# AI Capabilities and Governance

AI in DeliveryHub is assistive only. It never writes to the database without explicit user action.

## Capabilities
- Wiki summary, key decisions, assumptions
- Q&A over pages and assets
- Template generation for new wiki pages
- Cross-module insights in AI Insights

## Governance
- Provider routing per task type
- Admin-controlled toggles by provider
- Rate limiting per task
- Retention controls
- Audit logging of AI usage

## Storage
- Settings in `ai_settings`
- Audit logs in `ai_audit_logs`
- Rate limits in `ai_rate_limits`
- Persisted wiki insights in `wiki_ai_insights`
