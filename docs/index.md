# Overview

Gateherald is a webhook gateway that accepts inbound webhook events, transforms payloads with a template-driven mapper, and forwards results to one or more downstream endpoints.

It includes:
- A backend API and webhook runtime (Express + Sequelize)
- A route configuration builder UI
- A template builder UI

## Architecture At A Glance

1. Incoming webhook hits a configured route (`/webhook/{name}/{ULID}`).
2. Route config selects a template and field mapping rules.
3. `TemplateDriver` transforms inbound payload into egress payload.
4. App immediately responds to sender.
5. Forwarding to target URLs happens asynchronously.
6. Ingress and egress events are logged to the database.

## Features

- Database-backed route configs and templates
- Template-aware mapping validation
- Documentation rules for template fields that require them
- Ingress path discovery from sample payloads
- Multi-target forwarding with per-route headers
- CRUD APIs for templates and route configs
- Browser UI for managing templates and configs

## Documentation Map

- [Getting Started](getting-started.md)
- [API Reference](api-reference.md)
- [Troubleshooting](troubleshooting.md)
- [Deployment](deployment.md)
- [Nginx Config Notes](nginx.md)
- [Database In Production](database-production.md)
