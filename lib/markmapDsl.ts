
export const DEFAULT_MARKMAP_MD = `# Nexus Delivery Portal
## Portfolio
### Bundles
- B1 – Customer Onboarding
- B2 – Core Platform
- B3 – Data & Analytics
### Applications
- App A – Web Frontend
- App B – API Gateway
- App C – Identity & Access
## Delivery
### Milestones
#### M1 (Jan–Mar): Foundation
- Scope definition
- Baseline dashboards
- Diagram hub MVP
#### M2 (Apr–Jun): Execution
- Kanban board
- Dependencies
- Risk signals
### Work Items
- Epic → Feature → Story → Task
- Kanban swimlanes
- WIP limits
## Architecture
### Diagram Types
- Draw.io (WYSIWYG)
- Mermaid (text → SVG)
- Mind Map (Markdown)
### Views
- Application landscape
- Integration map
- Capability map
## Risks & Decisions
### Common risks
- Scope creep
- Unmanaged dependencies
- Over-capacity milestones
### Key decisions
- Milestone = timebox + scope
- Epics span milestones (lens)`;

export function isValidMarkdown(content: string): boolean {
  return content.trim().length > 0;
}
