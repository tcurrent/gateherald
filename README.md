# Gateherald

Gateherald is a webhook gateway that receives inbound events, transforms payloads through a template-driven mapper, and forwards to one or more target endpoints. 

## Documentation

- [Gateherald Docs](https://tcurrent.github.io/gateherald/)
- Source: `docs/`

## Quick Start

```bash
npm install
copy .env.development.example .env.development
npm start
```

`.env.development` is ignored by git. Keep real secrets there and commit only the example files.

## Core Commands

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

## License

Licensed under the MIT License. See `LICENSE`.
