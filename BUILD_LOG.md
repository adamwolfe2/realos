# Build Log

A one-paragraph entry per sprint covering what shipped, what deferred, DECISION
comments worth flagging, and anything in Wholesail adapted more heavily than
expected. Each entry appended at sprint close.

---

## Sprint 01, Fork Setup & Infrastructure Cleanup

**Shipped.** Hard forked `adamwolfe2/wholesail` into this repo, rebranded
`package.json` to `realos` (0.1.0), rewrote `.env.example` for the real-estate
stack (Clerk + Neon + Stripe + Resend + Cursive + AppFolio + Vercel + Anthropic),
replaced `prisma/schema.prisma` with the PRD's real-estate schema (adds
`Property`, `Listing`, `Tour`, `Application`, `Visitor`, `ChatbotConversation`,
`CreativeRequest`, `AdAccount`, `AdCampaign`, `DomainBinding`, `TenantSiteConfig`,
`CursiveIntegration`, `AppFolioIntegration`; drops all distribution-domain
models), and rewrote `prisma/seed.ts` to seed the singleton `AGENCY` org plus
the Telegraph Commons `CLIENT` tenant + property. Renamed `app/(marketing)` to
`app/(platform)`. Stripped every distribution-domain API route, admin UI page,
distribution page, distribution component, distribution lib file, and the
`scripts/seed-tbgc-*.ts` test scripts. Stubbed the six kept cron jobs with
Sprint 10 TODOs. Created `NAMING.md` documenting the `RealOS` / `realos` /
`realos.dev` placeholder rename. Forked reference clone of Wholesail lives at
`/Users/adamwolfe/TRIG/wholesail` and Telegraph Commons at
`/Users/adamwolfe/TRIG/telegraph-commons` (already cloned). `pnpm type-check`
and `pnpm build` both pass; 26 routes prerender cleanly.

**Deferred with TODO comments.**
- All of `app/admin/*` beyond layout/sidebar/mobile-nav (Sprint 04 rewrites).
- `app/api/admin/*` except `bootstrap` (Sprint 04 rewrites).
- `app/(platform)/page.tsx`, `about/page.tsx` (Sprint 12 rewrites marketing).
- `app/api/intake/route.ts` (Sprint 03 rebuilds the intake flow).
- `app/api/webhooks/stripe/route.ts` acknowledges events but does not act on
  them (Sprint 05 rebuilds retainer billing logic).
- `lib/build/*` distribution provisioning pipeline: deleted everything except
  `default-tasks.ts` (rewrote as a 28-task real-estate tenant checklist) and
  `phases.ts`. Sprint 02 rebuilds `provision-tenant.ts` and `domain-attach.ts`.
- `lib/notifications.ts`, `lib/webhooks.ts` now no-op stubs. The new schema
  intentionally dropped in-app `Notification`, `WebhookEndpoint`, `WebhookLog`
  models; Sprint 04 decides whether any come back.
- `lib/email/*`: only `shared.ts` + `index.ts` survived. All distribution
  transactional templates deleted. Sprint 10 rebuilds intake-confirm,
  lead-captured, weekly-digest, and build-status templates.
- `lib/ai/tools/*`: `order-tools`, `product-tools`, `client-tools`,
  `analytics-tools` all deleted. Sprint 09 re-adds real-estate tool executors.
- Distribution cron jobs (`abandoned-carts`, `low-stock-alerts`,
  `partner-nurture`, `lapsed-clients`) deleted per the Sprint 01 instructions.

**DECISION comments worth flagging.**
- `prisma/schema.prisma` dropped the `datasource.url` and `directUrl` fields
  because Prisma 7 moved them to `prisma.config.ts`. Kept the PRD schema
  otherwise byte-identical.
- `app/layout.tsx` now always wraps in `ClerkProvider`. Wholesail's
  conditional wrap crashed `/_not-found` prerender when Clerk env vars were
  missing at build time.
- `package.json`'s `build` script now runs `prisma generate && next build`
  only. Added a separate `vercel-build` script that also runs
  `prisma migrate deploy`. Local builds do not require a live database.
- Webhook outbound dispatch (`lib/webhooks.ts`) stubbed because the new
  schema does not ship `WebhookEndpoint`/`WebhookLog`. Tagged `TODO(v2)` for
  when tenants request lead/visitor webhooks.
- `lib/portal-config.ts` kept as a compat shim. Every caller migrates to
  `@/lib/brand` + per-Organization settings over Sprints 02-05, at which
  point we remove this shim.
- Stripe webhook handler downgraded to signature-verified acknowledgement.
  Sprint 05 rebuilds subscription + invoice handling for retainer billing.
- Clerk webhook handler updated to use new `orgId`, `clerkUserId` field
  names, plus the new UserRole enum (`AGENCY_OWNER`, `CLIENT_VIEWER`, etc.).
  New users without an invite org get dropped into the singleton Agency org
  as a temporary safety; Sprint 02 refines this via Clerk `organization.*`
  events.

**Wholesail adaptations heavier than expected.**
- The distribution `Project` model had twelve fields (company, industry,
  enabledFeatures, envVars, vercelUrl, currentPhase, contractValue, etc.)
  that the new schema's trimmed `Project` no longer has. Every admin page,
  build pipeline file, and intake-conversion helper assumed those fields, so
  the bulk of the type-check failures clustered here. Resolved by deleting
  the distribution admin tree entirely (Sprint 04 rewrites) and rewriting
  `lib/db/projects.ts`, `lib/db/intake.ts`, `lib/db/organizations.ts` to
  match the new schema's shape. `lib/build/default-tasks.ts` rewritten to a
  real-estate tenant checklist.
- `lib/stripe/order-calculator.ts` and the distribution volume discount +
  tax jurisdiction helpers removed. Sprint 05 rebuilds the real-estate
  billing calculator from the retainer tier enum.

**Environment variables stubbed (fill in before deploy).**
- `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- `DATABASE_URL`, `DIRECT_DATABASE_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `ANTHROPIC_API_KEY`
- `CURSIVE_API_KEY`, `CURSIVE_WEBHOOK_SECRET`
- `APPFOLIO_OAUTH_CLIENT_ID`, `APPFOLIO_OAUTH_CLIENT_SECRET`
- `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`
- `CRON_SECRET`, `BOOTSTRAP_SECRET`
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` (Upstash rate limiting)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set to a well-formed placeholder
  that allows the build to succeed; replace with a real Clerk test or live
  key before deploying.

**Verification.**
- `pnpm type-check`: pass (0 errors).
- `pnpm build`: pass, 26 routes generated. One deprecation warning
  (`middleware.ts` → `proxy.ts` in Next 16.1); Sprint 02 rewrites middleware.
- `prisma generate`: pass.
- Seed script: compiles cleanly; not run against a live DB yet.

---
