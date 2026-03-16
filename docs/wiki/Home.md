# DeliveryHub Documentation

DeliveryHub is an internal software delivery and application portfolio management platform used to coordinate migration programs, delivery governance, architecture reviews, portfolio visibility, and executive reporting in one place.

This documentation is now organized by audience instead of by internal implementation topics.

## Start Here

Choose the path that best matches what you need:

- **Quick Setup**: for anyone who needs to get DeliveryHub running locally on a laptop.
- **Product Guide**: for business users, delivery teams, architects, and upper management who want to understand the product, its features, and the value it provides.
- **Technical Documentation**: for engineers and developers working on DeliveryHub itself.

## Documentation Structure

### Quick Setup

Use this section when you need a detailed local setup tutorial:

- what to install first
- which environment variables matter
- how to start MongoDB and the app
- how to confirm the system is working

### Product Guide

Use this section when you want to understand what DeliveryHub does and how to use it well:

- what each module means
- what business problem it solves
- what benefits it provides
- how to get the most value from the workflow

### Technical Documentation

Use this section when you are building or maintaining the product:

- architecture and source layout
- operations and deployment
- data model and collections
- development workflow
- current implementation gaps and inconsistencies

## About DeliveryHub

DeliveryHub consolidates several capabilities that are usually spread across multiple tools:

- Jira-like work planning and execution tracking
- Confluence-like wiki and document collaboration
- LeanIX-like architecture and dependency visibility
- Planview-like application portfolio management
- Dashboards, reporting, and AI-assisted insights

## Core Principles

- MongoDB access stays server-side
- AI is assistive only and must not silently change business data
- Governance, traceability, and auditability are first-class concerns
- Work Items remain the execution system of record

## Recommended Reading Order

If you are new to the product:

1. Quick Setup
2. Product Guide overview
3. Product Guide pages for the modules relevant to your role

If you are a developer joining the project:

1. Quick Setup
2. Technical Documentation overview
3. Architecture, Data Model, Operations, Development Workflow
4. Implementation Gaps
