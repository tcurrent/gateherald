# UI Guide

## Signing In

The sign-in page only appears when `FRONTEND_AUTH_ENABLED=true` is set on the backend. If your deployment uses nginx-level auth (Basic Auth or OIDC) instead, you will not see it; access is handled before the page loads.

When the sign-in page is shown:

1. Navigate to `/ui/config-builder` (or any `/ui/*` path). You will be redirected to `/auth/login` if you are not already authenticated.
2. Enter the username and password set in `FRONTEND_AUTH_USERNAME` and `FRONTEND_AUTH_PASSWORD`.
3. Click **Sign In**. On success you are redirected to the original destination. On failure the page shows "Invalid credentials. Try again."

To sign out, click the **Logout** button in the top navigation bar. This clears the session cookie.

---

## Template Builder

Templates are the egress payload blueprints. Every route config references exactly one template. You must create at least one template before you can build a route config.

Navigate to **Templates** in the top nav.

### Creating A Template

1. Click **New Template** to clear the form.

2. **Template Name** (required): a unique name used to reference the template from route configs. Example: `pagerduty-alert`.

3. **Needs Documentation Rules**: set to `true` if this template has a field that should be populated with a documentation URL at runtime. When set to `true`, a **Documentation Target Field** input appears. Defaults to `false`.

4. **Documentation Target Field**: visible only when Needs Documentation Rules is `true`. Enter the name of the field in the template that will receive the resolved documentation URL. This must match a key in the fields JSON. Example: `alertDocumentation`.

5. **Template Fields (JSON Object)** (required): a JSON object where each key is a field name and each value is the default value for that field. Keys become the editable fields that the config builder will let you map ingress data into.

   Example:
   ```json
   {
     "alertTitle": "",
     "alertSummary": "",
     "alertDocumentation": ""
   }
   ```

   - Every key you define here appears as a mappable field in the config builder.
   - Values are the defaults; if a route config provides no mapping for a field, this value is used.

6. Click **Save Template**.

### Editing A Template

Select a template from the **Saved Templates** dropdown and click **Load Template**. Make changes and click **Save Template**. The page will warn you if you try to navigate away with unsaved changes.

### Deleting A Template

Load the template, then click **Delete Template**. This is permanent. Route configs referencing a deleted template will fail validation on the next app restart.

---

## Config Builder

Route configs define how an inbound webhook gets transformed and forwarded. Navigate to **Route Configuration** in the top nav.

### Route Settings

**Route Name** (required): a human-readable identifier for this route. Used as part of the generated webhook path. Example: `github-to-pagerduty`.

**Method**: the HTTP method the route accepts. Defaults to `POST`. Options: `POST`, `PUT`, `PATCH`.

**Route Path**: read-only. Auto-generated as `/webhook/{routeName}/{ULID}`. The ULID makes the path effectively unguessable. Click **Generate New Route ULID** to regenerate the random suffix if needed.

**Enabled**: when unchecked the route exists in the database but the app will not route incoming requests to it.

**Outbound Headers**: headers added to every forwarded request. Each row has:
- **Header name**: the HTTP header name, e.g. `X-API-KEY`.
- **Value type**: `Environment Variable` or `Literal`.
  - `Environment Variable`: enter just the variable name, e.g. `API_TOKEN`. The app resolves it to `process.env.API_TOKEN` at runtime. Use this for secrets so they are never stored in the database.
  - `Literal`: the exact string is stored and sent as-is.

**Target URL(s)** (required): one or more URLs the transformed payload is forwarded to. Add multiple targets to fan out a single inbound webhook to several endpoints.

### Template Selection

Select the template that defines the egress payload structure for this route. Once selected, the **Field Discovery** and **Field Mapping** panels appear. The status line shows the editable fields the template exposes.

### Field Discovery

Paste a sample JSON payload from your webhook provider and click **Extract Fields From Sample**. The builder flattens every leaf path in the payload — including nested objects and array items — and stores them as autocomplete suggestions for the mapping step.

You do not need to extract fields before mapping. It just makes it easier to avoid typos when referencing nested paths.

### Field Mapping

One row appears per editable field in the selected template. Each row shows the target field name and a mapping expression input.

**How expressions work:**

- `$path.to.field`: resolves the value at that dot-separated path in the inbound payload. `$event.title` looks up `payload.event.title`.
- Array indexing uses bracket notation: `$items[0].name`.
- Everything not preceded by `$` is literal text. `Alert: $event.title` → `Alert: Server Down`.
- Multiple tokens and literals can be mixed: `$service.name ($event.severity)` → `Payments Service (critical)`.
- To include a literal dollar sign, write `$$`.
- If a `$path` reference does not resolve (key missing or null in the payload), that path contributes nothing to the output. If the entire expression resolves to nothing, the template default value is used.

**Autocomplete:** type `$` and the builder shows matching paths from the extracted sample. Use arrow keys to navigate, `Enter` or `Tab` to accept, `Escape` to dismiss.

**Preview:** below each input, a rendered preview shows path references as highlighted tokens and literal text as plain text.

**Clear:** removes the mapping for that field, reverting it to the template default at runtime.

### Documentation Rules

This panel only appears when the selected template has **Needs Documentation Rules** set to `true`.

Documentation rules automatically populate the template's documentation target field with a URL based on the resolved value of another field. This is useful for linking alert routes to the relevant runbook or wiki page.

Each rule has three fields:

- **Field to match**: the template field whose resolved value is inspected.
- **Match value**: a case-insensitive substring to look for in that field's resolved value.
- **Documentation URL**: the URL written into the documentation target field when the match is found.

Rules are evaluated in order. The first match wins. If no rule matches, the documentation target field uses its template default.

**Example:** field to match = `alertTitle`, match value = `Server Down`, URL = `https://wiki.example.com/runbooks/server-down`. Any webhook whose `alertTitle` mapping resolves to a string containing "server down" will have that URL written into the documentation target field of the egress payload.

Click **Add Documentation Rule** to add a row. Click **Remove** to delete a row.

### Saving A Config

Click **Save Current Config** to persist the route to the database. The app picks up the new config immediately without a restart.

To preview the raw JSON before saving, click **Generate Config JSON**.

### Loading And Editing An Existing Config

Select a config from the **Config Records** dropdown (shown as `{path} [{method}]`) and click **Load Config**. Edit as needed and click **Save Current Config**.

### Deleting A Config

Load the config and click **Delete Selected Config**. The route stops accepting webhooks immediately.
