High-level UX: “Activities” as a hub with sub-sections
------------------------------------------------------

### Recommended pattern

*   **Top nav** (global): Activities

*   **Within Activities**: a **sticky secondary nav** (tabs) for sections:

    *   Reviews

    *   Comments

    *   (later) Architecture Events, Work Items Events, Wiki Publishing, etc.


This is a standard “module → submodule” pattern and it scales well.

What I’d change in your plan
----------------------------

### 1) Use tabs _only_ for top-level Activities sections

Keep the first-level Activities header extremely stable:

**Activities**

*   Tabs: Reviews | Comments | (later: Events, Architecture, Work Items, Wiki)


Each tab owns its own:

*   filters

*   sort

*   view mode

*   saved searches


This prevents the Activities page from becoming a long scroll of unrelated widgets.

### 2) Each tab gets its own sticky “toolbar”

So you end up with **two sticky layers**:

1.  Global top nav (already exists)

2.  Activities tabs (sticky)

3.  Inside tab: its own toolbar (also sticky), but sticky **within the tab content scroll region**


Important: don’t make the whole page scroll the window. Make Activities have:

*   sticky tabs on top

*   then a scrollable content area containing the selected tab’s toolbar + table/cards


This avoids the “sticky doesn’t stick” issues you’ve been fighting.

Concrete layout structure (what to build)
-----------------------------------------

Inside /activities route:

### Sticky layer A (module header + tabs)

*   Title: Activities

*   Tabs row (Reviews, Comments, …)


### Content area

The selected tab renders:

*   Sticky layer B: tab-specific toolbar (filters/search/view/sort)

*   Scroll region: results


So visually:

```code
GLOBAL NAV (sticky)
---------------------------------
Activities  [Reviews] [Comments] [...]   (sticky)
---------------------------------
Reviews toolbar: filters/search/view/sort (sticky inside pane)
---------------------------------
Scrollable results list / table
```

Reviews vs Comments: should they be siblings?
---------------------------------------------

Yes.

They’re both “activity-derived objects” but behave differently:

*   **Reviews**: workflow objects (state machine, cycles, due dates)

*   **Comments**: conversation objects (threads, participants, mentions)


If you try to merge them into one UI, you’ll end up with a compromised UX.

So separate tabs is correct.

Naming recommendation
---------------------

Instead of “Comments”, consider **“Discussions”**:

*   It’s broader and future-proof (includes comments, mentions, threads, review feedback threads, etc.)

*   “Comments” may feel too low-level once you add other activity types.


But “Comments” is still fine for v1.

Routing & state (important for scale)
-------------------------------------

Use URL-driven tab state so Activities deep links work:

*   /activities/reviews

*   /activities/comments


Do not keep tab selection only in React state.

Each tab can maintain its own query params:

*   /activities/reviews?bundle=...&status=...&view=table

*   /activities/comments?scope=wiki&assigned=me&q=...


This makes it shareable and debug-friendly.

The best scalable mental model
------------------------------

Think of **Activities as a container**, and each tab is a **mini-product** with its own UX.

That means:

*   each tab should have its own empty states

*   its own loading skeletons

*   its own filters

*   its own “saved view” later (optional)


Answer: is your thinking correct?
---------------------------------

Yes — but implement it as:

*   **Activities** = container page with sticky tabs

*   Each tab = its own route and its own sticky toolbar

*   One scroll container per tab (results scroll), not whole-window scrolling


This gives you:

*   predictable sticky behavior

*   clean growth path (Architecture, Work Items later)

*   strong IA (information architecture)


Below is a concrete **Activities IA (tab taxonomy)** + **exact implementation instructions you can paste to Codex**.

I’m optimizing for: (a) scalable info architecture as Activities grows, (b) minimal cognitive load (avoid “tabs-on-tabs-on-tabs” sprawl), and (c) clean deep-linking and state persistence. Tabs are appropriate here because these are **peer “views” of the same conceptual area** (Activity/History) rather than separate products.

Proposed tab taxonomy for Activities
------------------------------------

### Level 0: Activities (top-nav)

Activities is the **cross-module observability center** (“what happened / what needs attention”).

### Level 1: Activities sub-navigation (sticky)

Keep **3–5 visible tabs max**; push the rest into **More** to prevent tab overload as the app grows. (This is a common failure mode.)

**Recommended visible tabs now**

1.  **Feed** (default)

    *   Unified event stream across all modules (your current Activities feed can become this)

2.  **Reviews**

    *   Review dashboard + details (already built)

3.  **Comments**

    *   Cross-resource comment activity (mentions, unresolved, my threads, etc.)

4.  **Work Items** _(future)_

    *   Cross-project work item changes (status changes, blockers, etc.)

5.  **Architecture** _(future)_

    *   Diagram/model changes + approvals/reviews


**More (dropdown) for future tabs**

*   **Wiki** _(future)_: publish/upload/edit events + AI actions

*   **Applications** _(future)_: app metadata changes, ownership changes

*   **Insights** _(future)_: “signals” computed from events (trends, hotspots)

*   **Admin Audit** _(future, admin-only)_: config changes, permissions/assignments changes


> Why “Feed” as default? It prevents users from thinking Activities is “only Reviews/Comments”, and it lets you grow without redesign later.

### Level 2: Per-tab filters (not more tabs)

Each Level-1 tab gets its own **filter bar** and view toggles (table/cards, sort, time range). This avoids nested sub-tabs, which often become confusing and hard to scan.

Exact instructions to give Codex
--------------------------------

Copy/paste this to Codex:

### ✅ Codex Instructions: Activities IA + Routing + Sticky header

**Goal:** Implement Activities as a parent area with a sticky sub-navigation (tabs) that routes to child views: Feed, Reviews, Comments (now), and placeholders for future: Work Items, Architecture. Each child view owns its own filter/header.

#### 1) Routing structure (use nested routes)

*   Create these routes:

    *   /activities → redirects to /activities/feed

    *   /activities/feed

    *   /activities/reviews (existing Reviews dashboard should live here)

    *   /activities/reviews/\[reviewId\] (existing Review details should remain under reviews)

    *   /activities/comments

    *   /activities/work-items (placeholder “Coming soon”)

    *   /activities/architecture (placeholder “Coming soon”)

*   Do **not** use query-param routing for the top tabs; use path routing so deep links are stable and shareable.


#### 2) Activities layout with sticky subnav

*   Create a layout component for /activities/\*:

    *   src/app/activities/layout.tsx (or your equivalent)

    *   Structure:

        *   Top: page title row (“Activities” + optional global search)

        *   Below: **sticky tab bar** (Feed / Reviews / Comments / Work Items / Architecture + “More” dropdown later)

        *   Below: children (the selected view)


**Sticky requirements**

*   The sticky tab bar must stick **below the global app header**.

*   Use CSS like:

    *   position: sticky; top: ; z-index: 30; background: white; border-bottom

*   Important: ensure no ancestor of the sticky element has overflow: hidden/auto/scroll unless that ancestor is the intended scroll container. Sticky won’t work if an ancestor creates a new scrolling context.

*   If the app uses an internal scrolling container (common in dashboards), make the sticky element sticky relative to that container and ensure the container is the one scrolling.


#### 3) Tab component behavior

*   Tabs are **primary within Activities**:

    *   Active tab highlighted

    *   Keyboard accessible

    *   Each tab is a Link to its route

*   Keep the tab bar height compact (44–52px), no large padding.


#### 4) Per-view header rule

*   Inside each view (Feed/Reviews/Comments), implement its own header/filter bar.

*   Example:

    *   Reviews view has Table/Cards toggle + filters (bundle/status/search/sort)

    *   Comments view has filters (bundle/resource/author/mentions/unresolved)

    *   Feed view has event-type filters (module/type/time range)


#### 5) “More” dropdown (future-proofing)

*   Implement the tab bar so it can support:

    *   visibleTabs: Feed, Reviews, Comments, Work Items, Architecture

    *   overflowTabs: Wiki, Applications, Insights, Admin Audit

*   For now, it’s fine to hardcode visible tabs only; just design component API to accept arrays later.


#### 6) Consistent breadcrumb

*   In Activities pages show breadcrumb: Activities /  in a subtle style (already present in screenshots).

*   Keep it non-sticky; only the tab bar should be sticky.


#### 7) Visual design guidance

*   Keep tabs text size readable (14–16px).

*   Avoid heavy pill buttons for tabs; use simple nav tabs style (underline or filled background only for active). Tabs should read like navigation, not actions.


Notes on “table/card” toggle placement (for Reviews dashboard)
--------------------------------------------------------------

Put the **Table/Cards** toggle in the Reviews view header (right side), **not** in the Activities tab bar. The tab bar is for switching _destinations_, while Table/Cards changes _presentation of the same destination_.

Optional: if you want Activities to grow cleanly later
------------------------------------------------------

When you add more event sources (Work Items, Architecture, Wiki), keep a **shared event schema** and let Feed/filters do the work, rather than creating many new top-level tabs. Tabs should represent “jobs to be done”, not “data sources”.