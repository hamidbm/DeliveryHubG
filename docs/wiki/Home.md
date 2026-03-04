# DeliveryHub Wiki

Welcome to the DeliveryHub product documentation. DeliveryHub is an internal Software Delivery + Application Portfolio Management portal that consolidates program governance, technical architecture, work execution, and documentation in one place.

Use this wiki to understand what the app does today, how it is structured, and how to extend it safely.

Baseline bootstrap runs automatically on startup to install required reference data (taxonomy, themes, templates, bundles/apps). Sample data is optional and may change during development.

## Quick Navigation
- Architecture and structure: see `docs/wiki/Architecture.md`
- Modules overview: see `docs/wiki/Modules-Overview.md`
- Wiki module: see `docs/wiki/Modules-Wiki.md`
- Work Items module: see `docs/wiki/Modules-WorkItems.md`
- Applications module: see `docs/wiki/Modules-Applications.md`
- Architecture module: see `docs/wiki/Modules-Architecture.md`
- Reviews: see `docs/wiki/Reviews.md`
- Dashboards and AI Insights: see `docs/wiki/Modules-Dashboards.md`
- Admin module: see `docs/wiki/Admin.md`
- AI capabilities and governance: see `docs/wiki/AI.md`
- Data model and collections: see `docs/wiki/Data-Model.md`
- Operations and deployment: see `docs/wiki/Operations.md`
- Development workflow: see `docs/wiki/Development.md`
- Known gaps and next steps: see `docs/wiki/Roadmap.md`

## About DeliveryHub
DeliveryHub is an internal MVP web application used to manage a large migration program with hundreds of applications moving to cloud platforms. It replaces or complements several tools with a unified experience.

What it consolidates:
- Jira-like Work Items
- Confluence-like Wiki
- LeanIX-like Architecture
- Planview-like Applications
- Dashboards and AI Insights

Key principles:
- Next.js App Router with server-side MongoDB access
- BFF architecture (no separate backend service)
- Assistive AI only, with explicit user actions
- Strong focus on governance and auditability

User preferences:
- Notification preferences are managed under Profile Settings (mute types + opt into daily digest).
