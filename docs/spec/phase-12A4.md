What should happen next
This should be a focused follow-up phase:
Phase 12A.4
Styled PDF export that matches the in-app Wiki-quality report presentation
This phase should make the PDF look like a true exported report, not a stripped text dump.
The core requirement
The PDF should be generated from the same rendered report markup and styling model as the in-app report, or from a dedicated print template that intentionally mirrors it.
The rule
Do not generate the PDF from:
raw markdown source
markdown with symbols stripped
plain text serialization
Generate it from one of these:
the rendered HTML report with print CSS, or
a dedicated export HTML template using the same typography and section styling
What Codex should implement next
Use this as the next handoff.
Proceed with Phase 12A.4 - Styled PDF export for AI Insights.

Problem:
- The current PDF download works as a file download, but the exported document is visually poor.
- It appears to be generated from plain text / stripped markdown rather than from the rendered report styling.
- The PDF should match the polished in-app AI Insights/Wiki presentation much more closely.

Goals:
- Export a styled PDF that preserves report hierarchy and visual quality
- Reuse the same markdown presentation layer/CSS patterns as the in-app rendered report where feasible
- Produce a printable executive-quality document, not a raw text dump

Requirements:

## 1. PDF generation source
Do not generate PDF from raw markdown or stripped text.
Generate it from:
- the rendered HTML content plus print CSS, or
- a dedicated HTML export template that mirrors the in-app report styling

The PDF content must preserve:
- report title
- section headings
- paragraph spacing
- bullet styling
- metadata block
- divider/separator styling
- readable margins and page layout

## 2. Styling consistency
The PDF should visually resemble the AI Insights report as shown in-app:
- same heading hierarchy
- same markdown typography feel
- same section spacing rhythm
- same visual treatment for lists and emphasis
- clean branded report layout

It does not have to be pixel-identical to the app, but it must feel like the same document system.

## 3. Preferred implementation direction
Prefer a text-based HTML-to-PDF path over screenshot/raster export.

Acceptable approaches:
- server-side HTML template rendered to PDF
- print-focused client/server export from sanitized rendered HTML
- existing PDF utility in the codebase, if present, extended with styled HTML support

Avoid:
- screenshotting the DOM
- canvas rasterization
- plain text PDF composition if it loses styling

## 4. Print/export template
If needed, create a dedicated AI Insights export template with:
- DeliveryHub report title
- generated timestamp
- provider/model
- cached/freshness metadata
- rendered markdown report body
- print-safe typography and margins

Suggested structure:
- Header: AI Portfolio Insights Report
- Metadata block
- subtle divider
- rendered report content
- optional footer with generation timestamp/page numbering if easy

## 5. CSS requirements
Add print/export CSS so the PDF includes:
- strong H1/H2/H3 hierarchy
- consistent line height
- section spacing
- list indentation and bullet spacing
- page margins
- no clipped content
- no UI buttons/chrome in exported output

If the Wiki already has a high-quality markdown style system, reuse or adapt it for print.

## 6. Content fidelity
The exported PDF must preserve:
- headings as headings
- bold text as bold
- lists as lists
- paragraph grouping
- horizontal separators if present
- metadata labels and values clearly formatted

## 7. Acceptance criteria
Phase 12A.4 is complete when:
- Download PDF creates a real file
- The PDF visually resembles the styled in-app report
- The PDF no longer looks like stripped markdown/plain text
- Heading hierarchy is obvious
- Lists and spacing are clean
- Metadata is readable and well-placed
- Multi-section reports remain readable across pages
- npx tsc --noEmit passes

Implementation note:
Before adding any new heavy dependency, inspect whether the app already has:
- print/export utilities
- server-side document generation helpers
- shared markdown renderers/styles that can be reused for export
My recommendation on implementation approach
The best durable solution is:
Preferred
HTML template + print CSS + PDF generation from HTML
Why this is best:
preserves semantic headings and lists
keeps text selectable/searchable
allows reuse of your Wiki-like styling
gives predictable report layout
is much more maintainable than screenshot export
Avoid
DOM screenshot / image-based PDF
That usually gives:
blurry text
poor pagination
bigger files
layout fragility
What success should look like
When you open the exported PDF, it should feel like a polished report document with:
a strong report title
clear metadata block
section headings styled like the app
readable body text
properly indented bullets
visual spacing between sections
a professional print layout
Basically, the PDF should look like a document someone would actually attach to an email or bring into a meeting.
Where this sits in the roadmap
At this point the sequence is becoming clear:
12A: reliability
12A.1: provider normalization fixes
12A.2: markdown rendering and basic export
12A.3: persistence, freshness, regeneration control
12A.4: styled PDF export parity with in-app report
12B: richer structured AI analysis
So the next move is still not 12B yet. The export experience should be finished first.
Bottom line
The PDF is now technically downloadable, but not yet acceptable in presentation quality.
The next task is Phase 12A.4: styled PDF export based on rendered HTML/CSS, so the exported document matches the beautiful in-app report much more closely.