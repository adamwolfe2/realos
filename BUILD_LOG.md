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

## Sprint 02, Multi-Tenancy & Custom Domain Routing

**Shipped.** Full tenant-resolution stack is live: `lib/tenancy/resolve.ts`
looks up `DomainBinding` first (custom domains) and falls back to
`{slug}.{platform-domain}` subdomains; `lib/tenancy/scope.ts` exposes
`getScope` / `requireScope` / `requireAgency` / `requireClient` /
`tenantWhere` + `auditPayload`; `lib/tenancy/impersonate.ts` writes
`publicMetadata.impersonateOrgId` on the agency user's Clerk record and
mirrors start/end to `AuditEvent`. Middleware (`middleware.ts`) now routes
by hostname: tenant hostnames rewrite to `/tenant-site/<path>` with
`x-tenant-org-id/slug/hostname` headers; platform hostnames gate `/admin`,
`/portal`, `/api/admin/*`, `/api/tenant/*`; webhooks and crons stay
unauthenticated. `app/(tenant)/layout.tsx` + `tenant-site/[[...path]]/page.tsx`
render a tenant stub (Sprint 07 fills it in). `app/portal/` gets its auth
gate and a stats-grid stub dashboard. `app/admin/layout.tsx` swapped the ad
hoc role check for `getScope()` + `requireAgency`. `lib/build/domain-attach.ts`
wraps the Vercel Domain API (attach / remove / verify / get status).
`lib/build/provision-tenant.ts` is the new tenant provisioning entrypoint:
creates Organization, TenantSiteConfig, optional first Property, Project
with the 28-task operator checklist, optional DomainBinding, optional
Vercel domain attach; also links an IntakeSubmission → Organization when
passed. API endpoints added: `/api/admin/impersonate/start`, `/end`, and a
`/api/scope` smoke-test probe. `docs/domains-setup.md` documents the
wildcard DNS + custom-domain onboarding ritual.

**Deferred with TODO comments.**
- Tenant site rendering (`app/(tenant)/tenant-site/[[...path]]/page.tsx`)
  is a placeholder; Sprint 07 dispatches on path segments and wires in
  AppFolio listings.
- Portal dashboard (`app/portal/page.tsx`) shows raw row counts; Sprint 05
  rebuilds the full portal (leads pipeline, conversations, creative,
  billing).
- Admin dashboard still a stub pending Sprint 04.
- Middleware deprecation: Next 16.1 prefers `proxy.ts` over
  `middleware.ts`. Kept `middleware.ts` (the PRD uses this name); left the
  rename for a later cleanup sprint.

**DECISION comments worth flagging.**
- Rewrite target is `/tenant-site/...`, not `/_tenant/...`. Next.js's
  private-folder convention skips any path segment prefixed with `_`, so
  the PRD's literal `_tenant` would 404. Renderer lives at
  `app/(tenant)/tenant-site/[[...path]]/page.tsx` and guards against
  direct hits from the platform hostname by requiring the
  `x-tenant-org-id` header middleware sets.
- `getScope` returns both `orgId` (effective, respects impersonation) and
  `actualOrgId` (real session org). Audit events use both: `userId` stays
  the agency actor, `orgId` on the audit row is the subject org, so we
  can prove the chain of custody even through impersonation.
- `tenantWhere(scope)` is the only public way to scope a Prisma query.
  Admin cross-tenant reads go through `requireAgency()` and the call sites
  decide explicitly. Code review should enforce this pattern every sprint.
- Portal layout redirects agency users (who aren't impersonating) to
  `/admin` so no one accidentally sees an "empty" portal.
- Vercel preview URLs (`*.vercel.app`) and localhost count as platform
  hostnames so preview deploys work without a DomainBinding entry.

**Wholesail adaptations heavier than expected.**
- None for this sprint; the Wholesail middleware was a clean extension
  point and the `lib/tenancy/*` tree is net-new.

**Env vars used this sprint (already stubbed in .env.local from Sprint 01).**
- `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (optional).
- `NEXT_PUBLIC_PLATFORM_DOMAIN` (added as new env; read by
  `resolveTenantByHostname`).

**Verification.**
- `pnpm type-check`: pass (0 errors).
- `pnpm build`: pass, 29 routes generated (portal + tenant-site + scope +
  impersonate endpoints added).
- Manual smoke still requires a live database to test `/api/scope` and
  impersonation; flagged as "run after first deploy".

---

## Sprint 03, Intake Wizard (Real Estate)

**Shipped.** Four-step intake wizard at `/onboarding` with draft persistence,
validation, mobile layout, and Cal.com booking. `components/intake/`:
`types.ts`, `constants.ts`, `field.tsx`, `option-button.tsx`, `cal-embed.tsx`,
`index.tsx` wizard shell, plus `step-company.tsx`, `step-portfolio.tsx`,
`step-services.tsx`, `step-booking.tsx`. `/api/onboarding` POST handler
(Zod-validated, IP rate-limited via `publicSignupLimiter`): creates
`IntakeSubmission`, fires Slack alert, sends confirmation to the contact,
sends internal agency alert. `lib/email/onboarding-emails.ts` rebuilds the
Resend transactional templates for real estate (`sendIntakeReceivedEmail`,
`notifyAgencyOfIntake`). `/api/admin/intakes/[id]/convert` calls
`provisionTenant()` from Sprint 02 to promote a submission into a tenant
Organization. `app/onboarding/page.tsx` renders the wizard.

**Deferred with TODO comments.**
- Email templates stay thin for now; Sprint 10 expands the full onboarding
  drip (consultation-booked, proposal-sent, contract-signed, launched).
- Admin intake queue (view/review/convert UI) is Sprint 04.
- Step 3 (module selection) doesn't yet try to enforce module combos
  (e.g., "SEO requires Website"); pricing + bundling gets finalized on the
  consultation call per PRD.

**DECISION comments worth flagging.**
- The wizard submits at step 3 (services) so the booking step can render
  the Cal.com embed prefilled with the contact's name + email, same pattern
  as Wholesail. `IntakeSubmission.bookedCallAt` is populated later via the
  Cal webhook (`/api/intake/[id]/cal-booked`, wired up in Sprint 01).
- Draft persistence uses a version-prefixed localStorage key
  (`realos.intake.v1`) so we can bump the schema without stale drafts
  leaking into a new form shape.
- `CalFunction` + `Window` are already declared globally in
  `types/vendor.d.ts`; the intake embed re-uses those rather than
  redeclaring (redeclaration triggers TS2717 / TS2719).
- Convert endpoint re-computes module flags from `selectedModules` but
  always force-enables `website` + `leadCapture` since those are
  always-on for every real-estate tenant.

**Wholesail adaptations heavier than expected.**
- The Wholesail wizard used `portalConfig.calNamespace` + `portalConfig.contactEmail`
  for brand context. Those got rewired to read `NEXT_PUBLIC_CAL_NAMESPACE`,
  `NEXT_PUBLIC_CAL_LINK`, and `BRAND_EMAIL` directly to keep the intake
  surface self-contained ahead of the portal-config shim removal.
- The Wholesail intake schema had distribution-specific fields (SKU count,
  cold chain, payment terms, industry). Replaced with property type,
  portfolio size, current backend, current vendor, pain point.

**Env vars used this sprint.**
- `NEXT_PUBLIC_CAL_LINK`, `NEXT_PUBLIC_CAL_NAMESPACE` (already stubbed).
- `AGENCY_ADMIN_EMAIL` (already stubbed). Powers the internal intake email.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (stubbed). Intake confirmation +
  internal alert are no-ops until real Resend creds are set; the handler
  logs and continues.

**Verification.**
- `pnpm type-check`: pass (0 errors).
- `pnpm build`: pass, 31 routes generated (added `/onboarding`,
  `/api/onboarding`, `/api/admin/intakes/[id]/convert`).
- End-to-end submit requires a live DB + Resend + Slack + Cal webhook to
  fully exercise; flagged as "run after first deploy".

---
