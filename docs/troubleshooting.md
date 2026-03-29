# Troubleshooting

This guide covers common issues and solutions for Gateherald development and production deployments.

## Common Issues

- [Startup Issues](#startup-issues)
- [Database Issues](#database-issues)
- [Authentication & Security](#authentication--security)
- [Webhook & Transformation](#webhook--transformation)
- [Forwarding & Performance](#forwarding--performance)
- [UI & Configuration](#ui--configuration)
- [Deployment](#deployment)

---

## Startup Issues

### App Won't Start: "FRONTEND_ONLY_API enabled but ADMIN_PROXY_SHARED_SECRET is blank"

**Problem**: Server fails to start with validation error when `FRONTEND_ONLY_API=true` but no proxy secret is configured.

**Root Cause**: When the frontend-only API mode is enabled, all direct API requests must be authenticated via a proxy header. Without a shared secret, there's no way to validate these headers.

**Solution**:
1. **If using a reverse proxy**: Set `ADMIN_PROXY_SHARED_SECRET` to a strong random value in `.env.production`:
   ```
   FRONTEND_ONLY_API=true
   ADMIN_PROXY_SHARED_SECRET=your-long-random-secret-here
   ```
   The proxy must inject the `X-Gateherald-Proxy-Secret` header with this exact value.

2. **If not using a proxy**: Disable frontend-only mode:
   ```
   FRONTEND_ONLY_API=false
   ADMIN_API_TOKEN=your-static-token-for-direct-api-clients
   ```

3. **For local development**: Use the `.env.development` defaults (frontend-only disabled).

---

### App Won't Start: Routes validation failed

**Problem**: Server fails to start with "'TemplateDriver' validation failed" or similar template/route errors.

**Root Cause**: A route config references a template or field mapping that doesn't exist or is invalid. This is caught at startup to prevent silently broken routes.

**Solution**:
1. Check the specific validation error message in the console output.
2. Access the app database (SQLite):
   ```bash
   sqlite3 gateherald.db
   SELECT id, name, template_id FROM route_configs;
   SELECT id, name FROM templates;
   ```
3. For each route, verify:
   - The referenced `template_id` exists in the templates table
   - Field mappings reference actual template fields
4. Use the browser UI (`/ui/config-builder`) to update or delete invalid routes.
5. Restart the app.

---

### Port Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
1. Check what's using the port:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # Linux/macOS
   lsof -i :3000
   kill -9 <PID>
   ```

2. Or change the port in `.env.development`:
   ```
   PORT=3001
   ```

---

### Missing Environment Variables

**Problem**: Warnings or errors about undefined environment variables.

**Root Cause**: `.env.development` or `.env.production` file is missing or incomplete.

**Solution**:
1. Ensure the correct `.env` file exists:
   ```bash
   # For development
   ls .env.development
   
   # For production
   ls .env.production
   ```

2. If missing, copy the template from `.env.development` and update for your environment.

3. Essential variables for all environments:
   ```bash
   NODE_ENV=development        # or production
   PORT=3000
   SERVE_UI=true
   ```

4. If using frontend UI, also set:
   ```bash
   FRONTEND_AUTH_ENABLED=true
   FRONTEND_AUTH_USERNAME=gateadmin
   FRONTEND_AUTH_PASSWORD=strong-password-here
   FRONTEND_AUTH_SESSION_SECRET=long-random-string
   ```

---

## Database Issues

### Database Migration Failed

**Problem**: `npm run db:migrate` fails with SQL errors.

**Root Cause**: Database schema is corrupted, or you're trying to migrate a database created by a different version of Gateherald.

**Solution**:

**For development (data loss is OK)**:
```bash
# Reset the database completely
npm run db:reset

# Re-run migrations
npm run db:migrate

# Seed sample data
npm run db:seed
```

**For production (preserve data)**:
1. Backup your database:
   ```bash
   cp gateherald.db gateherald.db.backup
   ```

2. Review the migration file in `migrations/` to understand what's failing.

3. If the migration has a bug, fix it in the migration file and re-run:
   ```bash
   npm run db:migrate
   ```

4. If the database schema is too corrupted, consider:
   - Restoring from a recent backup
   - Using `sqlite3` CLI to inspect and fix schema manually
   - Contact maintainers if the issue persists

---

### Accidentally Ran `npm run db:reset` in Production

**Problem**: All data (routes, templates, logs) has been deleted.

**Severity**: **CRITICAL** - Data loss has occurred.

**Recovery**:
1. **Immediately stop the application** to prevent further writes.
2. Restore from your most recent backup:
   ```bash
   cp gateherald.db.backup gateherald.db
   ```
3. Verify data is intact by checking row counts in SQLite.
4. Restart the application.

**Prevention**:
- Run `db:reset` NEVER in production.
- Use a CI/CD pipeline that prevents running destructive commands on production databases.
- Require manual database migrations with review steps.
- Keep automated backups (e.g., nightly).

---

### Database File Missing or Corrupted

**Problem**: `Error: SQLITE_CANTOPEN` or file not found errors.

**Solution**:
1. Check that `gateherald.db` exists in the project root:
   ```bash
   ls -la gateherald.db
   ```

2. If missing and you have a backup:
   ```bash
   cp gateherald.db.backup gateherald.db
   npm start
   ```

3. If missing and no backup, create a fresh database:
   ```bash
   rm gateherald.db  # if corrupted
   npm run db:migrate
   npm run db:seed
   ```

4. If the file exists but is corrupted:
   ```bash
   # Verify SQLite can read it
   sqlite3 gateherald.db "SELECT COUNT(*) FROM sqlite_master;"
   
   # If it returns the Gateherald schema count, it's readable
   # If it fails, restore from backup or rebuild
   ```

---

## Authentication & Security

### Locked Out of Frontend UI

**Problem**: Can't log in to `/ui` even with correct credentials.

**Root Cause**: Session secret is not set, or credentials don't match the environment variables.

**Solution**:
1. **Check environment variables match**:
   ```bash
   # In your .env file, verify:
   FRONTEND_AUTH_USERNAME=gateadmin
   FRONTEND_AUTH_PASSWORD=dev-password-please-change
   FRONTEND_AUTH_SESSION_SECRET=dev-session-secret-please-change-this-to-a-long-random-string
   ```

2. **If you forgot your password**: Update it in `.env.development` (for dev only!):
   ```bash
   FRONTEND_AUTH_PASSWORD=new-password-here
   npm start  # Restart to reload .env
   ```

3. **For production**: If you've lost credentials, use SQLite CLI to check or reset via database manipulation (requires careful handling).

4. **If session tokens keep expiring**: Increase TTL in `.env`:
   ```bash
   FRONTEND_AUTH_SESSION_TTL_MINUTES=1440  # 24 hours instead of default 8
   ```

5. **If getting 403 Forbidden on UI routes**: Check that `SERVE_UI=true` and frontend auth is properly configured.

---

### API Request Returns 403 Unauthorized

**Problem**: API calls to `/api/*` return 403 even with correct authentication.

**Possible Causes**:

1. **Missing or invalid ADMIN_API_TOKEN**:
   - If using token-based auth, set `ADMIN_API_TOKEN` in `.env`.
   - Send it as: `Authorization: Bearer <ADMIN_API_TOKEN>`

2. **FRONTEND_ONLY_API enabled without proxy**:
   - If `FRONTEND_ONLY_API=true`, all API requests must include `X-Gateherald-Proxy-Secret` header.
   - This is for proxied requests only; direct API clients need `ADMIN_API_TOKEN`.

3. **Request not authenticated at all**:
   ```bash
   # Wrong: no auth
   curl http://localhost:3000/api/templates
   
   # Correct: with token
   curl -H "Authorization: Bearer dev-api-token-12345" \
     http://localhost:3000/api/templates
   ```

**Solution**:
1. Check which auth mode you're in:
   ```bash
   echo $FRONTEND_ONLY_API
   echo $ADMIN_API_TOKEN
   ```

2. For **frontend-only mode** (proxied requests):
   - Verify the proxy injects `X-Gateherald-Proxy-Secret` header correctly.
   - Test locally by temporarily disabling frontend-only mode.

3. For **direct API access** (development):
   ```bash
   # Ensure token is set
   export ADMIN_API_TOKEN="dev-api-token-12345"
   npm start
   
   # Then use it
   curl -H "Authorization: Bearer dev-api-token-12345" \
     http://localhost:3000/api/templates
   ```

---

## Webhook & Transformation

### Webhook Received But No Egress Log Entry

**Problem**: Webhook was accepted (200 response) but data wasn't forwarded.

**Root Cause**: Forwarding happens asynchronously. Check if the route is valid and targets are reachable.

**Solution**:
1. **Verify ingress was logged**:
   ```bash
   sqlite3 gateherald.db "SELECT * FROM ingresses ORDER BY created_at DESC LIMIT 5;"
   ```
   If no entry, the webhook route may not exist.

2. **Check egress logs**:
   ```bash
   sqlite3 gateherald.db "SELECT * FROM egresses ORDER BY created_at DESC LIMIT 5;"
   ```
   Look for failures with the same webhook path.

3. **Check console output** for transformation errors:
   ```
   Error transforming TemplateDriver payload: ...
   ```

4. **Verify the route exists** and is configured:
   ```bash
   sqlite3 gateherald.db "SELECT id, name, template_id, target_url FROM route_configs WHERE name='your-route-name';"
   ```

5. **Verify the target URL is reachable**:
   ```bash
   curl -v https://your-target-endpoint/webhook
   ```
   If it times out or returns 5xx, fix the target before retesting.

---

### Transformation Returned Null

**Problem**: Webhook data was received and logged, but egress shows null payload.

**Root Cause**: The TemplateDriver transformation encountered an error (JSON parse error, missing template, invalid field mapping) and returned null without propagating the error.

**Solution**:
1. **Check the console for transformation error**:
   ```
   Error transforming TemplateDriver payload: Invalid JSON in template
   ```

2. **Inspect the ingress payload** to see what was received:
   ```bash
   sqlite3 gateherald.db "SELECT * FROM ingresses ORDER BY created_at DESC LIMIT 1;" 
   ```

3. **Test the template mapping manually**:
   - Open `/ui/template-builder`
   - Select the template used by this route
   - Paste in the sampled ingress payload
   - Check what fields are resolved

4. **Common causes**:
   - Template references a field that doesn't exist in the payload (e.g., `payload.user.email` when user is null)
   - Documentation rule validation failed (field marked as required but empty in payload)
   - Invalid JSONPath or field mapping syntax

5. **Fix the template** via the UI or by reviewing field mappings, then resend the webhook.

---

### Template Field Mapping Not Working

**Problem**: Changed template field mappings, but old data still appears in egress.

**Root Cause**: Route config is cached; you need to restart the application or reload the route.

**Solution**:
1. **Template changes take effect immediately** on new webhooks. If old data persists:
   - Check you modified the correct template.
   - Check the route references the correct template.

2. **If it still doesn't work**, restart the app:
   ```bash
   npm start
   ```

3. **Check the template UI**:
   - Open `/ui/template-builder`
   - Select your template
   - Verify field mappings are correct
   - Test with a sample payload

---

### Documentation Rule Validation Error on Webhook

**Problem**: Webhook is rejected or returns null; error mentions "documentation rule" or "required field."

**Root Cause**: One or more template fields are marked as required (documentation rule) but the inbound webhook doesn't include data for that field.

**Solution**:
1. **Review the documentation rule in the template**:
   - Open `/ui/template-builder`
   - Select the template
   - Look for fields marked with documentation rules
   - Check if they're marked as required

2. **Either update the template** (relax the requirement):
   - Remove the documentation rule
   - Or make the field optional (uncheck required)

   **Or update your webhook sender** to include the required fields.

3. **Test the mapping** with a complete payload that includes all required fields.

---

## Forwarding & Performance

### Forward Queue Getting Large (Growing Unbounded)

**Problem**: Console warns: "Forward queue depth is 250; consider increasing FORWARD_MAX_CONCURRENT"

**Root Cause**: Target endpoints are too slow or unresponsive. Webhooks are piling up waiting to be forwarded.

**Solution**:

1. **Increase concurrent forwards** (temporary fix):
   ```bash
   export FORWARD_MAX_CONCURRENT=50
   npm start
   ```
   Add to `.env.production`:
   ```
   FORWARD_MAX_CONCURRENT=50
   ```

2. **Increase request timeout** if slow endpoints need longer:
   ```bash
   export FORWARD_REQUEST_TIMEOUT_MS=30000  # 30 seconds
   npm start
   ```

3. **Fix the root cause** (recommended):
   - Check if target endpoint is responding:
     ```bash
     curl -v https://your-target/webhook
     ```
   - Increase timeout on the target side (database, API calls, etc.)
   - Add more workers/replicas to the target service
   - Check network connectivity

4. **Monitor the queue**:
   ```bash
   sqlite3 gateherald.db "SELECT COUNT(*) FROM egresses WHERE status='pending';"
   ```
   Once targets are fixed, queue should drain.

---

### Webhook Forwarding Fails Silently (404, Timeout)

**Problem**: Egress entry shows failure status, but you don't know why.

**Solution**:
1. **Check the egress log for error details**:
   ```bash
   sqlite3 gateherald.db \
     "SELECT id, route_config_id, response_status, response_body FROM egresses \
      WHERE status='failed' ORDER BY created_at DESC LIMIT 1;"
   ```

2. **Common HTTP errors**:
   - **404**: Target endpoint URL is wrong or changed. Verify in route config.
   - **500**: Target service is throwing errors. Check its logs.
   - **Connection timeout**: Network is down or firewall blocking. Check connectivity.

3. **Test the target manually**:
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"test": "data"}' \
     https://your-target-url
   ```

4. **Update the route** if URL is wrong via `/ui/config-builder`.

---

## UI & Configuration

### UI Not Loading (404 on /ui)

**Problem**: Navigating to `/ui` returns 404.

**Root Cause**: `SERVE_UI=false` or UI files are missing.

**Solution**:
1. **Check if UI serving is enabled**:
   ```bash
   echo $SERVE_UI  # Should be 'true'
   ```

2. **Enable it in `.env`**:
   ```
   SERVE_UI=true
   npm start
   ```

3. **Check UI files exist**:
   ```bash
   ls ui/
   ```

4. **If missing**, restore from git:
   ```bash
   git restore ui/
   npm run build:css  # Rebuild CSS
   ```

---

### Config Builder Won't Save Route

**Problem**: Submit button in `/ui/config-builder` doesn't work or returns an error.

**Possible Causes**:

1. **Validation error** (shown in UI as red text):
   - Template doesn't exist
   - Target URL is invalid
   - Required fields are empty
   - Field mappings reference non-existent template fields

2. **API authentication failed**:
   - Session expired; log out and log back in
   - Or check server logs for auth errors

3. **Database error**:
   - Check console output for SQL errors
   - Verify database file is writable

**Solution**:
1. Check error message displayed in the UI.
2. For validation errors, fix the values and retry.
3. For auth errors, refresh the page and log in again.
4. For database errors, check file permissions:
   ```bash
   ls -la gateherald.db
   chmod 644 gateherald.db  # Ensure readable/writable
   npm start
   ```

---

### New Routes Don't Work After Save

**Problem**: Created a new route in the UI, but webhooks to it return 404.

**Root Cause**: Route is in the database but not loaded in memory. App caches routes at startup.

**Solution**:
1. **Routes are reloaded from the database periodically**, but:
   - If your app loads routes once at startup and caches them, you must **restart**:
     ```bash
     # Stop the app and start it again
     npm start
     ```

2. **Or** implement hot-reloading:
   - Check if `/admin/reload-routes` endpoint exists.
   - If not, restart is the only way.

---

### Template Changes Don't Take Effect

**Problem**: Modified a template in the UI, but old transformations still happen.

**Root Cause**: Same as routes - templates may be cached.

**Solution**:
1. **Restart the app** to reload all templates:
   ```bash
   npm start
   ```

2. **Verify the template was saved**:
   - Open `/ui/template-builder`
   - Select the template
   - Check that changes are visible

3. **Test a fresh webhook** to the route using this template. Transformation should reflect the new mappings.

---

## Deployment

### Production App Crashes After Deploy

**Problem**: Deployed new version; app won't start or crashes after a few requests.

**Root Cause**: 
- Database schema mismatch with new code
- Missing environment variables
- Corrupted database

**Solution**:
1. **Check logs**:
   ```bash
   journalctl -u gateherald -n 50 -p err
   ```

2. **If migration error**: Run migrations:
   ```bash
   npm run db:migrate
   npm start
   ```

3. **If missing env vars**: Verify `.env.production` is complete:
   ```bash
   cat .env.production
   ```

4. **If database corrupted**: Restore from backup and retry.

---

### CPU/Memory Usage High

**Problem**: Server is consuming excessive resources.

**Possible Causes**:
1. **Forward queue is too large** (see [Forward Queue Getting Large](#forward-queue-getting-large-growing-unbounded))
2. **Many old logs accumulating** in the database
3. **Route or template has infinite loop** (rare, but check validation)

**Solution**:
1. **Clean up old logs** (sample every hour from past retention period):
   ```bash
   sqlite3 gateherald.db \
     "DELETE FROM ingresses WHERE created_at < datetime('now', '-30 days');"
   VACUUM;  # Reclaim space
   ```

2. **Check database size**:
   ```bash
   ls -lh gateherald.db
   ```

3. **Monitor queue depth**:
   ```bash
   watch -n5 'sqlite3 gateherald.db "SELECT status, COUNT(*) FROM egresses GROUP BY status;"'
   ```

4. **Increase timeouts** if processing is slow but normal:
   ```bash
   FORWARD_REQUEST_TIMEOUT_MS=30000
   FORWARD_MAX_CONCURRENT=50
   ```

---

### Migrating to Production Database

**Problem**: Need to move from SQLite to PostgreSQL or MySQL in production.

**Solution**:
1. This is a major migration. Currently Gateherald uses Sequelize with SQLite.
2. To switch databases:
   - Change Sequelize config in `models/db-config.js`
   - Create migrations for the new database
   - Export data from SQLite
   - Import into the new database
   - Test thoroughly in staging first

3. **Recommended approach**:
   - Keep SQLite for small deployments or local dev
   - For production at scale, plan this migration carefully with the maintainers

---

### SSL/TLS Certificate Errors

**Problem**: HTTPS requests to webhooks fail with certificate errors.

**Root Cause**: Self-signed certificates, expired certificates, or certificate chain issues.

**Solution**:
1. **For self-signed certificates in development**:
   ```bash
   # Accept self-signed certs (not for production!)
   NODE_TLS_REJECT_UNAUTHORIZED=0 npm start
   ```

2. **For production**:
   - Ensure target endpoints have valid, trusted certificates
   - Or configure the app to use a corporate CA bundle (rarely needed)

3. **Check certificate validity**:
   ```bash
   openssl s_client -connect your-target.com:443
   ```

---

## Quick Reference: Common Commands

```bash
# Development
npm install
npm start
npm run build:css

# Database maintenance
npm run db:migrate       # Safe: run pending migrations
npm run db:seed          # Add sample data
npm run db:reset         # DANGEROUS: wipe & recreate (dev only!)

# Debugging
sqlite3 gateherald.db "SELECT COUNT(*) FROM ingresses;"
sqlite3 gateherald.db "SELECT * FROM route_configs;"
sqlite3 gateherald.db "SELECT * FROM templates;"

# Environment checks
echo $NODE_ENV
echo $FRONTEND_AUTH_ENABLED
echo $FORWARD_MAX_CONCURRENT
```

---

## Getting Help

If your issue isn't covered here:
1. Check the server console output for error messages.
2. Review the specific error in the database:
   ```bash
   sqlite3 gateherald.db "SELECT * FROM ingresses WHERE created_at > datetime('now', '-5 minutes');"
   ```
3. Test endpoints manually with `curl`.
4. Review the code in `logic/` and `models/` for the specific feature.
5. Open an issue with logs, `.env` values (redacted), and steps to reproduce.
