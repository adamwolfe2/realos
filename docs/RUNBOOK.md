# Production runbook

Operator and on-call reference for RealEstaite. The agency-side app at
`https://realos-nine.vercel.app` (production alias of the `realestaite`
Vercel project under team `am-collective`).

## Health and quick-look links

| What | URL |
|------|-----|
| Live operator app | https://realos-nine.vercel.app |
| Health (system check) | https://realos-nine.vercel.app/api/health |
| Health (deep, includes DB queries) | https://realos-nine.vercel.app/api/health/deep |
| System dashboard (agency-only) | https://realos-nine.vercel.app/admin/system |
| Audit log | https://realos-nine.vercel.app/admin/audit-log |
| Tenants + domains | https://realos-nine.vercel.app/admin/tenants |
| Vercel deployments | `vercel ls --scope team_jNDVLuWxahtHSJVrGdHLOorp` |
| Neon Postgres console | https://console.neon.tech |
| Clerk dashboard | https://dashboard.clerk.com |
| Sentry | (DSN in `SENTRY_DSN` env var) |

`/api/health` returns 200 when overall status is `ok`, 503 when `down`. Use it
for any external uptime monitor (Better Uptime, UptimeRobot, etc.). The
deep variant runs a real `SELECT count(*) FROM "Organization"` so it also
catches stale-connection issues.

## When something breaks

### Deploys are not landing

Symptom: pushing to `main` doesn't change the live deployment.

1. `vercel ls --scope team_jNDVLuWxahtHSJVrGdHLOorp` — check status of the
   most recent deployment.
2. If status is `Error`, click into the URL with `vercel inspect` to read the
   build logs.
3. Common cause: a `vercel.json` cron path that doesn't resolve to a built
   route. Vercel rejects deploys with broken cron paths.
4. Local repro: `pnpm build`. If green locally but red on Vercel, the
   difference is usually env vars — check `vercel env ls` and compare to
   `.env.local`.

### Cursive webhook events not landing

Symptom: pixel events fire but `/portal/visitors` shows nothing new for a
tenant.

1. `/admin/clients/{id}` Cursive panel: confirm the V4 pixel ID is bound to
   this tenant. Without it the webhook handler can't route the event.
2. Check the tenant's **Webhook URL** field in Cursive matches
   `https://realos-nine.vercel.app/api/webhooks/cursive`.
3. Check Cursive's webhook auth header value matches the
   `CURSIVE_WEBHOOK_SECRET` env var. Default header is
   `x-audiencelab-secret`.
4. If those are right, look at the `WebhookEvent` table:
   `SELECT * FROM "WebhookEvent" WHERE source='cursive' ORDER BY "receivedAt" DESC LIMIT 20;`
   - `status=processed` rows mean the webhook landed and parsed cleanly.
   - `status=failed` rows mean processing failed; `processingError` has the
     reason; the `webhook-retry` cron will replay them.
   - `status=abandoned` means we gave up after 5 retries — investigate
     `processingError` and decide whether to fix forward or delete.

### Database is degraded

Symptom: `/api/health` reports `database.status=degraded` or `down`.

1. Check Neon console for compute status. The serverless plan auto-scales
   down to zero; first request after idle may be slow.
2. `SELECT 1` from psql to verify connectivity.
3. If wedged, restart the Neon compute from the console.
4. Pooler vs direct: app uses the pooler (`?...&channel_binding=require`).
   Migrations should use `DIRECT_DATABASE_URL` — verify both are set.

### Impersonation drops the agency user back to /admin

Symptom: clicking Impersonate on a client detail page lands you back at
`/admin` instead of `/portal`.

Root cause: Clerk's default JWT does NOT include `publicMetadata`. The
`getScope()` helper in `lib/tenancy/scope.ts` falls back to a server-side
`clerkClient.users.getUser()` lookup for agency users specifically to fix
this — confirm the fallback is in place. If still failing:

1. Check Clerk audit log for the user's metadata write — should show
   `impersonateOrgId` set.
2. Hard-reload `/portal` (the impersonate button uses `window.location.href`
   for this exact reason).
3. Stuck in impersonation? `clerkClient.users.updateUserMetadata` to clear
   `publicMetadata.impersonateOrgId`, or use `/api/admin/impersonate/end`.

### Cron job stopped running

Symptom: `/admin/system` shows a cron with no recent CronRun row.

1. Check `vercel.json` cron schedule for that job — Vercel only fires what's
   declared there.
2. Hit the route manually with the bearer token to force a run:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://realos-nine.vercel.app/api/cron/{name}`
3. Check the response and the resulting `CronRun` row.

## Environment variables

Authoritative list lives in `docs/ENV_VARS.md`. Critical ones for
production:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Neon pooler connection string |
| `DIRECT_DATABASE_URL` | Neon direct connection (for migrations) |
| `CLERK_SECRET_KEY` | Clerk backend |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend |
| `ANTHROPIC_API_KEY` | Chatbot Claude calls |
| `CURSIVE_API_KEY` | Pull from AudienceLab segments |
| `CURSIVE_WEBHOOK_SECRET` | Auth for inbound Cursive webhooks |
| `ENCRYPTION_KEY` | AES-256-GCM key for encrypting tenant credentials at rest |
| `VERCEL_API_TOKEN` | Custom-domain provisioning |
| `VERCEL_PROJECT_ID` | The project that serves tenant sites |
| `CRON_SECRET` | Bearer auth for cron handlers |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Error reporting |
| `RESEND_API_KEY` (optional, dormant) | Transactional email |
| `STRIPE_SECRET_KEY` (optional, dormant) | Subscriptions |

OAuth-related vars (dormant until production domain is set):
`OAUTH_ENABLED`, `OAUTH_CALLBACK_BASE_URL`, `OAUTH_STATE_SECRET`,
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`META_OAUTH_APP_ID`, `META_OAUTH_APP_SECRET`.

## Database migrations

We don't use `prisma migrate deploy` against prod (Neon-friendly
constraints). Instead manual SQL files live in `prisma/migrations_pending/`.
To apply:

```sh
set -a; source .env.local; set +a
psql "$DATABASE_URL" -f prisma/migrations_pending/<file>.sql
```

All shipped migrations are idempotent (`IF NOT EXISTS`). Re-running is
safe. After applying:

```sh
pnpm prisma generate
```

Update `prisma/schema.prisma` to match what was applied so the Prisma
client stays in sync.

## Rollback

Vercel keeps every production deployment. To revert to a previous one:

1. `vercel ls` to find the deployment URL of the known-good build
2. `vercel promote <url>` to point the production alias at that build

This does NOT roll back the database. If a migration broke prod, you'll
need to write a forward-fix migration (don't try to drop applied changes
unless you're certain no rows depend on them).

## Deploy checklist

Before merging anything that touches:

- [ ] `prisma/schema.prisma` — write a manual idempotent SQL file; apply
      with `psql` before merging the PR
- [ ] `vercel.json` — verify every cron path resolves to a built route
      (`pnpm build` and check the route list)
- [ ] `middleware.ts` — test `/admin`, `/portal`, `/api/public/*`,
      `/api/webhooks/*`, and a tenant subdomain locally
- [ ] `lib/tenancy/scope.ts` — every change here can break impersonation
      or tenant isolation; test agency + operator + impersonating-agency
      sessions
- [ ] New env vars — set them in Vercel before deploying

## On-call escalation

For now: it's just Adam. When the platform grows:

1. PagerDuty / Opsgenie integration with Sentry alerts on `unhandledException`
2. Slack channel `#realestaite-incidents` with webhook for `/admin/system`
   degraded-status changes
3. Status page at `status.realestaite.co` powered by `/api/health`

## Rate limits

All limits use Upstash Redis sliding-window via `/lib/rate-limit.ts`. When Redis is not configured (env vars absent) all limiters soft-fail open and log a warning — no requests are blocked. Every rejection returns HTTP 429 with `{ error, retryAfterSec }` and a `Retry-After` header.

| Route | Limiter | Limit | Window | Key |
|-------|---------|-------|--------|-----|
| `POST /api/public/leads` | `publicSignupLimiter` | 5 | 1 h | IP |
| `POST /api/public/tours` | `publicSignupLimiter` | 5 | 1 h | IP |
| `POST /api/public/chatbot/chat` | `publicApiLimiter` | 60 | 1 m | IP |
| `GET  /api/public/chatbot/inbox` | `publicApiLimiter` | 60 | 1 m | `inbox:<IP>` |
| `POST /api/public/chatbot/lead` | `publicApiLimiter` | 60 | 1 m | IP |
| `GET  /api/public/chatbot/config` | `chatbotConfigLimiter` | 30 | 1 m | `cfg:<IP>` |
| `POST /api/public/visitors/track` | `publicApiLimiter` | 60 | 1 m | `pixel:<key>:<IP>` |
| `GET  /api/public/pixel/[key]` | `pixelAssetLimiter` | 120 | 1 m | `pixel-asset:<IP>` |
| `POST /api/onboarding` | `publicSignupLimiter` | 5 | 1 h | IP |
| `POST /api/subscribe` | `publicSignupLimiter` | 5 | 1 h | IP |
| `POST /api/webhooks/cursive` | `webhookLimiter` | 1000 | 1 m | `wh-cursive:<IP>` |
| `POST /api/webhooks/clerk` | `webhookLimiter` | 1000 | 1 m | `wh-clerk:<IP>` |
| `POST /api/webhooks/stripe` | `webhookLimiter` | 1000 | 1 m | `wh-stripe:<IP>` |
| `POST /api/webhooks/resend` | `webhookLimiter` | 1000 | 1 m | `wh-resend:<IP>` |

Webhook routes are intentionally generous (1000/min) because primary protection comes from signature verification. The limit exists only to blunt port-scan probes or misconfigured retry storms.

To adjust a limit, update `/lib/rate-limit.ts` and redeploy. No schema changes required.

## Known gaps

- No Stripe/billing flow (intentionally deferred until production domain)
- No Resend transactional email (intentionally deferred)
- OAuth dormant (intentionally deferred — see above)
- No automatic database backups runbook (Neon has built-in PITR; document
  the restore procedure once we test it)
