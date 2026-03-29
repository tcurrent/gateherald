# Split-Host Deployment

## Internal Frontend + External Backend

This is the recommended split when UI users are internal but webhook/API runtime must be externally reachable.

## Target Topology

1. Host frontend (`ui/`) on an internal-only web server.
2. Host backend (`index.js`) on an external or DMZ-facing host.
3. Allow internal users to reach frontend only.
4. Allow frontend-to-backend HTTPS traffic only.
5. Allow external webhook senders to backend webhook routes.

## Backend Settings

Use API-only mode and strict CORS:

```env
SERVE_UI=false
FRONTEND_ONLY_API=true
ALLOWED_ORIGINS=https://gateherald.internal
PORT=3000
```

Notes:
- `ALLOWED_ORIGINS` must list exact internal frontend origins.
- Keep it explicit; do not use wildcard origins.
- Set `ADMIN_PROXY_SHARED_SECRET` and make your internal frontend proxy send `X-Gateherald-Proxy-Secret` on `/api/*` so only frontend-proxied API traffic is accepted.

## Proxy Auth And Route Protection

Use the Nginx configs in `deploy/nginx/` to protect admin UI/API routes while keeping webhook ingress public.

Protected routes:
- `/ui/*`
- `/api/templates*`
- `/api/configs*`
- `/api/ui/templates`

Public routes:
- `/webhook/*`

When `FRONTEND_ONLY_API=true`, external callers should only reach `/webhook/*`. Route `/api/*` traffic should be internal-proxy-only.

For detailed Basic Auth/OIDC cutover and hardening guidance, see `docs/nginx.md`.

## Single Nginx Host

Use `deploy/nginx/gateherald.conf` when the UI and backend run on the same host, with nginx in front:

1. Run backend in API-only mode (`SERVE_UI=false`).
2. Deploy static UI files from `ui/` to `/var/www/gateherald-ui` on the same host.
3. Install `deploy/nginx/gateherald.conf` as your site config.
4. Copy the active auth snippet to `/etc/nginx/snippets/gateherald-admin-auth.conf`.
5. Replace `replace_me_with_admin_proxy_shared_secret` in admin API locations with the exact `ADMIN_PROXY_SHARED_SECRET` value.
6. Reload Nginx.

Auth snippet activation and OIDC cutover steps are documented in `docs/nginx.md`.

## Split-Host Nginx Deployment

Use `deploy/nginx/gateherald-split-hosts.conf` when UI and API/webhook are on different hosts:

- Internal host: `gateherald.internal`
  - Serves static UI from `/var/www/gateherald-ui`
  - Enforces user auth for `/ui/*` and admin API routes
  - Proxies admin API calls to `api.gateherald.example.com`
- External host: `api.gateherald.example.com`
  - Exposes `/webhook/*` and `/api`
  - Restricts `/api/templates*`, `/api/configs*`, and `/api/ui/templates` to internal proxy CIDRs
  - Returns `404` for `/ui/*`

Rollout checklist:

1. Set backend to API-only mode (`SERVE_UI=false` in `.env.production` on the backend host).
2. Deploy UI files to internal host (`/var/www/gateherald-ui`).
3. Apply the internal server block from `deploy/nginx/gateherald-split-hosts.conf` on internal Nginx.
4. Apply the external server block from `deploy/nginx/gateherald-split-hosts.conf` on external Nginx.
5. Replace example private CIDRs in external config with real internal proxy egress ranges.
6. Set `ui/env.js` API base URL to `https://api.gateherald.example.com`.
7. Replace `replace_me_with_admin_proxy_shared_secret` in both internal and external admin API locations with the exact `ADMIN_PROXY_SHARED_SECRET` value.
8. Validate and reload both Nginx instances.
