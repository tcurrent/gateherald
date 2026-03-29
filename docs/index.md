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
4. App responds immediately; target forwarding happens asynchronously.
5. Ingress and egress events are logged to the database.

## Features

- Database-backed route configs and templates
- Automatic documentation URL injection via configurable match rules
- Ingress path discovery from sample payloads
- Multi-target forwarding with per-route headers
- Browser UI for managing templates and configs

## Documentation Map

- [Getting Started](getting-started.md)
- [UI Guide](ui-guide.md)
- [API Reference](api-reference.md)
- [Split-Host Deployment](split-host-deployment.md)
- [Docker Deployment](docker.md)
- [Nginx, Auth & Hardening](nginx.md)
- [Database In Production](database-production.md)
- [Troubleshooting](troubleshooting.md)
