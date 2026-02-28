# Work Items Module

The Work Items module is the execution system for DeliveryHub. It supports planning, tracking, and reporting for delivery work across milestones, bundles, and applications, and acts as the system of record for risks and dependencies.

## Work Item Types
- Epic
- Feature
- User Story
- Task
- Risk
- Dependency

Each item can have a parent and children to form a delivery hierarchy.

## Core Features
- Hierarchical work items with parent-child relationships
- Tree view, list view, board view (Kanban), backlog, and roadmap
- Drag-and-drop status changes on board/backlog
- Sprint planning and milestone planning
- Activity history per item (status changes, assignments, links)
- Assignment, watchers, and ownership tracking
- Priority, due dates, health, and metadata fields
- Dependencies and cross-item links
- Attachments and comments
- Linked resources (e.g., wiki pages, architecture diagrams)
- Review-driven work items (auto-created from review requests)

## Views

### Tree View
- Explore epics, features, stories, and tasks in hierarchy
- Expand and collapse to control scope
- Select an item to see details and activity
- Link badges show connected items and resources

### Board (Kanban)
- Drag-and-drop across status columns
- Visualize flow of work by phase
- Filter by bundle, application, milestone, and assignee

### Backlog
- Ranked list of work items
- Quick reprioritization
- Focus on upcoming milestones

### List View
- Flat list for search and filters
- Sort by status, owner, or priority
- Bulk selection and quick actions

### Roadmap View
- Timeline-style visualization
- Organize items by milestones and dates
- Identify delivery gaps and dependencies

### Milestone Planning
- Assign or move items between milestones
- Evaluate workload and sequencing

## Statuses
- TODO
- IN_PROGRESS
- REVIEW
- DONE
- BLOCKED

## Reviews Integration
- Review requests (wiki or architecture) can generate user stories automatically.
- Review cycles can be synced back into the work item.
- Review attachments and reviewer responses are linked into the work item activity.
- See `docs/wiki/Reviews.md` for the shared workflow.

## Activity and History
- Every update is logged as activity
- Status and assignment changes are tracked
- Snapshots are stored for historical reporting

## Filters
- Bundle
- Application
- Milestone
- Status
- Assignee
- My Issues (assigned to current user)

## AI Assistance
Work Items support AI-generated insights for planning and delivery management. AI is assistive only and requires explicit user action to apply results.

Supported AI workflows:
- Summarize work item or scope
- Suggest reassignment based on workload
- Standup digest
- Rationalize scope or priorities
- Refine task descriptions

## Data
- Stored in `workitems` collection
- Attachments stored in `workitems_attachments`
- Sprint planning in `workitems_sprints`
- Historical snapshots tracked alongside items
