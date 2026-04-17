# {{PRODUCT_NAME}} — PRD Bundle

A complete product requirements document for building a managed marketing SaaS for real estate operators, designed as a hard fork of the Wholesail platform.

## How to use this bundle

### Option 1: Single handoff to Claude Code
Drop this entire `prd/` folder into the root of your new repo. Start Claude Code with:
> "Read `prd/CLAUDE.md` first, then work through sprints 01 through 12 in order."

### Option 2: Sprint-by-sprint
Feed one sprint file at a time to Claude Code, verify each is done before moving to the next. Recommended for higher quality and easier review.

## Before you start

1. **Rename the product.** Find-and-replace `{{PRODUCT_NAME}}`, `{{PRODUCT_NAME_KEBAB}}`, `{{PRODUCT_SHORT_NAME}}`, `{{PRODUCT_DOMAIN}}` across all files once you've picked a name.

2. **Pull Telegraph Commons.** Sprints 06 and 09 reference `github.com/adamwolfe2/telegraph-commons` for forked code (chatbot + AppFolio research). Make sure Claude Code has access to that repo, or paste in the relevant files before those sprints.

3. **Wholesail repo is the source of truth for scaffolding.** Every "fork from" reference points to `github.com/adamwolfe2/wholesail`. Keep it cloned locally so Claude Code can reference it.

4. **Environment variables.** See `CLAUDE.md` for the full list of env vars to add on top of Wholesail's existing set.

5. **Verify the Cursive API shape** before Sprint 08 — the exact endpoints and field names need to be confirmed against the Cursive docs or admin UI.

## File index

- `CLAUDE.md` — master orchestration, architectural decisions, file map, build order
- `00-schema.prisma` — complete database schema, drop-in replacement for Wholesail's schema
- `01-fork-setup.md` — repo fork, strip distribution code, pass clean build
- `02-multi-tenancy.md` — hostname routing, org scoping, impersonation
- `03-intake-wizard.md` — 4-step onboarding form for real estate
- `04-master-admin.md` — agency dashboard, intake queue, pipeline, impersonation
- `05-client-portal.md` — tenant dashboard with properties, leads, site builder, billing
- `06-appfolio-integration.md` — live listings sync with REST + embed fallback
- `07-tenant-marketing-sites.md` — hostname-routed tenant marketing site renderer
- `08-cursive-pixel.md` — provisioning, webhook ingestion, visitor dashboard, outreach
- `09-chatbot.md` — forked proactive chatbot from Telegraph Commons, multi-tenant
- `10-lead-capture-crm.md` — cadence engine, unsubscribe, lapsed-lead recovery
- `11-creative-studio.md` — request/fulfill workflow with threaded conversation
- `12-platform-marketing-site.md` — homepage, pricing, vertical pages, competitor comparison

## Total estimated build time

~11 days for a single engineer (or Claude Code running end-to-end). Sprints are designed to be independently shippable where possible.

## v2 scaffolded but not built

The schema supports these from day 1; add dedicated sprints when ready:
- Commercial vertical UI and marketing pages
- Student referral program
- Lead magnet tools library
- AI creative generation in creative studio
- Self-serve billing / checkout (if later strategically desirable)
- Per-client email cadence customization
- Ad platform auto-sync for hashed visitor emails

## Design rules for Claude Code

Every sprint file ends with "Done when" criteria and a handoff statement. Treat these as acceptance criteria. If something's unclear, leave a `TODO` with your reasoning rather than inventing scope.
