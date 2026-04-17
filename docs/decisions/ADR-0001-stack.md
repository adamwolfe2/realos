# ADR-0001: Technology Stack Selection

**Status:** Accepted
**Date:** 2026-02-23

## Context

TBGC needs to move from a v0-generated UI prototype to a production-ready B2B order portal. The research docs evaluated multiple approaches (Shopify B2B, Freshline, custom Lovable, hybrid). We need to pick a stack that:
- Builds on the existing Next.js codebase
- Supports B2B ordering, CRM, invoicing, payments
- Can be implemented incrementally
- Doesn't require a dedicated DevOps team

## Decision

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) — keep existing |
| Database | Neon (serverless Postgres) |
| ORM | Prisma |
| Auth | Clerk |
| Payments | Stripe |
| Email | Resend |
| Hosting | Vercel |

## Alternatives Considered

- **Supabase** over Neon: Supabase bundles auth + storage + realtime, but we're using Clerk for auth and don't need realtime. Neon is leaner.
- **Shopify B2B** as core: Good for product catalog but limits custom portal UX. We already have the custom UI.
- **Freshline**: Purpose-built for food distribution but proprietary. We lose control.
- **Drizzle** over Prisma: Lighter but less mature ecosystem. Prisma's migration system is proven.

## Consequences

- Team must manage Neon database (branching, backups)
- Clerk free tier (10K MAU) is plenty for B2B portal
- Stripe fees apply to all transactions (2.9% cards, 0.8% ACH capped at $5)
- Resend free tier is 100 emails/day — upgrade when volume grows
