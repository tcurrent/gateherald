# Nginx, Auth & Hardening

## OIDC Cutover Guidelines

OIDC auth is handled by [oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/) running alongside nginx. The nginx OIDC snippet uses nginx's `auth_request` module to delegate every protected request to oauth2-proxy before serving it. If oauth2-proxy says the user is not authenticated, nginx redirects to the IdP login page. The user logs in on the IdP's own site (not on the app's login page) and is redirected back once authenticated.

Note: the app has a separate built-in `FRONTEND_AUTH_ENABLED` basic login flow. That is independent of OIDC. When using OIDC, leave `FRONTEND_AUTH_ENABLED=false` (the default); there is no need for both.

### 1) Activate The OIDC Auth Snippet

Copy the OIDC snippet over the active auth file:

```bash
cp deploy/nginx/snippets/gateherald-admin-auth-oidc.conf \
   deploy/nginx/snippets/gateherald-admin-auth.conf
```

All protected location blocks already include this file and require no changes. The snippet swaps `auth_basic` for `auth_request /oauth2/auth`, which routes every protected request through oauth2-proxy.

### 2) Uncomment The `/oauth2/` Location Block

In your nginx config (bare-metal: `deploy/nginx/gateherald.conf` or `gateherald-split-hosts.conf` internal host; Docker: `deploy/docker/nginx.conf`), uncomment the oauth2-proxy location:

```nginx
location ^~ /oauth2/ {
  proxy_pass http://127.0.0.1:4180;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Scheme $scheme;
}
```

### 3) Configure And Run oauth2-proxy

oauth2-proxy must be reachable at `127.0.0.1:4180` on the same host as nginx (or adjust the `proxy_pass` address to match). The `--upstream=static://202` flag means oauth2-proxy only performs auth. It does not proxy the traffic itself (nginx handles that).

Generic OIDC provider:

```bash
oauth2-proxy \
  --provider=oidc \
  --oidc-issuer-url=https://your-idp.example.com \
  --client-id=<client id> \
  --client-secret=<client secret> \
  --redirect-url=https://gateherald.internal/oauth2/callback \
  --email-domain=yourdomain.com \
  --cookie-secret=<32-byte random value> \
  --upstream=static://202 \
  --http-address=127.0.0.1:4180
```

Generate a cookie secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Microsoft Entra (Azure AD)

```bash
oauth2-proxy \
  --provider=oidc \
  --oidc-issuer-url=https://login.microsoftonline.com/<tenant-id>/v2.0 \
  --client-id=<app registration client id> \
  --client-secret=<app registration client secret> \
  --redirect-url=https://gateherald.internal/oauth2/callback \
  --email-domain=yourdomain.com \
  --cookie-secret=<32-byte random value> \
  --upstream=static://202 \
  --http-address=127.0.0.1:4180
```

Entra-specific setup:
- Create an app registration in Entra ID.
- Set the redirect URI to `https://gateherald.internal/oauth2/callback` under "Authentication".
- Generate a client secret under "Certificates & secrets".
- `--email-domain` restricts login to users from your org's domain. Set to `*` to allow any authenticated Entra user.
- To restrict access to a specific Entra group, add `--allowed-group=<group object ID>` and grant the app registration `GroupMember.Read.All` permission (or configure the token to include group claims).

### 4) Reload Nginx

```bash
# bare-metal
nginx -s reload

# Docker
docker compose restart frontend
```

### 5) Verify

- Unauthenticated requests to `/ui/*` and admin APIs should redirect to the IdP login page.
- Authenticated user can load the UI and perform template/config CRUD.
- `/webhook/*` remains publicly reachable without auth.
- Admin APIs are unreachable from non-internal networks.

### 6) Clean Up Basic Auth

Once verified, remove the htpasswd file:

```bash
rm deploy/nginx/.htpasswd-gateherald   # adjust path to your setup
```

### Notes On The OIDC Snippet

`deploy/nginx/snippets/gateherald-admin-auth-oidc.conf` forwards `X-Forwarded-User` and `X-Forwarded-Email` headers from oauth2-proxy to the upstream backend. The app does not currently consume these headers, but they will be present on proxied requests. Audit them before relying on them for any downstream logic.

Keep external host restrictions (CIDR allowlist or network controls) in place even after enabling OIDC. OIDC on the internal/frontend host does not replace edge network restrictions on the backend host.

## Recommended Post-Cutover Hardening

- Restrict OIDC access by IdP group/role.
- Use short session lifetimes and secure cookie flags.
- Keep HTTPS-only traffic between all tiers.
- Audit forwarded identity headers before relying on them downstream.

## Frontend Settings

Set backend API origin in `ui/env.js`:

```js
window.GATEHERALD_API_BASE_URL = 'https://api.gateherald.example.com';
```

Deploy the `ui/` directory to internal hosting.

## Network And Firewall Policy

Minimum rules:
1. Internal clients -> internal frontend host: allow TCP 443.
2. Internal frontend host -> external backend host: allow TCP 443.
3. External webhook providers -> backend host: allow TCP 443.
4. Backend host -> database: allow only required DB port.
5. Deny all other unnecessary inbound/outbound paths.

## TLS And Identity

- Enforce HTTPS everywhere.
- Use valid certificates on both frontend and backend hosts.
- Prefer SSO/OIDC in front of internal UI.
- Prefer short-lived tokens over long-lived static secrets.

## Operational Hardening Checklist

- Keep `ALLOWED_ORIGINS` minimal and environment-specific.
- Store secrets in environment/secret manager, not source control.
- Enable ingress/egress log retention and monitoring.
- Add rate limiting/WAF in front of public backend where possible.
- Regularly patch host OS and Node dependencies.
