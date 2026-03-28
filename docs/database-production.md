# Database In Production

## High Availability Note

Current default storage is SQLite, which is file-based and local.
For production HA/multi-node deployments, move to a managed relational database (for example, Postgres) and update Sequelize config accordingly.

## Using Postgres/MySQL In Production

The app supports environment-driven database selection:

- Default fallback: SQLite
- URL-based: `DATABASE_URL`
- Field-based: `DB_DIALECT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Optional TLS flags: `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`

SQLite remains the default for local development when DB settings are omitted.

1. Install the DB driver package:

```bash
# Postgres
npm install pg pg-hstore

# MySQL
npm install mysql2
```

2. Add production environment values (example):

```env
NODE_ENV=production
SERVE_UI=false
ALLOWED_ORIGINS=https://gateherald.internal

# Option A: single URL
DATABASE_URL=postgres://gateherald_user:strong_password@db.internal:5432/gateherald

# Option B: explicit fields
DB_DIALECT=postgres
DB_HOST=db.internal
DB_PORT=5432
DB_NAME=gateherald
DB_USER=gateherald_user
DB_PASSWORD=strong_password
DB_SSL=true
```

3. Run migrations against the target DB:

```bash
npm run db:migrate
```

4. Seed only when needed:

```bash
npm run db:seed
```

Important script note:

- `scripts/db-reset.js` now handles both SQLite and non-SQLite:
  - SQLite: deletes DB file when possible, otherwise drops tables in-place
  - Postgres/MySQL/etc: drops tables in-place, then reruns migrations and seeders
- Use this script carefully in production because it is destructive.

Internal-network security guidance for the database tier:

- Set `DB_HOST` (or `DATABASE_URL`) to a private/internal endpoint only (`db.internal`, VPC private IP, private DNS).
- Do not expose the DB listener directly to public internet.
- Restrict inbound DB access to app and migration hosts only (security groups/firewall allowlist).
- Keep TLS enabled (`DB_SSL=true`) when supported by your DB platform.

Recommended production DB practices:

- Use a managed DB service with backups, PITR, and monitoring.
- Use least-privilege DB users (separate app user and migration user if possible).
- Enforce TLS from app to DB.
- Store DB credentials in a secret manager, not in committed `.env` files.
