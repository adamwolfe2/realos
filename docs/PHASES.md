# TBGC - Implementation Phases

## Phase 1: Foundations (Current)

**Goal:** Make the MVP real — connect to database, auth, and payments.

| Task | Status | Depends On |
|------|--------|------------|
| Prisma + Neon DB + core schema | Ready | — |
| Seed products from existing data | Ready | Schema |
| Clerk auth + route protection | Ready | — |
| Stripe checkout + webhooks | Ready | Schema, Auth |
| Order creation + payment flow | Ready | Stripe, Schema |
| Email notifications (Resend) | Ready | Orders |
| Client portal reads from DB | Ready | Schema, Auth |
| Admin panel (basic) | Ready | Auth, Schema |

## Phase 2: Client Portal Enhancement

**Goal:** Full self-serve ordering experience.

| Task | Status | Depends On |
|------|--------|------------|
| Reorder last order | Planned | Phase 1 |
| Saved carts | Planned | Phase 1 |
| Invoice viewing + payment | Planned | Stripe, Schema |
| Order status tracking | Planned | Orders |
| Account settings | Planned | Auth |
| Payment methods management | Planned | Stripe |
| Messages / support | Planned | Phase 1 |
| Real analytics from DB | Planned | Orders, Payments |

## Phase 3: Sales Ops + Admin

**Goal:** CRM + ops tooling for the 22-person sales team.

| Task | Status | Depends On |
|------|--------|------------|
| Rep dashboard (accounts, tasks) | Planned | Phase 2 |
| Build cart for client | Planned | Phase 2 |
| Quote builder | Planned | Phase 2 |
| Account tiers + pricing rules | Planned | Phase 2 |
| Fulfillment ops console | Planned | Phase 2 |
| Substitution workflow | Planned | Phase 2 |
| Reporting dashboards | Planned | Phase 2 |

## Phase 4: Marketing Site + Growth

**Goal:** Professional public presence + SEO.

| Task | Status | Depends On |
|------|--------|------------|
| Marketing landing page | Planned | Route groups |
| Product showcase pages | Planned | Products DB |
| "Request an Account" flow | Planned | Auth |
| SEO metadata + structured data | Planned | Marketing site |
| Blog / content pages | Planned | Marketing site |
| Seasonal drops / collections | Planned | Products DB |
