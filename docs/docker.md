# Docker Deployment

## Architecture

Two containers share an internal Docker bridge network:

- **`backend`** — Node.js app in API-only mode (`SERVE_UI=false`, `FRONTEND_ONLY_API=true`). Publishes port 3000 for external webhook ingress.
- **`frontend`** — nginx serving the static UI and proxying admin API requests to the backend over the internal network. No published port for the backend API means direct external access to `/api/*` is blocked at the network level.

Traffic flow:
- Webhook providers → `backend:3000` (published)
- Admin users → `frontend` nginx → static files served directly; `/api/*` proxied to `backend:3000` with `X-Gateherald-Proxy-Secret` header injected

## Files To Create

The following files are referenced throughout these steps:

- `Dockerfile` — backend container image
- `docker-compose.yml` — service definitions
- `deploy/docker/nginx.conf` — nginx config for the frontend container
- `.dockerignore` — excludes `.env.*` files, the database, and other unnecessary paths from the build context so secrets are not baked into the image

All are included in the repo under their respective paths.

## Step 1 — Build The UI CSS

The frontend container serves static files. Build the CSS before starting the stack:

```bash
npm install
npm run build:css
```

This outputs `ui/dist/styles.css`, which the nginx container will serve directly.

## Step 2 — Configure The nginx Auth Snippet

The frontend nginx config includes an auth snippet at `/etc/nginx/snippets/gateherald-admin-auth.conf`, mounted from `deploy/nginx/snippets/`. Choose one:

- **Basic Auth**: copy `gateherald-admin-auth-basic.conf` → `gateherald-admin-auth.conf`
- **OIDC**: copy `gateherald-admin-auth-oidc.conf` → `gateherald-admin-auth.conf`

```bash
copy deploy\nginx\snippets\gateherald-admin-auth-basic.conf deploy\nginx\snippets\gateherald-admin-auth.conf
```

For Basic Auth, create the htpasswd file that the snippet references:

```bash
htpasswd -c deploy/docker/.htpasswd-gateherald <username>
```

The `docker-compose.yml` mounts this file into the frontend container at `/etc/nginx/.htpasswd-gateherald`.

## Step 3 — Set The Shared Secret

`ADMIN_PROXY_SHARED_SECRET` is the shared credential between the nginx frontend and the Node backend. The frontend injects it as a request header; the backend verifies it before accepting any admin API call.

Generate a strong random value:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `ADMIN_PROXY_SHARED_SECRET` to this value in your `.env.production` file (see Step 4). That is the only place it needs to go.

`deploy/docker/nginx.conf` uses `${ADMIN_PROXY_SHARED_SECRET}` as a placeholder. At startup, the nginx container reads the value from the environment and substitutes it before the config is loaded — the secret is never written into any file in the repository.

The frontend nginx container only receives `ADMIN_PROXY_SHARED_SECRET` from the environment. Other backend secrets (`DB_PASSWORD`, `API_TOKEN`, etc.) are passed only to the backend service via `env_file: .env.production` and are not exposed to the nginx container.

## Step 4 — Configure Backend Environment

Create a `.env.production` file in the project root (or pass variables directly to Compose). A minimal production config:

```env
NODE_ENV=production
PORT=3000
SERVE_UI=false
FRONTEND_ONLY_API=true
ALLOWED_ORIGINS=http://localhost:8080
ADMIN_PROXY_SHARED_SECRET=<value from step 3>
```

Set `ALLOWED_ORIGINS` to the external URL where the frontend nginx is reachable. This controls CORS for browser-initiated API requests.

For SQLite the default database location is used; it will be persisted via the named volume defined in `docker-compose.yml`. If using Postgres or MySQL instead, add the `DATABASE_URL` / `DB_*` vars from `.env.production.example`.

## Step 5 — Run Migrations

Run database migrations once before starting the app for the first time, or after any upgrade that includes new migrations:

```bash
docker compose run --rm backend node scripts/db-migrate.js
```

## Step 6 — Start The Stack

```bash
docker compose up -d
```

- Frontend (admin UI) is available at `http://localhost:8080`
- Webhook ingress is available at `http://localhost:3000/webhook/...`

To follow logs:

```bash
docker compose logs -f
```

## Step 7 — TLS

The `docker-compose.yml` exposes the frontend on HTTP port 8080. For HTTPS, put a TLS-terminating reverse proxy (another nginx, Caddy, Traefik, etc.) in front of port 8080 and set the appropriate `X-Forwarded-Proto` header. The app already reads this header for cookie `Secure` flag decisions.

Do not expose the backend container's port 3000 through TLS termination intended for admin users — keep that path for webhook ingress only.

## Optional — Postgres/MySQL Database Container

By default the backend uses SQLite, persisted via a named Docker volume. This is sufficient for a single-node deployment. If you want a proper relational database with concurrent write support and a fully independent data lifecycle, add a `db` service to the Compose stack.

### 1 — Install The Driver

The Postgres or MySQL driver must be present in the image. Add it as a production dependency before building:

```bash
# Postgres
npm install pg pg-hstore

# MySQL
npm install mysql2
```

### 2 — Add The db Service To docker-compose.yml

Add a `db` service on the same internal network, with its own named volume. Update `backend` to depend on it:

```yaml
volumes:
  gateherald-data:     # remove or repurpose — no longer used for SQLite
  gateherald-db:       # postgres data directory

services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: gateherald
      POSTGRES_USER: gateherald_user
      POSTGRES_PASSWORD: "${DB_PASSWORD}"
    networks:
      - gateherald
    volumes:
      - gateherald-db:/var/lib/postgresql/data
    restart: unless-stopped
    # No 'ports' — not reachable from outside Docker

  backend:
    build: .
    env_file: .env.production
    depends_on:
      - db
    ports:
      - "3000:3000"
    networks:
      - gateherald
    restart: unless-stopped
```

Do not publish the `db` container's port. It only needs to be reachable from `backend` on the internal network.

### 3 — Update Backend Environment

Remove the SQLite volume mount from `backend` and add database connection vars to `.env.production`:

```env
DB_DIALECT=postgres
DB_HOST=db
DB_PORT=5432
DB_NAME=gateherald
DB_USER=gateherald_user
DB_PASSWORD=<strong password>
DB_SSL=false
```

`DB_HOST=db` resolves to the `db` container via Docker's internal DNS. `DB_SSL=false` is appropriate here because the connection stays on the internal bridge network; enable it if your setup routes through a TLS-capable proxy.

### 4 — Run Migrations

Wait for Postgres to be ready before migrating. A simple one-off approach:

```bash
docker compose up -d db
# wait a few seconds for Postgres to initialise, then:
docker compose run --rm backend node scripts/db-migrate.js
docker compose up -d
```

For a more robust solution, use a healthcheck on the `db` service and `depends_on: condition: service_healthy` on `backend`. See the [Compose healthcheck docs](https://docs.docker.com/compose/how-tos/startup-order/) for details.

---

## Notes

- **`ui/env.js`** defaults to an empty API base URL, which means the browser sends API requests to the same origin it loaded the UI from. The frontend nginx then proxies them internally to the backend. No changes to `env.js` are needed.
- **Auth snippet cutover (Basic → OIDC)** follows the same steps as `docs/nginx.md`. Only `deploy/nginx/snippets/gateherald-admin-auth.conf` needs to change; the nginx config and Compose file are not affected.
- **Seed data**: to seed the database with sample data, substitute `db:seed` for `db-migrate.js` in the migration command: `node scripts/db-seed.js`.
