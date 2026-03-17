# DeliveryHub

DeliveryHub is a software delivery, application portfolio management, architecture governance, and knowledge-management platform for large migration and modernization programs.

It brings together the core capabilities that teams usually spread across Jira, Confluence, LeanIX, Planview, dashboards, and AI decision-support tools into one operational system.

## Documentation

Hosted documentation: [https://hubworks.netlify.app/](https://hubworks.netlify.app/)

The documentation site is the main entry point for:

- quick laptop setup and local run instructions
- product guide material for executives, PMO teams, architects, and delivery leaders
- technical documentation for engineers working on the product

## Quick Setup

Minimum local path:

1. Install `git`, Node.js, and a container runtime such as Docker Desktop or Colima.
2. Install project dependencies:
   ```bash
   npm install
   ```
3. Create a local env file and set the most important variables before first run.

   Minimum recommended `.env.local`:

   ```bash
   MONGO_URL=mongodb://localhost:27017/delivery
   JWT_SECRET=replace-with-a-long-random-secret
   AUTH_MODE=local
   AUTH_DISABLE_LOCAL_SIGNUP=false
   AI_DEFAULT_PROVIDER=OPENAI
   OPENAI_API_KEY=your_openai_key
   ```

   Important notes:

   - `MONGO_URL` is required. The local default database name is `delivery`.
   - `JWT_SECRET` is important even in local development because login/session cookies depend on it.
   - `AI_DEFAULT_PROVIDER` should match a provider for which you actually set credentials.
   - If you do not want to use OpenAI, you can switch to another supported provider and set its key instead:
     - `OPENROUTER_API_KEY`
     - `GEMINI_API_KEY`
     - `ANTHROPIC_API_KEY`
     - `HUGGINGFACE_API_KEY`
     - `COHERE_API_KEY`
   - If you want admin bootstrap on first run, also set:
     - `ADMIN_BOOTSTRAP_EMAILS=you@company.com`
   - If you plan to test integrations locally, also set the relevant credentials:
     - GitHub: `GITHUB_TOKEN`, `GITHUB_REPOS`
     - Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEYS`

4. Start MongoDB:
   ```bash
   ./run.sh mongo
   ```
5. Run the app locally:
   ```bash
   npm run dev
   ```
6. Open:
   ```text
   http://localhost:3000
   ```

Alternative containerized run:

```bash
./run.sh
```

If you use Colima instead of Docker Desktop, one supported example is:

```bash
colima start --cpu 8 --memory 20 --mount-type virtiofs --disk 50
```

For the full setup tutorial, troubleshooting guidance, and laptop-specific installation steps for macOS and Windows, use the docs site.

## What DeliveryHub Provides

DeliveryHub is built around four major apps and two major cross-cutting modules.

### 1. Applications

Application Portfolio Management for large delivery programs.

Key capabilities:

- application and bundle inventory
- portfolio segmentation and health visibility
- planning metadata and planning context
- release train and lifecycle alignment
- environment strategy and go-live planning
- cross-application dependency modeling
- delivery-impact rollups by application and bundle

Why it matters:

- gives leaders a usable portfolio system of record
- links planning context directly to delivery execution
- makes migration scope, readiness, and ownership visible

### 2. Work Items

Jira-like task management, execution control, and roadmap planning.

Key capabilities:

- epic, feature, story, and task hierarchy
- kanban and execution-board views
- roadmap timeline, swimlane, and dependency views
- milestone and sprint planning
- advanced roadmap visualization
- bulk work management and quality views
- work-item linking, dependency tracking, and blocker management
- estimate requests, ownership nudges, and activity history
- delivery plan creation and preview workflows
- capacity-aware planning and bundle-level planning
- forecasting and probabilistic forecasting
- AI-driven optimization and what-if scenario planning
- staleness detection and intervention workflows
- cross-project risk propagation and dependency intelligence

Why it matters:

- turns portfolio plans into managed execution
- gives PMO and delivery managers a real operating model
- connects roadmap commitments to actual flow, risk, and capacity

### 3. Architecture

LeanIX-like architecture visibility and review workflows.

Key capabilities:

- architecture diagrams and integration views
- capability and interface management
- architecture review submission and cycle tracking
- reviewer assignment and feedback workflows
- architecture activity visibility across delivery work

Why it matters:

- keeps architecture decisions tied to execution
- improves traceability between design intent and delivery reality
- supports review governance without separate disconnected tools

### 4. Knowledge

Confluence-like knowledge management powered by the Wiki module.

Key capabilities:

- structured wiki spaces and pages
- markdown-based knowledge authoring
- Word, PDF, image, and spreadsheet asset support
- Word-to-markdown conversion with stable image serving
- comments, discussion threads, and review launch from documents
- history, revert, themes, templates, and taxonomy support
- AI-assisted knowledge exploration and insights

Why it matters:

- keeps documentation close to delivery work
- reduces loss of context across teams and migration waves
- supports governed document review and institutional memory

### 5. Dashboards

Executive and program visibility across the whole portfolio.

Key capabilities:

- executive dashboards
- bundle and milestone dashboards
- portfolio health and delivery-intelligence views
- milestone readiness and commitment tracking
- burnup, drift, and progress signals
- program-level risk concentration and intervention views

Why it matters:

- gives CIO, VP, PMO, and delivery leadership a live control tower
- shortens the path from signal to intervention
- makes portfolio health understandable without manual slide creation

### 6. AI Insights

Assistive decision support across portfolio, delivery, and governance workflows.

Key capabilities:

- portfolio summaries and executive briefings
- saved investigations and evidence-backed analysis
- trend detection and change monitoring
- AI alerts, watchers, and notification workflows
- strategic advisor flows
- forecast interpretation and explainability
- scenario modeling and action planning
- AI-assisted optimization support

Why it matters:

- helps leadership move faster on complex portfolio questions
- surfaces risks and opportunities earlier
- supports better decisions without giving AI uncontrolled write access

## Product Positioning

DeliveryHub is not just a task tracker and not just a portfolio registry.

It is designed as an integrated operating platform for transformation programs where leaders need to understand:

- what exists in the portfolio
- what is being delivered
- what is blocked or drifting
- what architecture decisions matter
- what documentation supports execution
- what leadership should do next

## Core Principles

- server-side MongoDB access only
- AI is assistive only and never silently changes product data
- governance, traceability, and auditability are first-class concerns
- Work Items remain the execution system of record

## Local Development Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test:api
```

## Notes

- `run.sh` provides a quick local path for starting MongoDB or running the app in containers without using Docker Compose directly.
- MongoDB Compass is optional, but useful if you want to inspect local collections during development.
- The docs site contains the full quick setup, product guide, and technical documentation.
