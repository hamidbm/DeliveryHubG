# Quick Setup

This section is the practical getting-started guide for running DeliveryHub on a laptop.

It is written as a tutorial, not as a technical reference manual.

## What You Will Do

By the end of this setup flow you will:

- install the required tools
- start MongoDB
- run DeliveryHub locally
- open the app in your browser
- understand the minimum environment variables for local development

## Recommended Path

1. Read [Laptop Requirements](local-development.md)
2. Follow [Run DeliveryHub Locally](local-development.md)
3. Use [Local Workflow and Troubleshooting](workflow.md) if you hit issues

## Two Common Ways To Run Locally

### Option 1: Run Next.js locally, MongoDB in Docker

This is the best choice for day-to-day development because:

- frontend and API changes reload quickly
- MongoDB still runs in a clean container
- logs are easier to inspect while developing

### Option 2: Run the whole stack with Docker Compose

This is useful when you want a containerized local environment that is closer to deployment behavior.

## Local Defaults

DeliveryHub is designed to be friendly to local development:

- local auth is the normal default
- baseline data bootstraps automatically
- sample data is optional

## What To Read Next

- [Laptop Requirements and First Run](local-development.md)
- [Local Workflow and Troubleshooting](workflow.md)
