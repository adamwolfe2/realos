# CLAUDE.md — Master Orchestration

**Product codename:** `{{PRODUCT_NAME}}` (placeholder — find/replace after naming)
**Founder:** Adam Wolfe
**Build strategy:** Hard fork from Wholesail (https://github.com/adamwolfe2/wholesail), keep infrastructure, delete distribution domain code, replace with real estate marketing SaaS.
**Target first client case study:** Telegraph Commons (Norman Gensinger / SG Real Estate)
**Primary competitor:** Conversion Logix (conversionlogix.com) — $2,600/mo for garbage, we deliver 10x at same price
**Model:** Managed marketing SaaS for real estate operators. Not a snapshot, not a one-time build. Ongoing retainer + managed services.

---

## What you are building

A multi-tenant SaaS platform where real estate operators (property management companies, owner-operators, student housing operators) pay a monthly retainer for an all-in-one marketing and lead generation system. The platform ships four surfaces:

1. **Platform marketing site** — the `.com` that sells the product. Industry pages, comparison pages, lead magnet tools, consultation booking (no self-serve checkout).
2. **Master admin** (`/admin`) — for OUR team. Master CRM across all clients. Client list, fulfillment pipeline, cross-tenant analytics, impersonation mode, ad campaign oversight, creative request queue.
3. **Client portal** (`/portal`) — for THEIR team. Leads, pixel visitors, chatbot conversations, ad creative requests, CRM, multi-property dashboard, billing.
4. **Tenant marketing sites** — rendered from our codebase, served on the client's custom domain (e.g., `telegraphcommons.com`). Live AppFolio listings, chatbot widget, pixel installed, lead capture, SEO pages.

---

## Architectural decisions (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multi-tenancy | **Shared tenant, org_id RLS** | Real estate has low per-client data volume. Shared infra = fast onboarding + master dashboard is trivial. |
| Fork strategy | **Hard fork from Wholesail** | Keep infrastructure scaffolding, delete distribution domain code. |
| Billing | **Consultation-required** | No self-serve checkout in v1. Every client goes through intake → call → proposal → Stripe invoice. |
| Pixel | **Cursive (Adam owns)** | Reseller/integration. Call Cursive API to provision pixel per tenant. No identity graph build. |
| Chatbot | **Fork from Telegraph Commons repo** | Already built and working. Pull into monorepo as shared component. |
| AppFolio | **REST API (Plus plan) primary, embed script fallback** | Norman has Plus. Research already done in Telegraph Commons repo. |
| Property type | **Residential-first (v1), commercial scaffolded (v2)** | Wedge on student housing. Schema supports both; UI/tools ship residential first. |
| Client marketing sites | **Hosted-on-us default, bring-your-own-site supported** | Custom domain via Vercel Domain API. BYO-site mode = just pixel + chatbot script. |
| Database | **Postgres (Neon) + Prisma** | Same as Wholesail. Single DB, RLS, one schema. |
| Hosting | **Single Vercel project, wildcard domain + custom domains** | One project serves all surfaces. Middleware routes by hostname. |

---

## Fork-and-delete plan (what survives from Wholesail)

### KEEP AS-IS
- `lib/build/` — auto-provisioning pipeline (repurposed for tenant provisioning, not repo provisioning)
- `lib/email/` — Resend setup, template patterns, onboarding drip framework
- `lib/stripe/` — billing, subscriptions, invoicing
- `lib/auth/` — Clerk multi-org setup
- `lib/rate-limit.ts`, `lib/env.ts`, `lib/uploads.ts`, `lib/sentry.ts` — utility layer
- `lib/integrations/slack.ts`, `lib/integrations/emailbison.ts` — keep for internal ops and email campaigns
- `components/intake/` — 4-step wizard (rewrite steps, keep wizard framework)
- `components/ui/` — entire shadcn/ui component library
- `components/pipeline-board.tsx`, `pipeline-card.tsx` — Kanban pattern for fulfillment CRM
- `components/admin-dashboard.tsx`, `admin-notifications.tsx` — admin scaffolding
- `components/nav-bar.tsx`, `marketing-header.tsx`, `portal-nav.tsx` — navigation patterns
- `components/seo/` — SEO component library
- `app/api/webhooks/clerk/`, `app/api/webhooks/stripe/` — auth and billing webhooks
- `app/api/cron/` — keep directory, rewrite jobs for real estate context (see Sprint 10)
- `app/(marketing)/` — keep folder structure, rewrite page content for real estate verticals
- `app/admin/pipeline/`, `admin/clients/`, `admin/ceo/`, `admin/analytics/`, `admin/tasks/`, `admin/audit-log/`, `admin/leads/` — master admin scaffolding
- `middleware.ts` — Clerk middleware (extend for hostname-based tenant routing)
- `instrumentation.ts`, `sentry.*.config.ts` — observability

### DELETE
- All `app/(marketing)/{industry}/` pages for distribution industries (flooring, chemical, candy, etc.) — REWRITE as real estate verticals
- `app/api/drops/`, `app/api/attachments/`, `app/api/shipments/`, `app/api/products/`, `app/api/parse-order/`, `app/api/checkout/`, `app/api/supplier/`, `app/api/scrape/`, `app/api/wholesale/`, `app/api/notify-me/`, `app/api/claim/` — distribution domain
- `app/api/client/loyalty/`, `app/api/client/quotes/`, `app/api/client/conversations/`, `app/api/client/pricing-tier/`, `app/api/client/notifications/` — distribution client portal
- `app/catalog/`, `app/checkout/`, `app/claim/`, `app/supplier/` — distribution frontend
- `app/admin/products/`, `admin/orders/`, `admin/shipments/`, `admin/fulfillment/`, `admin/suppliers/`, `admin/drops/`, `admin/subscribers/`, `admin/reps/`, `admin/quotes/`, `admin/pricing/`, `admin/wholesale/` — distribution admin
- `app/client-portal/catalog/`, `orders/`, `invoices/`, `saved-carts/`, `payments/`, `quotes/`, `standing-orders/`, `inventory/`, `fulfillment/`, `referrals/`, `messages/` — distribution client portal (some get rewritten, see sprint files)
- `lib/ai/order-parser.ts`, `lib/ai/platform-knowledge.ts` — distribution-specific AI
- `lib/products.ts`, `lib/catalog-categories.ts`, `lib/cart-context.tsx`, `lib/order-number.ts`, `lib/smart-reorder.ts`, `lib/sms-ordering.ts`, `lib/provenance.ts`, `lib/pdf/`, `lib/payments/`, `lib/integrations/blooio.ts`, `lib/pricing.ts`, `lib/loyalty.ts`, `lib/referrals.ts`, `lib/credit.ts`, `lib/tier-upgrade.ts`, `lib/client-data.ts`, `lib/client-health.ts`, `lib/portal-config.ts` — distribution domain libraries
- Prisma models: `Product`, `Order`, `OrderItem`, `Invoice`, `Payment`, `Shipment`, `ShipmentEvent`, `Quote`, `QuoteItem`, `SavedCart`, `SavedCartItem`, `StandingOrder`, `StandingOrderItem`, `InventoryLevel`, `InventoryRestock`, `PricingRule`, `ProductDrop`, `DropAlert`, `ProductNotifyAlert`, `Supplier`, `SupplierSubmission`, `RepTask` — replace with real estate models (see `00-schema.prisma`)

### KEEP AND RENAME/EVOLVE
- `User`, `Organization`, `Address`, `AuditEvent`, `ClientNote`, `Lead`, `IntakeSubmission`, `Project`, `ProjectTask`, `ProjectCost`, `ProjectNote`, `EmailSubscriber` — survive as-is, extended for real estate fields

---

## Build order (12 sprints, ~2 weeks end-to-end)

Each sprint has its own markdown file in this folder. Work them in order; each depends on previous ones.

| # | Sprint | Dependency | Est. Time |
|---|--------|------------|-----------|
| 00 | Database schema + migrations | — | 0.5 day |
| 01 | Repo fork + infrastructure cleanup | 00 | 0.5 day |
| 02 | Multi-tenancy + custom domain routing | 01 | 1 day |
| 03 | Onboarding intake wizard (rewrite Wholesail wizard) | 02 | 1 day |
| 04 | Master admin CRM + fulfillment pipeline | 02 | 1 day |
| 05 | Client portal foundation | 02 | 1 day |
| 06 | AppFolio integration + live listings sync | 05 | 1 day |
| 07 | Tenant marketing site renderer | 06 | 1 day |
| 08 | Cursive pixel integration + visitor dashboard | 07 | 0.5 day |
| 09 | AI chatbot (fork from Telegraph Commons) | 07 | 1 day |
| 10 | Lead capture, CRM, follow-up automation | 09 | 1 day |
| 11 | Ad creative studio (request/fulfill workflow) | 05 | 0.5 day |
| 12 | Platform marketing site + industry pages | 02 | 1 day |

**v2 scaffolding (NOT in first sprint push):** Commercial vertical UI, student referral attribution, lead magnet tools library, SEO/AEO automation module, email campaign module, paid ads platform sync. All have schema hooks in `00` so they plug in cleanly later.

---

## Global rules for Claude Code

1. **Preserve Wholesail's patterns exactly.** If Wholesail has a Kanban pattern in `components/pipeline-board.tsx`, reuse it. If it has an email template in `lib/email/onboarding-drip-emails.ts`, extend it, don't rewrite. Every decision should default to "what did Wholesail do?"

2. **Every table has `org_id`.** Every query goes through Prisma middleware that auto-filters by the current `org_id` from the Clerk session. No exceptions. Master admin bypasses this via an explicit `impersonate()` helper.

3. **Two org types: `AGENCY` (us, singleton) and `CLIENT` (each real estate company).** Master admin users belong to the AGENCY org. Impersonation switches active `org_id` for the request.

4. **Property type enum at Organization level** (`RESIDENTIAL | COMMERCIAL | MIXED`). All UI in v1 only renders residential paths. Commercial paths throw a "coming soon" gate. Schema supports both from day 1.

5. **Tenant marketing sites are rendered by our Next.js app, scoped by hostname.** The `middleware.ts` resolves hostname → Organization → injects `tenantOrg` into request context. `app/(tenant)/` route group renders the tenant-facing site.

6. **Custom domain per client is default, subdomain is fallback.** Every Organization has `primary_domain` (optional, custom) and `slug` (required, for `{slug}.platformdomain.com` fallback).

7. **No snapshot language in any user-facing copy.** We are a managed SaaS platform. Copy lives in `lib/copy/` for easy find-and-replace.

8. **Cursive pixel integration is an external API call, not a local build.** `lib/integrations/cursive.ts` is the single file that calls Cursive's API to provision pixels and pull visitor data.

9. **AppFolio research already exists in the `telegraph-commons` repo.** Before writing Sprint 6, pull that repo and extract the API patterns into `lib/integrations/appfolio.ts`.

10. **Chatbot already exists in `telegraph-commons` repo.** Fork it as-is into `components/chatbot/`. Abstract the config (knowledge base, avatar, brand colors) into per-tenant settings.

11. **Never break the Wholesail build pipeline.** `lib/build/` is the infrastructure that provisions new tenants. Extend it, don't replace it. Its 28-task operator checklist becomes our tenant provisioning checklist.

12. **Everything is async and queued where possible.** Use Upstash QStash for anything that's not a direct user request: pixel enrichment, AppFolio listing sync, email drips, chatbot conversation logging.

---

## File map Claude Code should produce

```
{{PRODUCT_NAME}}/
├── CLAUDE.md                           # This file
├── prisma/
│   ├── schema.prisma                   # From 00-schema.prisma
│   ├── seed.ts                         # Seed AGENCY org + Adam's user + test tenant
│   └── migrations/
├── middleware.ts                       # Hostname → tenant resolution + Clerk auth
├── app/
│   ├── (platform)/                     # Platform marketing site (surface 1)
│   │   ├── page.tsx                    # Homepage
│   │   ├── pricing/page.tsx
│   │   ├── demo/page.tsx               # Live demo flow
│   │   ├── residential/page.tsx
│   │   ├── commercial/page.tsx         # v2 scaffolded, "coming soon"
│   │   ├── student-housing/page.tsx
│   │   ├── multifamily/page.tsx
│   │   ├── senior-living/page.tsx
│   │   ├── compare/conversion-logix/page.tsx
│   │   ├── tools/                      # Lead magnet tools (v2)
│   │   └── about/, blog/, privacy/, terms/
│   ├── (tenant)/                       # Client marketing sites (surface 4)
│   │   └── [...path]/page.tsx          # Hostname-routed dynamic renderer
│   ├── admin/                          # Master admin (surface 2)
│   │   ├── layout.tsx                  # Agency-only auth gate
│   │   ├── page.tsx                    # CEO dashboard
│   │   ├── clients/                    # All tenants
│   │   ├── pipeline/                   # Fulfillment Kanban
│   │   ├── leads/                      # Cross-tenant lead view
│   │   ├── creative-requests/          # Ad creative queue
│   │   ├── campaigns/                  # Ad campaigns across clients
│   │   ├── impersonate/[orgId]/        # Jump into client context
│   │   └── analytics/, tasks/, audit-log/
│   ├── portal/                         # Client portal (surface 3)
│   │   ├── layout.tsx                  # Tenant-scoped auth gate
│   │   ├── page.tsx                    # Tenant dashboard
│   │   ├── properties/                 # Their properties + listings
│   │   ├── leads/                      # Their leads pipeline
│   │   ├── visitors/                   # Pixel-captured visitors
│   │   ├── conversations/              # Chatbot conversations
│   │   ├── creative/                   # Request ad creatives
│   │   ├── campaigns/                  # View ad performance
│   │   ├── site-builder/               # Edit their tenant marketing site
│   │   ├── billing/
│   │   └── settings/
│   ├── onboarding/                     # Intake wizard (entry point from platform)
│   │   └── page.tsx
│   └── api/
│       ├── onboarding/                 # Intake submit, steps
│       ├── webhooks/
│       │   ├── clerk/, stripe/
│       │   └── cursive/                # Pixel event ingestion
│       ├── cron/                       # Scheduled jobs
│       ├── tenant/                     # Tenant-scoped APIs
│       │   ├── leads/, visitors/, conversations/
│       │   ├── listings/, properties/
│       │   └── creative-requests/
│       ├── admin/                      # Agency-only APIs
│       ├── chatbot/                    # Chatbot conversation endpoint
│       └── appfolio/                   # AppFolio sync, webhook
├── lib/
│   ├── tenancy/
│   │   ├── resolve.ts                  # Hostname → org
│   │   ├── scope.ts                    # Prisma RLS middleware
│   │   └── impersonate.ts              # Agency impersonation helper
│   ├── integrations/
│   │   ├── appfolio.ts                 # AppFolio REST + embed fallback
│   │   ├── cursive.ts                  # Cursive pixel API
│   │   ├── slack.ts                    # (kept from Wholesail)
│   │   └── emailbison.ts               # (kept from Wholesail)
│   ├── build/                          # Tenant provisioning (evolved from Wholesail)
│   │   ├── provision-tenant.ts
│   │   ├── default-tasks.ts            # 28-task operator checklist
│   │   └── domain-attach.ts            # Vercel Domain API
│   ├── chatbot/
│   │   ├── proactive-trigger.ts
│   │   ├── knowledge-base.ts
│   │   └── client.ts
│   ├── copy/
│   │   └── marketing.ts                # All user-facing copy, centralized
│   ├── email/                          # (kept from Wholesail)
│   ├── stripe/                         # (kept from Wholesail)
│   ├── auth/                           # (kept from Wholesail)
│   └── [other utility files kept from Wholesail]
├── components/
│   ├── chatbot/                        # Forked from telegraph-commons
│   │   ├── ProactiveWidget.tsx
│   │   ├── ChatInterface.tsx
│   │   └── LeadCapture.tsx
│   ├── pixel/
│   │   └── CursivePixelLoader.tsx      # Script tag injector for tenant sites
│   ├── tenant-site/                    # Components rendered on tenant marketing sites
│   │   ├── Hero.tsx, Listings.tsx, RoomCard.tsx, ApplyCTA.tsx, ...
│   ├── intake/                         # (rewritten from Wholesail)
│   ├── admin/                          # Master admin components
│   ├── portal/                         # Client portal components
│   ├── creative-request/               # Request/review workflow
│   └── ui/                             # (kept from Wholesail — shadcn/ui)
└── prd/
    ├── CLAUDE.md                       # This file
    ├── 00-schema.prisma
    ├── 01-fork-setup.md
    ├── 02-multi-tenancy.md
    ├── 03-intake-wizard.md
    ├── 04-master-admin.md
    ├── 05-client-portal.md
    ├── 06-appfolio-integration.md
    ├── 07-tenant-marketing-sites.md
    ├── 08-cursive-pixel.md
    ├── 09-chatbot.md
    ├── 10-lead-capture-crm.md
    ├── 11-creative-studio.md
    └── 12-platform-marketing-site.md
```

---

## Environment variables to add (on top of Wholesail's)

```
CURSIVE_API_KEY=                   # Adam's Cursive account
CURSIVE_API_URL=https://api.cursive.io/v1
APPFOLIO_OAUTH_CLIENT_ID=          # Per tenant, stored encrypted in DB
APPFOLIO_OAUTH_CLIENT_SECRET=
VERCEL_API_TOKEN=                  # For programmatic domain attachment
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=
ANTHROPIC_API_KEY=                 # Chatbot
AGENCY_ORG_SLUG=                   # Singleton agency org identifier
AGENCY_ADMIN_EMAIL=adam@...        # Master admin seed
```

---

## Read these files before you start each sprint

- `CLAUDE.md` — you're reading it
- `00-schema.prisma` — complete database schema
- The specific sprint file (`0X-*.md`)
- Relevant Wholesail source files referenced in each sprint
- For Sprint 6 and 9: pull `github.com/adamwolfe2/telegraph-commons` and extract referenced code

**Do not skip sprints. Do not reorder. Do not invent new modules that aren't in this PRD. If you think something is missing, leave a TODO comment with your reasoning and continue.**
