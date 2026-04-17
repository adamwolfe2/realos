# TBGC - Architecture

## Overview

```
┌─────────────────────────────────────────────┐
│              Next.js App (Vercel)            │
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ (marketing) │  │ (app)                │  │
│  │ Landing     │  │ /client-portal/*     │  │
│  │ Products    │  │ /checkout            │  │
│  │ About       │  │ /admin/*             │  │
│  └─────────────┘  └──────────────────────┘  │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ Server Actions / API Routes             ││
│  │ (orders, products, clients, payments)   ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
         │              │              │
    ┌────┴────┐   ┌─────┴─────┐  ┌────┴────┐
    │  Clerk  │   │   Neon    │  │ Stripe  │
    │  (Auth) │   │ (Postgres)│  │(Payments│
    └─────────┘   └───────────┘  └─────────┘
                       │
                  ┌────┴────┐
                  │ Prisma  │
                  │  (ORM)  │
                  └─────────┘
```

## Route Groups

```
app/
  (marketing)/     → Public marketing pages (no auth)
    page.tsx       → Landing / homepage
    layout.tsx     → Marketing layout (header + footer)
  (app)/           → Authenticated app routes
    client-portal/ → Client-facing portal
    admin/         → Internal admin panel
    checkout/      → Order checkout flow
    layout.tsx     → App layout (sidebar nav)
  api/             → API routes (webhooks, etc.)
```

## State Management

| What | Where | Why |
|------|-------|-----|
| Auth session | Clerk (server + client) | SSR-compatible, handles roles |
| Cart | React Context + localStorage | Client-side, fast, no DB needed until checkout |
| Products | Database (Prisma) | Source of truth for catalog |
| Orders | Database (Prisma) | Durable, queryable, audit trail |
| Payments | Stripe + Database | Stripe is source of truth; DB caches state |

## Server Actions vs API Routes

- **Server Actions** for all form submissions and data mutations (orders, client updates)
- **API Routes** only for external webhooks (Stripe, etc.) that need raw request access

## Data Flow: Order Lifecycle

```
Cart (client) → Server Action: createOrder → DB: Order (pending)
  → Stripe: create checkout session
  → Redirect to Stripe
  → Stripe webhook: payment_intent.succeeded
  → DB: Order (paid) + Payment record
  → Resend: confirmation email to buyer
  → Resend: notification to ops
  → DB: AuditEvent
```

## Key Patterns

1. **Repository pattern**: `lib/db/` contains data access functions, components never query Prisma directly
2. **Colocation**: Server actions live near the routes that use them
3. **Optimistic UI**: Cart operations are instant; server confirms asynchronously
4. **Idempotency**: All webhook handlers check for duplicate processing
5. **Audit trail**: All state changes write to `AuditEvent` table
