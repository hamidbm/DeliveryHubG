# Applications Module

The Applications module is the Application Portfolio Management layer of DeliveryHub.

It gives the product its portfolio memory by keeping track of the systems, bundles, ownership, lifecycle context, dependencies, and delivery impact that surround the work being executed.

## What This Module Is For

In large delivery programs, work plans alone are not enough. Teams also need to know:

- which applications are affected
- which applications move together as a bundle
- which systems are business-critical
- where dependencies can create drag or risk
- how release and lifecycle context should influence delivery decisions

The Applications module provides that context.

## Core Capabilities

### Application registry

DeliveryHub maintains a structured inventory of applications so users can understand the systems inside the program, not just the tasks being performed.

### Bundle profiles

Bundle profiles are a major management surface in this module.

They bring together:

- ownership and accountability
- current milestone posture
- planned go-live context
- notes and operational context
- links into roadmap and application detail

This allows leadership to review a delivery grouping as a business object, not only as a technical grouping.

### Environment and planning context

Applications and bundles can carry planning context such as environment schedules, go-live timing, defaults, and application-level overrides.

This makes delivery planning more repeatable and reduces manual re-entry of the same planning assumptions.

### Portfolio and release train structure

The module supports portfolio-level grouping and release-train style organization so applications can be reasoned about at more than one planning level.

### Cross-application dependencies

Dependencies between applications are visible in the module so leaders can see where one system constrains another.

This helps explain why apparently simple plans may still be fragile.

### Lifecycle and criticality context

Applications can be tracked with lifecycle and business importance context, allowing teams to distinguish between routine systems and high-consequence systems.

### Delivery impact views

The module can surface how an application relates to:

- connected applications
- impacted milestones
- related work
- broader delivery risk

### Bundle health and risk context

The module is designed to surface bundle health, including signals related to milestones, overdue work, risks, and dependencies, so upper management does not need to inspect raw work-item detail to understand exposure.

## Typical Ways Teams Use It

### For upper management

Use bundle profiles to understand which bundles matter most, who owns them, which milestones are active, and where dependency concentration is becoming dangerous.

### For PMO and program leadership

Use this module to explain why a delivery issue matters in business terms, not only in task terms.

### For architects and engineering leaders

Use dependencies, environment strategy, lifecycle context, and delivery impact to reason about sequencing, cutover, and operational consequences.

## How This Module Connects to the Rest of DeliveryHub

- **Work Items** owns execution workflow, while Applications provides the business and system context around that work.
- **Architecture** can link diagrams and reviews back to applications and bundles.
- **Dashboards** use bundle and application context to make portfolio views meaningful.
- **AI Insights** uses application and bundle relationships to explain concentration risk and propagation.

## Why This Module Matters

Without the Applications module, DeliveryHub would still know that work exists, but it would be much harder to answer:

- what systems are in scope
- which business services are affected
- where dependencies create structural risk
- who should care most about a delivery issue

That is why Applications is one of the four major apps in the platform.
