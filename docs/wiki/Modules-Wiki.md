# Wiki Module

The Wiki module is the documentation hub for DeliveryHub. It supports authored pages and uploaded documents with AI assistance.

## Core Features
- Markdown-based wiki pages
- Upload assets including Word, PDF, images, and Excel
- File tree navigation with filters and expand/collapse controls
- Breadcrumb navigation that syncs with the tree
- Sticky header with actions and AI dropdown
- Q&A panel for pages and assets

## Page Lifecycle
- Draft, In Review, Approved, Rejected, Archived
- Ownership and explicit approvals required

## Assets
- Word uploads are converted to Markdown
- Original file is preserved for download
- Markdown is editable after upload
- Excel uploads are parsed to JSON
- Excel preview supports Tile view and Table view with pagination

## AI Assistance
- AI menu provides Summarize, Key Decisions, Assumptions
- AI insights are stored in the database and persist across sessions
- Users can clear AI insights per artifact

## Markdown Rendering
- GitHub-flavored markdown supported
- Mermaid diagrams via ```mermaid blocks
- Mind map diagrams via ```mindmap blocks
- Syntax highlighting for common languages, including SQL

## Links Between Pages
- Internal links can use `/?tab=wiki&pageId=...` or `/wiki/<slug>` depending on routing
- App router listens to browser history and updates selection
