# Gateherald

Gateherald is a webhook gateway that accepts inbound webhook events, transforms payloads with a template-driven mapper, and forwards results to one or more downstream endpoints.

[![Gateherald Docs](https://img.shields.io/badge/docs-github%20pages-0f766e)](https://tcurrent.github.io/gateherald/)

It includes:
- A backend API and webhook runtime (Express + Sequelize)
- A route configuration builder UI
- A template builder UI

## Quick Start

```bash
npm install
npm start
```

## Docs

- Live docs: https://tcurrent.github.io/gateherald/
- Docs source: `docs/`

See these primary guides:
- `docs/getting-started.md`
- `docs/api-reference.md`
- `docs/troubleshooting.md`
- `docs/deployment.md`

### Publish Docs To GitHub Pages

This repository includes a workflow at `.github/workflows/deploy-docs-pages.yml` that builds markdown files in `docs/` into a static site and deploys to GitHub Pages.

1. Push to `main`.
2. In GitHub repo settings, open Pages and set Source to GitHub Actions.
3. Your docs site will be published from the workflow artifact.

Local preview build:

```bash
npm run build:docs
```

Generated files are written to `.site/`.

## Core Commands

```bash
npm start          # NODE_ENV=development, loads .env.development
npm run start:prod # NODE_ENV=production, loads .env.production
npm run build:css  # build ui/dist/styles.css from ui/styles.css
npm run db:migrate # run migration scripts
npm run db:seed    # run migrations + seed scripts
npm run db:reset   # delete DB, then run migrations + seed scripts
```
