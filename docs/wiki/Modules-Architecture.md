# Architecture Module

The Architecture module supports system integration views, diagram management, and review workflows for architectural artifacts.

## Core Features
- Architecture diagram gallery (Mermaid, Draw.io, Markdown/Mindmap)
- Diagram creation wizard (blank, template-based, or upload)
- Document metadata (document type, bundle, application, milestone)
- Architecture reviews with cycles and reviewer feedback
- Linked Work Items for review requests
- Inline diagram rendering inside wiki pages

## Diagram Types
- Mermaid diagrams for text-to-diagram workflows
- Mind map diagrams for conceptual structure
- Draw.io diagrams (embedded editor + XML content)
- Uploaded assets (.drawio/.xml, .svg, .png, .jpeg, .pdf, .mmd, .md, .json)

## Diagram Creation
- Wizard flow supports:
  - Blank creation (choose format + metadata)
  - Template selection (from Admin-managed templates)
  - Upload from local files
- Document type is required for all diagrams.
- Bundle, application, and milestone are optional metadata.

## Reviews
- Submit diagram for review with default reviewers (CMO/Admin) and optional additional reviewers.
- Review cycles track requests, reviewer feedback, and vendor responses.
- Review comments are stored separately from general diagram comments.
- A Work Item is created automatically for each review request and links back to the diagram.
- See `docs/wiki/Reviews.md` for the shared workflow.

## Comments
- Diagram comments are stored in comment threads/messages.
- Review comments entered through the review flow are also linked into the review Work Item.

## Activities
- Architecture events are emitted for creation, upload, and updates.
- Events appear under Activities → Architecture.

## Data
- Diagrams stored in `architecture_diagrams`
- Templates in `diagram_templates`
- Reviews in `reviews`
- Comments in `comment_threads` and `comment_messages`
