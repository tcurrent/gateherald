# Getting Started

## Tech Stack

- Node.js (ES Modules)
- Express 5
- Sequelize 6
- SQLite (default local DB)
- Tailwind CSS + PostCSS (UI build)

## Requirements

- Node.js 20+
- npm

## Installation

1. Create `.env.development` from `.env.development.example`, then adjust values for your machine.
2. Run the following:
    - `npm install`
    
    Note: `.env.development` is ignored by git. Keep real secrets there and commit only the example files.

## Run Commands

```bash
npm start               # NODE_ENV=development, loads .env.development
npm run start:prod      # NODE_ENV=production, loads .env.production
npm run build:css       # Build ui/dist/styles.css from ui/styles.css
npm run db:migrate      # Run migration scripts
npm run db:seed         # Run migrations + seed scripts
npm run db:reset        # Delete DB, then run migrations + seed scripts
npm run build:docs      # Local docs build
npx serve .site         # Preview local docs after build (include -l flag and port if needed)
```

## Environment Variables

The app loads `.env.{NODE_ENV}` from project root.

Core variables:
- `PORT` (default: `3000`)
- `API_TOKEN` (used by seeded outbound header example)
- `SERVE_UI` (default: `true`; set `false` for backend/API-only mode)
- `ALLOWED_ORIGINS` (comma-separated allowlist for CORS on `/api`)
- `FRONTEND_ONLY_API` (default: `false`; set `true` to allow `/api/*` only from trusted frontend proxy headers or admin token clients)
- `FRONTEND_AUTH_ENABLED` (default: `false`; set `true` to require login/logout for frontend UI and related APIs)
- `FRONTEND_AUTH_USERNAME` (required when `FRONTEND_AUTH_ENABLED=true`)
- `FRONTEND_AUTH_PASSWORD` (required when `FRONTEND_AUTH_ENABLED=true`)
- `FRONTEND_AUTH_SESSION_SECRET` (required when `FRONTEND_AUTH_ENABLED=true`; used to sign session cookies)
- `FRONTEND_AUTH_SESSION_TTL_MINUTES` (default: `480`)
- `ADMIN_API_TOKEN` (optional; protects admin APIs with Bearer auth or `X-Gateherald-Admin-Token`)
- `ADMIN_PROXY_SHARED_SECRET` (required when `FRONTEND_ONLY_API=true`; protects APIs via `X-Gateherald-Proxy-Secret` from a trusted reverse proxy)
- `DEBUG_TRANSFORMED_PAYLOAD` (default: `false`; when `true`, logs transformed webhook payloads for local debugging)
- `FORWARD_REQUEST_TIMEOUT_MS` (default: `15000`)
- `FORWARD_MAX_CONCURRENT` (default: `20`)
- `FORWARD_QUEUE_WARN_THRESHOLD` (default: `250`)

Example:

```env
PORT=3000
SERVE_UI=false
ALLOWED_ORIGINS=https://gateherald.internal
FRONTEND_ONLY_API=true
FRONTEND_AUTH_ENABLED=true
FRONTEND_AUTH_USERNAME=gateadmin
FRONTEND_AUTH_PASSWORD=replace_me
FRONTEND_AUTH_SESSION_SECRET=replace_with_long_random_secret
API_TOKEN=replace_me
ADMIN_API_TOKEN=replace_me_admin
FORWARD_REQUEST_TIMEOUT_MS=15000
FORWARD_MAX_CONCURRENT=20
```

### Local Development Auth Defaults

When running the Node app directly on localhost (without an Nginx proxy adding auth headers), keep these blank so frontend API calls can load template/config records:

```env
ADMIN_API_TOKEN=
ADMIN_PROXY_SHARED_SECRET=
```

Set those values only when you also send matching headers (`Authorization`/`X-Gateherald-Admin-Token` or `X-Gateherald-Proxy-Secret`) from a trusted client/proxy.

## UI Access

When `SERVE_UI=true`:
- Config Builder: `/ui/config-builder`
- Template Builder: `/ui/template-builder`
- Docs: `https://tcurrent.github.io/gateherald/`

The UI files also support static hosting with relative paths:
- `./config-builder.html`
- `./template-builder.html`
- `./dist/styles.css`

## Route Format

Configured route paths must start with:

```text
/webhook/
```

Typical format used by the UI:

```text
/webhook/{routeName}/{ULID}
```

## Data Model

Primary tables:
- `ingress`
- `egress`
- `templates`
- `route_configs`

Default local database file:
- `gateherald.db`

## Migration And Seeding Behavior

On app startup:
1. Migration scripts run
2. Previously applied migrations are skipped using an internal script-run tracking table
3. Templates and route configs are loaded into runtime memory
4. Route config validation runs before server start

Seeder scripts are applied only when explicitly running:

```bash
npm run db:seed
```

If you deleted sample records and need them back, rerun `npm run db:seed`.

Expected sample records:
- Template: `sample.base`
- Route path: `/webhook/sample/01J0Z8X3GWBD9117Q9H4M2KCFP`

## Frontend API Base URL (Single File Config)

To point UI calls at a different backend origin, set this once in `ui/env.js`:

```js
window.GATEHERALD_API_BASE_URL = 'https://api.gateherald.example.com';
```

If this value is empty, UI uses same-origin `/api/...`.
