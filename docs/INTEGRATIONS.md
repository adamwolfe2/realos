# TBGC - Integrations

## Clerk (Authentication)

| | |
|---|---|
| **Purpose** | User authentication, session management, role-based access |
| **Data flow** | Clerk → webhook → sync user to DB |
| **Env vars** | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` |
| **Webhooks** | `user.created`, `user.updated` → sync to Users table |
| **Failure mode** | Auth fails → user sees login page. Webhook fails → retry (Clerk retries 3x) |

### Setup Checklist
- [ ] Create Clerk application
- [ ] Configure sign-in methods (email + password, Google)
- [ ] Set up webhook endpoint `/api/webhooks/clerk`
- [ ] Create custom roles: CLIENT, SALES_REP, OPS, ADMIN
- [ ] Configure redirect URLs

## Neon (Postgres Database)

| | |
|---|---|
| **Purpose** | Primary data store |
| **Data flow** | App → Prisma → Neon serverless driver → Postgres |
| **Env vars** | `DATABASE_URL` |
| **Failure mode** | Connection pool exhaustion → 500 errors. Use Prisma connection pooling. |

### Setup Checklist
- [ ] Create Neon project
- [ ] Create `production` and `development` branches
- [ ] Set connection string in env
- [ ] Run `prisma migrate deploy`
- [ ] Run seed script

## Stripe (Payments)

| | |
|---|---|
| **Purpose** | Payment processing (cards, ACH) |
| **Data flow** | App → Stripe Checkout → webhook → update Order/Payment |
| **Env vars** | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Webhooks** | `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed` |
| **Failure mode** | Payment fails → show error to user + log. Webhook fails → Stripe retries for 72h. |

### Setup Checklist
- [ ] Create Stripe account
- [ ] Get API keys (test mode first)
- [ ] Set up webhook endpoint `/api/webhooks/stripe`
- [ ] Create products/prices (or use Checkout line_items)
- [ ] Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- [ ] Enable ACH payments

## Resend (Email)

| | |
|---|---|
| **Purpose** | Transactional emails (order confirmation, notifications) |
| **Data flow** | Server action → Resend API → email delivered |
| **Env vars** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| **Failure mode** | Email fails → log error, don't block order flow. Retry via queue later. |

### Setup Checklist
- [ ] Create Resend account
- [ ] Verify sending domain
- [ ] Create email templates (React Email)
- [ ] Set up `/api/webhooks/resend` for delivery tracking (optional)

## Sentry (Error Tracking) - Phase 2

| | |
|---|---|
| **Purpose** | Error monitoring and alerting |
| **Env vars** | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |

## PostHog (Analytics) - Phase 2

| | |
|---|---|
| **Purpose** | Product analytics, feature flags |
| **Env vars** | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
