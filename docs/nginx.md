# Nginx Config Notes

## OIDC Cutover Guidelines

Use these steps to switch from Basic Auth to OIDC without changing protected route definitions.

1. Keep location blocks unchanged and only swap the auth include target content:
   - From: `deploy/nginx/snippets/gateherald-admin-auth-basic.conf`
   - To: `deploy/nginx/snippets/gateherald-admin-auth-oidc.conf`
2. Enable `/oauth2/*` location on the internal UI host and route it to oauth2-proxy.
3. Configure oauth2-proxy with your IdP issuer URL, client ID/secret, redirect URL, and session cookie settings.
4. Keep external host restrictions in place (CIDR allowlist or stronger network controls). OIDC on internal host does not replace edge network restrictions.
5. Verify behavior:
   - Unauthenticated requests to `/ui/*` and admin APIs redirect to IdP.
   - Authenticated user can load UI and perform template/config CRUD.
   - `/webhook/*` remains publicly reachable.
   - Admin APIs are unreachable from non-internal networks.
6. Rotate/remove Basic Auth credentials (`/etc/nginx/.htpasswd-gateherald`) after successful cutover.

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
