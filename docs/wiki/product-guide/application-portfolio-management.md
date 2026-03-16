# Application Portfolio Management

This capability is played by the **Applications** module.

## What It Means

Applications gives DeliveryHub its portfolio memory. It keeps track of the systems, bundles, dependencies, lifecycle state, release context, and delivery impact that surround the work being executed.

Without this module, the rest of the product would know that work exists, but not what business systems that work is really affecting.

## What Is Implemented

### Application registry and bundle context

DeliveryHub keeps an inventory of applications and their bundle membership so teams can understand which systems move together and who owns them.

### Bundle profiles

Bundle profiles provide a business-facing summary of a delivery grouping, including:

- ownership
- status
- current milestone context
- go-live context
- notes
- direct drill-down to roadmap, program, and app detail

This is important because bundle profiles turn the application inventory into a management view instead of a static catalog.

### Environment and planning context

Applications can capture delivery-related planning context such as:

- environment schedules
- go-live timing
- bundle-level defaults
- application-specific overrides

This reduces repeated manual planning effort and makes delivery planning more consistent.

### Cross-application dependencies

The module supports visible dependencies between applications so leaders can understand where one system can delay or constrain another.

This includes both direct application relationships and broader cross-bundle dependency visibility.

### Lifecycle tracking

Applications can carry lifecycle state, business criticality, and ownership context so delivery decisions can be judged with proper business importance in mind.

### Release trains and portfolios

DeliveryHub supports higher-level portfolio organization through:

- application portfolios
- release trains

This makes the module useful not only for inventory management but also for release and modernization planning.

### Bundle health scoring

DeliveryHub can summarize bundle health using signals such as milestone slippage, overdue work, open risks, and blocking dependencies.

This gives leadership a simple way to identify which areas are healthy, which need attention, and which are already at risk.

### Risks and dependencies surfaced in business context

Risks and dependencies are managed operationally in Work Items, but the Applications area surfaces them in bundle context so upper management does not need to inspect raw execution records to understand exposure.

### Delivery impact views

Delivery impact helps teams see how an application is connected to:

- dependencies
- related milestones
- related work items
- at-risk delivery activity

## Why These Features Matter

- executives gain a portfolio view rather than a project-only view
- delivery teams can see the system context behind roadmap decisions
- architecture and application information remain connected to execution
- cross-bundle and cross-application risk becomes easier to explain

## Who Gets the Most Value

### Upper management

Use Applications to understand portfolio structure, critical systems, and where delivery problems affect important business services.

### PMO and delivery leaders

Use bundle profiles, lifecycle, and dependency context to see what is in scope and how risk could propagate.

### Architects and engineering leaders

Use dependencies, lifecycle, environment strategy, and delivery impact to reason about sequencing and operational consequences.

## How Executives Should Use This in Practice

### CIO

Review which business-critical systems are concentrated in the same bundle, where lifecycle risk is high, and where dependency chains could threaten transformation goals.

### VP

Use bundle profiles to understand ownership, current milestone posture, and which applications deserve escalation attention.

### PMO

Use portfolio, release train, and dependency context to explain why a delivery plan is difficult, not just that it is late.

### Architects

Use application relationships, lifecycle, and environment strategy to guide sequencing and identify operational constraints early.

### Delivery managers

Use bundle profiles and delivery impact views before planning changes so roadmap decisions are made with real application context.
