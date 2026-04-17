# Custom domains and wildcard DNS

One Vercel project serves every surface: the platform marketing site, master
admin, client portal, and every tenant marketing site. Middleware resolves
the request hostname to a tenant. This doc is the operator checklist for
making that work.

## One-time setup (platform domain)

1. Set `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_PLATFORM_DOMAIN` in the Vercel
   project env. For production this is `https://realos.dev` and `realos.dev`.
2. Attach the apex and `www.` in Vercel project settings → Domains.
3. Attach the wildcard `*.realos.dev` so every tenant slug falls back to a
   working subdomain during the DNS transition window.
   - DNS record on the apex: `CNAME` (or `ALIAS`) `@` → `cname.vercel-dns.com`.
   - Wildcard: `CNAME` `*` → `cname.vercel-dns.com`.

## Per-client custom domain (default path)

1. The client points their production hostname at Vercel.
   - Apex: `A @ 76.76.21.21`
   - Or `CNAME www cname.vercel-dns.com`
2. Agency operator calls `attachDomainToProject(hostname)` from
   `lib/build/domain-attach.ts` (or the admin tenant view wires this into a
   button, Sprint 04).
3. We poll `verifyDomain(hostname)` on a cron or in the admin UI until the
   domain returns verified. SSL issuance is automatic once DNS propagates.
4. A `DomainBinding` row with `hostname` + `isPrimary: true` links the Vercel
   domain back to the tenant's Organization. Middleware resolves hostname →
   org via this table.

## Fallback path, subdomain while DNS propagates

Every Organization has a unique `slug`. `{slug}.realos.dev` works
immediately because the wildcard is attached. Use this for staging previews
and the first-click-to-live moment before the client flips DNS.

## Removing a domain

1. Delete the `DomainBinding` row (or just flip `isPrimary=false`).
2. Call `removeDomainFromProject(hostname)` to release it in Vercel.
3. The next request against that hostname returns 404 from middleware.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Tenant site not configured` 404 | Hostname has no `DomainBinding` and no matching `Organization.slug` subdomain |
| Infinite redirect on a subdomain | Clerk sign-in callback URL points at a tenant hostname instead of the platform domain |
| SSL still pending after 30 min | DNS hasn't propagated from the registrar. Re-check the client's A/CNAME records |
| `verifyDomain` returns `misconfigured` | Client has an A record pointing at the wrong IP or is still on their old host |

## Required env

- `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, and optionally `VERCEL_TEAM_ID`
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PLATFORM_DOMAIN`
