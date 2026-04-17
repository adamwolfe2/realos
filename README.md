# RealOS

**Managed marketing SaaS for real estate operators.** Website, live listings,
AI chatbot, ad pixel, lead capture, ad creative, reporting. Built and managed
by us. Launched in two weeks.

> `RealOS` is a temporary working name. See `NAMING.md` for how to rename
> globally once the product name is final.

## What this is

A single Next.js app that serves four surfaces from one codebase:

1. **Platform marketing site** (`realos.dev`), sells the product to operators.
2. **Master admin** (`realos.dev/admin`), our agency team's dashboard across
   every tenant: intake queue, fulfillment pipeline, creative requests,
   cross-tenant analytics, impersonation.
3. **Client portal** (`realos.dev/portal`), the client's dashboard: leads,
   visitors, chatbot conversations, ad creative requests, multi-property
   CRM, billing, site builder.
4. **Tenant marketing sites** (e.g. `telegraphcommons.com`), hostname-routed,
   rendered from `app/(tenant)`: live AppFolio listings, chatbot widget,
   pixel installed, lead capture, SEO pages.

All four are served by the same Next.js app. Middleware resolves hostname,
matches to an `Organization`, and routes to the correct surface.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router, Turbopack |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind v4, shadcn/ui, Radix |
| Database | Prisma 7 + Neon Postgres |
| Auth | Clerk (multi-org) |
| Payments | Stripe |
| Email | Resend |
| AI | Anthropic Claude SDK |
| Pixel | Cursive (reseller integration) |
| Backend systems | AppFolio (REST + embed fallback) |
| Hosting | Vercel, single project, wildcard + custom domains |
| Analytics | PostHog, GA4 per-tenant |
| Errors | Sentry |

## Build strategy

Hard fork of [adamwolfe2/wholesail](https://github.com/adamwolfe2/wholesail).
Kept all infrastructure scaffolding (auth, billing, email framework, admin
shell, shadcn/ui, intake wizard framework). Stripped every distribution-domain
concept (products, orders, invoices, shipments, quotes, carts). Replaced with
the real-estate domain (properties, listings, leads, visitors, applications,
chatbot conversations, creative requests, ad campaigns).

Sprint plan lives in `prd/` (12 sprints, roughly two weeks end to end).
Sprint summaries append to `BUILD_LOG.md` as each one ships.

## Quick start

```bash
pnpm install
cp .env.example .env.local        # fill in real secrets
pnpm db:push                      # requires DATABASE_URL set
pnpm db:seed                      # seeds Agency org + Telegraph Commons
pnpm dev
```

## Scripts

- `pnpm dev`, local dev server with Turbopack
- `pnpm build`, `prisma generate && next build`
- `pnpm vercel-build`, adds `prisma migrate deploy` ahead of Next build
- `pnpm type-check`, `tsc --noEmit`
- `pnpm db:push`, push Prisma schema to the configured database
- `pnpm db:seed`, run `prisma/seed.ts`
- `pnpm db:studio`, Prisma Studio

## Repo layout

See `prd/CLAUDE.md` for the target file map. Roughly:

```
app/
  (platform)/    marketing site
  (tenant)/      hostname-routed tenant marketing site
  admin/         master admin
  portal/        client portal
  onboarding/    intake wizard
  api/           route handlers
lib/
  tenancy/       hostname -> org, RLS scope, impersonation
  integrations/  appfolio, cursive, slack, resend, stripe
  build/         tenant provisioning pipeline
  chatbot/       proactive chatbot runtime
  email/         resend framework
  stripe/        retainer billing
components/
  chatbot/       forked from telegraph-commons
  tenant-site/   building blocks for surface 4
  portal/        client portal components
  admin/         master admin components
  intake/        intake wizard steps
  ui/            shadcn/ui
prisma/
  schema.prisma  real-estate domain schema
  seed.ts        agency + Telegraph Commons seed
prd/             product requirements (12 sprints)
```

## Environment variables

See `.env.example` for the full list. Key additions over Wholesail's defaults:

- `CURSIVE_API_KEY`, `CURSIVE_API_URL`
- `APPFOLIO_OAUTH_CLIENT_ID`, `APPFOLIO_OAUTH_CLIENT_SECRET`
- `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` (custom-domain attachment)
- `ANTHROPIC_API_KEY` (chatbot)
- `AGENCY_ORG_SLUG`, `AGENCY_ADMIN_EMAIL`

## Naming

`RealOS`, `realos`, `realos.dev` are temporary placeholders. See `NAMING.md`
for the rename recipe.
