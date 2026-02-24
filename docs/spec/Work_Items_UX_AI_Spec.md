# Work Items Module --- UX + AI Redesign Specification

## Purpose

This document defines the **modern UX redesign** and **AI augmentation
strategy** for the Work Items module (Epics, Features, Stories, Tasks,
etc.).

Goals:

-   Improve clarity and navigation speed
-   Reduce cognitive load
-   Enable AI-assisted execution
-   Align with enterprise-grade product UX patterns
-   Maintain compatibility with current data model

------------------------------------------------------------------------

# 1. High-Level UX Principles

## 1.1 Design North Star

The Work Items experience must be:

-   Fast to scan
-   Hierarchy-first
-   Action-oriented
-   AI-assisted, not AI-intrusive
-   Consistent with Wiki and Reviews modules

## 1.2 Layout Philosophy

Three persistent regions:

1.  **Global Work Header (sticky)**
2.  **Hierarchy Navigator (left)**
3.  **Context Workspace (right)**

------------------------------------------------------------------------

# 2. Global Work Header (Sticky)

## Requirements

Must remain visible during scroll.

### Contents

Left:

-   Module title: "Work Delivery Hub"
-   Breadcrumb (optional future)

Center:

-   View switcher:
    -   Roadmap
    -   Hierarchy
    -   Backlog
    -   Cycle Planning
    -   Milestones
    -   Board
    -   List View

Right:

-   Filters button
-   Focus pills (All / My Issues / Recent / Blockers)
-   AI command button (future)

### CSS Requirements

``` css
.work-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--surface-primary);
  border-bottom: 1px solid var(--border-subtle);
}
```

**Critical:**

-   No parent container may have `overflow: hidden|auto|scroll` above
    this element.
-   If unavoidable, move scrolling to inner content container.

------------------------------------------------------------------------

# 3. Left Hierarchy Panel (Navigator)

## Goals

-   Faster scanning
-   Better density
-   Progress visibility
-   AI affordances

## Enhancements

### 3.1 Visual Improvements

Add:

-   Progress bars for Epics/Features
-   Status color dots
-   Better indentation rhythm
-   Hover quick actions

### 3.2 Node Structure

Each node shows:

-   Icon
-   Title
-   Status pill (compact)
-   Progress bar (for parents)
-   AI hint icon (future)

### 3.3 Sticky Controls

Top of panel:

-   Expand All
-   Collapse All
-   Filter (future)

These controls must remain sticky **within the left panel**.

------------------------------------------------------------------------

# 4. Right Workspace (Item Details)

## Layout

### Header Row

-   Back arrow
-   Item key + title
-   Snapshot button (right)
-   AI assistant button (future)

### Secondary Tabs

Keep but modernize:

-   Details
-   Checklist
-   Comments
-   Traceability
-   Vault
-   Pulse
-   Gemini

### Improvements

-   Increase tab hit area
-   Add subtle active indicator animation
-   Lazy load heavy tabs

------------------------------------------------------------------------

# 5. AI Integration Strategy

## 5.1 AI Copilot Panel (Phase 1)

Right-side collapsible panel.

### Entry Points

-   Header AI button
-   Slash command in comments
-   Empty states
-   Backlog grooming

### Capabilities (Phase 1)

-   Summarize item
-   Generate acceptance criteria
-   Suggest subtasks
-   Risk detection
-   Blocker explanation

------------------------------------------------------------------------

## 5.2 AI Smart Actions (Phase 2)

Inline suggestions:

-   "Break into tasks"
-   "Improve description"
-   "Detect missing fields"
-   "Suggest dependencies"

Must be:

-   Dismissible
-   Non-blocking
-   Context-aware

------------------------------------------------------------------------

## 5.3 AI Risk Signals (Phase 2)

System computes:

-   Stale items
-   Scope creep
-   Overdue risk
-   Dependency risk

Displayed as small warning chips.

------------------------------------------------------------------------

# 6. Motion & Microinteractions

## Required

-   Smooth hierarchy expand/collapse
-   Hover elevation on cards
-   Tab underline animation
-   AI panel slide-in (200ms)

## Avoid

-   Heavy parallax
-   Long fades
-   Layout shifts

------------------------------------------------------------------------

# 7. Performance Requirements

-   Hierarchy virtualized for large trees
-   Tabs lazy loaded
-   AI calls debounced
-   Avoid full page reflows

------------------------------------------------------------------------

# 8. Accessibility

Must support:

-   Keyboard navigation in tree
-   ARIA roles for hierarchy
-   Focus traps in AI panel
-   Color contrast AA minimum

------------------------------------------------------------------------

# 9. Implementation Phases

## Phase 1 (High Impact --- Do First)

-   Sticky work header
-   Hierarchy visual polish
-   Workspace header cleanup
-   AI Copilot panel (basic)

## Phase 2

-   Smart AI suggestions
-   Risk signals
-   Advanced filters
-   Performance virtualization

## Phase 3

-   Predictive planning
-   AI sprint planning
-   Cross‑module intelligence

------------------------------------------------------------------------

# 10. Acceptance Criteria

The redesign is complete when:

-   Header remains sticky in all views
-   Tree scales to 5k+ nodes
-   AI panel opens \< 200ms
-   No layout shift during navigation
-   Keyboard navigation works end-to-end

------------------------------------------------------------------------

# END OF SPEC
