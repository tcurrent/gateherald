# API Reference

## Health

- `GET /api`

When `FRONTEND_AUTH_ENABLED=true`, this endpoint requires a valid frontend login session cookie.

## Template Catalog For UI

- `GET /api/ui/templates`

When `FRONTEND_AUTH_ENABLED=true`, `/api/ui/*` endpoints require a valid frontend login session cookie.

When `ADMIN_API_TOKEN` or `ADMIN_PROXY_SHARED_SECRET` is set, the template/config admin endpoints below require that credential in-app even if a proxy is misconfigured.

If you run the app directly in local development (no reverse proxy header injection), keep both values blank to avoid blocking frontend UI API calls.

## Admin Auth Header Patterns

- Direct API clients with `ADMIN_API_TOKEN` can send either:
  - `Authorization: Bearer <ADMIN_API_TOKEN>`
  - `X-Gateherald-Admin-Token: <ADMIN_API_TOKEN>`
- Reverse proxies with `ADMIN_PROXY_SHARED_SECRET` should send:
  - `X-Gateherald-Proxy-Secret: <ADMIN_PROXY_SHARED_SECRET>`

## Templates CRUD

- `GET /api/templates`
- `POST /api/templates`
- `PUT /api/templates/:id`
- `DELETE /api/templates/:id`

## Configs CRUD

- `GET /api/configs`
- `POST /api/configs`
- `PUT /api/configs/:id`
- `DELETE /api/configs/:id`

## Webhook Ingress

- `ALL /webhook/:routeId`
