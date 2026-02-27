🧠 High-level UX strategy (what you’re really building)
=======================================================

Today’s flow:

> New Canvas → blank editor → user must know everything

That’s expert-friendly but **hostile to most enterprise users**.

What you want:

> New Canvas → guided intent → smart template → editor

This is the correct enterprise pattern.

✅ Recommended UX flow (v1)
==========================

Step 0 — User clicks “New Canvas”
---------------------------------

Instead of going straight to the editor, open a **Create Diagram Wizard**.

Modal or full-screen stepper both work. Given your app style, I recommend:

👉 **Centered modal wizard (v1)**👉 Later: optional full-screen experience

Step 1 — “What are you trying to create?”
-----------------------------------------

This is the most important step.

### UI

Grid of **diagram intent cards** (not a boring dropdown).

Categories (exhaustive but grouped):

### Enterprise Architecture

*   Cloud Enterprise Architecture

*   Application Integration

*   C4 Context

*   C4 Container

*   C4 Component


### Software Design

*   Sequence Diagram

*   Class Diagram

*   Service Design

*   API Flow


### Data

*   Database Schema

*   Data Flow Diagram


### Strategy / Planning

*   Mind Map

*   Capability Map


🔑 Critical design rule
-----------------------

Do NOT ask for Mermaid vs Draw.io first.

Users think in **intent**, not tools.

Step 2 — “Choose your editing format”
-------------------------------------

Now show compatible formats based on the selected diagram type.

Example mapping:

|Diagram Type| Allowed Formats|
|:---|---|
|C4|Mermaid, Draw.io|
|Sequence|Mermaid|
|Mind Map|Mindmap MD|
|Enterprise Arch|Draw.io, Mermaid|
|Database|Mermaid|

UI:

*   segmented buttons (like you already have)

*   but context-aware


Step 3 — “Start from template”
------------------------------

This is where your platform becomes powerful.

Show template gallery filtered by:

*   diagramType

*   format


Each template card shows:

*   name

*   preview thumbnail

*   description

*   “Start from template”


Also include:

👉 **Blank diagram option**

Step 4 — Create user copy (important!)
--------------------------------------

When user selects template:

**DO NOT load template directly.**

Instead:

1.  Fetch template from DB

2.  Clone content into new diagram record

3.  Set:

```typescript
sourceTemplateId
createdFromTemplate: true
```

1.  Open editor with the cloned content


Templates must remain immutable.

🧱 Data model additions (minimal but powerful)
==============================================

You likely need a new collection:

diagram\_templates
------------------

Recommended shape:

```typescript
{
  _id,
  name,
  description,
  diagramType,     // e.g. 'c4_container'
  format,          // 'mermaid' | 'drawio' | 'mindmap'
  content,         // template source
  previewImage?,   // optional
  isActive,
  isDefault?,
  tags?,
  createdAt,
  updatedAt
}
```

This mirrors your wiki\_templates pattern (which is good architecture reuse).

🎯 Supported formats (your question)
====================================

You currently have:

*   Mermaid

*   Draw.io

*   Mind Map (MD)


**That is already strong.**

Do NOT add more yet.

Future (not now):

*   PlantUML

*   BPMN

*   ArchiMate


📏 What to remove from current screen
=====================================

Your current editor header:

> Mermaid | Drawio | Mind Map

After this change:

*   Those switches should still exist in editor

*   BUT wizard preselects the correct one

*   And disables incompatible ones if needed


🧪 MVP vs Phase 2 (important)
=============================

✅ MVP (build now)
-----------------

*   Wizard

*   Diagram type selection

*   Format selection

*   Template gallery

*   Clone template → new diagram

*   Open editor


🚀 Phase 2 (later, high ROI)
----------------------------

*   AI “Generate starter diagram”

*   Recommended templates by bundle/app

*   Recently used templates

*   Smart defaults per team


Do NOT overload v1.

🧾 What to tell Codex (paste-ready)
===================================

Message to Codex
----------------

Implement a **Guided Diagram Creation wizard** for Architecture → Diagrams.

### Entry point

When user clicks **“New Canvas”**, open a wizard instead of going directly to the blank editor.

Step 1 — Diagram intent
-----------------------

Show a grid of diagram type cards grouped by category.

Initial supported types:

Enterprise Architecture:

*   cloud\_enterprise\_architecture

*   application\_integration

*   c4\_context

*   c4\_container

*   c4\_component


Software Design:

*   sequence

*   class

*   service\_design

*   api\_flow


Data:

*   database\_schema

*   data\_flow


Strategy:

*   mind\_map

*   capability\_map


User must select one.

Step 2 — Format selection
-------------------------

Show available formats based on selected diagram type.

Supported formats:

*   mermaid

*   drawio

*   mindmap\_md


Format availability should be controlled by a mapping table (do not hardcode in UI).

Step 3 — Template selection
---------------------------

Fetch templates from new collection:

diagram\_templates

Filter by:

*   diagramType

*   format

*   isActive = true


Show:

*   template cards with preview

*   “Blank diagram” option


Step 4 — Create diagram from template
-------------------------------------

When user selects template:

Server must:

1.  Create new diagram record

2.  Copy template content into diagram

3.  Set:

```typescript
sourceTemplateId
createdFromTemplate: true
format
diagramType
```

1.  Open editor with the new diagram


**Templates must never be modified.**

Data model
----------

Add collection: diagram\_templates (mirror wiki\_templates design).

Acceptance criteria
-------------------

*   New Canvas opens wizard

*   User can select type → format → template

*   Template creates a new editable diagram copy

*   Editor opens pre-populated

*   Blank option still available

*   Flow works for Mermaid, Draw.io, Mind Map


### 1) Wizard UI: modal vs full-screen

Go with **centered modal wizard** for v1.

*   3 steps max (Type → Format → Template)

*   Should feel lightweight and fast

*   Full-screen stepper can be a v2 enhancement if we add more steps/options


### 2) Templates source: new collection vs in-memory

Introduce the **diagram\_templates Mongo collection now**.

Reason: the whole point is DB-managed “beautiful templates” that we can evolve without redeploys, mirroring wiki\_templates. This also avoids rewrites later.

### 3) Template preview images storage

Make preview images **optional for v1**.

If you implement previews:

*   Store preview as **base64 in Mongo** (similar to how some wiki assets are stored), but keep it lightweight (thumbnail only).

*   Alternatively: allow a previewUrl string and default to no image.


For v1: implement schema fields:

*   preview: { kind: 'none' | 'base64' | 'url', data?: string }…and render gracefully when absent.


### 4) diagramType enum on ArchitectureDiagram

Yes — add diagramType to architecture\_diagrams and persist it on each diagram.

*   It should be a string enum matching the wizard types (e.g., c4\_container, sequence, etc.)

*   This becomes essential for filtering templates, reporting, and future dashboards.


Also persist format (you already have) and add:

*   sourceTemplateId?: string

*   createdFromTemplate?: boolean


### 5) “Blank diagram” default path

Create the diagram record **only when the user clicks “Create”** at the end of the wizard.

Rationale:

*   Avoid orphan records if the user cancels mid-wizard.

*   Keeps audit/activity clean.


Implementation:

*   Wizard collects { title?, diagramType, format, templateId|null }

*   On Create:

    *   If templateId: clone template content into new diagram

    *   If blank: use default starter content per format (minimal valid mermaid/drawio/mindmap scaffold)


Product decision (recommended)
------------------------------

*   **v1**: Templates are managed in **Admin UI only** (admin + optionally CMO can manage via Admin module). Regular users cannot create templates.

*   **v2** (later): Allow **CMO “Promote to Template”** from an existing diagram, but it should still route through a controlled workflow (draft → approved/published), because templates are governance assets.


Why: templates affect the whole program; you want quality + consistency + avoid uncontrolled proliferation.

What to tell Codex (paste-ready)
--------------------------------

Implement **Diagram Templates** end-to-end: storage, admin management, seeding, and wizard usage.

### 1) Storage (Mongo)

Create collection: **diagram\_templates**

Schema (TypeScript + Mongo shape):

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   type DiagramTemplate = {  _id: ObjectId  key: string               // unique stable key, e.g. 'c4-container-mermaid-v1'  name: string              // human-friendly  description?: string  diagramType: string       // enum (matches wizard)  format: 'mermaid' | 'drawio' | 'mindmap_md'  content: string           // template source (mermaid text, drawio xml, mindmap md)  preview?: { kind: 'none' | 'base64' | 'url'; data?: string } // optional v1  tags?: string[]  isActive: boolean  isDefault?: boolean       // optional per (diagramType, format)  createdAt: Date  updatedAt: Date  createdBy?: string  updatedBy?: string}   `

Indexes:

*   key unique

*   (diagramType, format, isActive)

*   Optional: partial unique (diagramType, format, isDefault:true) to enforce one default


(Align style with existing wiki\_templates approach.)

### 2) Who can manage templates

Add an **Admin UI** section: **Admin → Architecture → Diagram Templates**.

Permissions:

*   **Admin only** for v1 (optionally include CMO later).

*   No template creation/editing for regular users in v1.


CRUD capabilities:

*   List templates with filters (diagramType, format, active)

*   Create / Edit template metadata + content

*   Set active/inactive

*   Mark default for (diagramType, format)

*   Preview content (render mermaid / show drawio thumbnail if possible; otherwise raw preview)


### 3) Seeding starter templates

Add a seed script / admin bootstrap routine that inserts a **starter set** of templates (idempotent).

Seed at minimum:

*   C4 Context (mermaid) — default

*   C4 Container (mermaid) — default

*   Sequence Diagram (mermaid) — default

*   Service Design (drawio) — default

*   Cloud Enterprise Architecture (drawio) — default

*   Database Schema (mermaid) — default

*   Mind Map (mindmap\_md) — default


Use stable key values so re-seeding updates existing docs rather than duplicating.

### 4) Wizard integration (loading and use)

Wizard Step 3 (“Start from template”) must query templates from DB:

API:

*   GET /api/diagram-templates?diagramType=...&format=...

*   Return only isActive=true

*   Sort: defaults first, then name


Wizard must show:

*   Template cards (name/description/optional preview)

*   “Blank diagram” option


### 5) Creating a diagram from a template

When user clicks **Create**:

Server endpoint should:

1.  Fetch template by \_id (if provided) and validate it’s active.

2.  Create new architecture\_diagrams record with:

    *   format, diagramType

    *   content = template.content (copied)

    *   sourceTemplateId = template.\_id

    *   createdFromTemplate = true

3.  Open editor on new diagram.


Important:

*   **Never modify the template**.

*   Diagram edits only touch architecture\_diagrams.


### 6) “Blank diagram” behavior

If templateId is null:

*   Create the diagram with minimal valid starter content per format:

    *   Mermaid: a simple flowchart LR skeleton

    *   Drawio: minimal empty doc xml

    *   Mindmap: minimal mindmap markdown scaffold


### 7) Future-proofing (do NOT implement now)

Do not build “user-generated templates” yet.We can add later:

*   “Promote to template” action for CMO with a draft/publish workflow.


### Acceptance criteria

*   Templates stored in diagram\_templates

*   Admin UI can CRUD + toggle active + set defaults

*   Wizard loads templates from DB and can create diagram copies

*   Seed script creates the starter set and is idempotent

# Questions And Answers:

### 1) Who can manage templates

For **v1**: allow **ADMIN and CMO** roles to manage diagram templates.

*   Rationale: templates are architecture governance assets; CMO are the architecture/governance team and will need to curate templates without engineering involvement.

*   Keep it strictly role-gated (no general users).


So: canManageDiagramTemplates(user) := role in { ADMIN, CMO }.

### 2) Where should the Admin UI entry live

Put it under the existing **Admin module** (left nav), as a new section:

**Admin → Architecture → Diagram Templates**

Do not create a new top-level Admin tab; keep it inside Admin to avoid navigation sprawl.

### 3) Template preview approach (v1)

Yes, that is acceptable:

*   **Mermaid**: render live preview.

*   **Mindmap (MD)**: render live if the existing renderer is available; otherwise show formatted text.

*   **Draw.io**: for v1, show **raw XML/text preview** + a “Download XML” action (optional) or just a code viewer.


Preview images remain optional; no need to implement base64 thumbnails yet.

### 4) Seeding templates: auto vs manual

Make seeding a **manual, idempotent script** (e.g., npm run seed:diagram-templates), not automatic on server start.

Rationale:

*   Avoid surprise overwrites in prod

*   Better operational control

*   Still easy to run during environment bootstrap


You _can_ optionally add a small Admin-only “Seed starter templates” button later, but v1 should be a script.