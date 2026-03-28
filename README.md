# Gateherald

Gateherald is a webhook gateway that receives inbound events, transforms payloads through a template-driven mapper, and forwards to one or more target endpoints. 

## Documentation

- [Gateherald Docs](https://tcurrent.github.io/gateherald/)
- Source: `docs/`

## Quick Start

```bash
npm install
npm start
```

## Core Commands

```bash
npm start          # NODE_ENV=development, loads .env.development
npm run start:prod # NODE_ENV=production, loads .env.production
npm run build:css  # build ui/dist/styles.css from ui/styles.css
npm run db:migrate # run migration scripts
npm run db:seed    # run migrations + seed scripts
npm run db:reset   # delete DB, then run migrations + seed scripts
```
