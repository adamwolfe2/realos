# Wholesail Portal — Deployment Checklist

Complete guide for forking the Wholesail template and deploying a new client portal. Used for onboarding new distribution clients onto their own white-label B2B ordering platform.

Reference implementation: **TBGC** (Truffle Boys & Girls Club) — live since 2025-12-14.

---

## Table of Contents

1. [Pre-Deployment](#1-pre-deployment)
2. [Deployment Steps](#2-deployment-steps)
3. [Post-Deployment Verification](#3-post-deployment-verification)
4. [Ongoing Monitoring](#4-ongoing-monitoring)
5. [TBGC-Specific Notes](#5-tbgc-specific-notes)

---

## 1. Pre-Deployment

### 1.1 Client Requirements Gathered

- [ ] Company name, short name, industry
- [ ] Contact name, email, phone, role
- [ ] Logo file (PNG/SVG, min 512px)
- [ ] Brand colors (primary, secondary/accent)
- [ ] Domain name (purchased or to be purchased)
- [ ] Product catalog (spreadsheet or API export)
- [ ] Number of SKUs and categories
- [ ] Cold chain requirements (yes/no, which products)
- [ ] Payment terms offered (COD, NET15, NET30, etc.)
- [ ] Feature selection (from intake form)
- [ ] Existing client list for import (if migrating)

### 1.2 Third-Party Accounts Provisioned

Each client portal requires its own set of service accounts:

| Service | Purpose | Account Type |
|---------|---------|-------------|
| **Clerk** | Authentication, user management | New Clerk application |
| **Neon** (via Vercel Postgres) | PostgreSQL database | Vercel Storage store |
| **Stripe** | Payments, invoicing | Stripe Connect sub-account |
| **Resend** | Transactional email | Shared account, per-client domain |
| **Bloo.io** | SMS/iMessage ordering | Per-client phone number |
| **Upstash** (via Vercel KV) | Redis cache, rate limiting | Vercel Storage store |
| **Gemini** | AI order parsing, reply suggestions | Shared API key with metadata tagging |

### 1.3 Environment Variables Checklist

All required env vars for a client portal deployment:

```
# Database (Vercel Postgres / Neon)
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Payments (Stripe)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Email (Resend)
RESEND_API_KEY=

# SMS (Bloo.io) — optional, if sms-ordering feature enabled
BLOOIO_API_KEY=
BLOOIO_PHONE_NUMBER=
BLOOIO_WEBHOOK_SECRET=

# AI (Gemini) — optional, if ai-order-parsing feature enabled
GEMINI_API_KEY=

# Cache (Upstash / Vercel KV)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cron jobs
CRON_SECRET=

# App
NEXT_PUBLIC_APP_URL=
```

### 1.4 DNS Preparation

- [ ] Client owns or has purchased their domain
- [ ] Access to DNS provider confirmed
- [ ] Plan for subdomain vs root domain (e.g., `order.clientdomain.com` vs `clientdomain.com`)
- [ ] SSL will be handled by Vercel (automatic)

---

## 2. Deployment Steps

### 2.1 Fork and Configure Repository

The `build-start` automation handles most of this. Manual steps noted where applicable.

**Automated (via build-start):**

1. Generate `portal.config.ts` from intake form data (branding, features, industry)
2. Create GitHub repo from template (`adamwolfe2/TBGC` as base)
3. Push initial commit with generated config

**Manual:**

1. [ ] Clone the new repo locally and verify config
2. [ ] Update `package.json` name and description
3. [ ] Replace logo assets in `/public/` directory
4. [ ] Update `favicon.ico` and Open Graph images
5. [ ] Review generated `portal.config.ts` — adjust colors, feature flags, copy

### 2.2 Provision Infrastructure

**Automated (via build-start):**

1. Create Vercel project linked to GitHub repo
2. Provision Vercel Postgres (Neon) database
3. Provision Vercel KV (Upstash) store

**Manual:**

1. [ ] Create Clerk application
   - Set allowed origins to Vercel preview URL + custom domain
   - Configure webhook endpoint: `https://<domain>/api/webhooks/clerk`
   - Enable email + Google OAuth sign-in methods
2. [ ] Create or connect Stripe account
   - Set up Stripe Connect sub-account (if using platform billing)
   - Configure webhook endpoint: `https://<domain>/api/webhooks/stripe`
   - Add products/prices if using Stripe-managed catalog
3. [ ] Set up Resend domain verification
   - Add DNS records for sending domain
   - Verify domain in Resend dashboard
4. [ ] Provision Bloo.io phone number (if SMS ordering enabled)
   - Configure webhook endpoint: `https://<domain>/api/webhooks/bloo`

### 2.3 Database Setup

1. [ ] Run Prisma migrations: `pnpm prisma migrate deploy`
2. [ ] Seed product catalog: `pnpm tsx scripts/seed-tbgc-products.ts` (or client-specific seed)
3. [ ] Import historical client data (if migrating from another system)
4. [ ] Verify seed data in database (spot-check products, orgs, sample orders)

### 2.4 Configure Environment Variables

1. [ ] Set all env vars in Vercel project settings (Production + Preview)
2. [ ] Verify no env vars are `missing` — check Project record's `envVars` JSON
3. [ ] Set `CRON_SECRET` to a secure random string
4. [ ] Set `NEXT_PUBLIC_APP_URL` to the final production URL

### 2.5 Deploy

1. [ ] Push to `main` branch to trigger Vercel deployment
2. [ ] Monitor build logs in Vercel dashboard
3. [ ] Verify deployment completes without errors
4. [ ] Check deployment URL loads correctly

### 2.6 Connect Custom Domain

1. [ ] Add custom domain in Vercel project settings
2. [ ] Add CNAME or A record in client's DNS provider
3. [ ] Wait for DNS propagation (typically 5-30 minutes)
4. [ ] Verify SSL certificate is issued (automatic via Vercel)
5. [ ] Update Clerk allowed origins to include custom domain
6. [ ] Update Stripe webhook endpoint to custom domain
7. [ ] Update Bloo.io webhook endpoint to custom domain (if applicable)
8. [ ] Update Resend sending domain (if applicable)
9. [ ] Update `NEXT_PUBLIC_APP_URL` env var to custom domain

---

## 3. Post-Deployment Verification

### 3.1 Authentication

- [ ] Sign-up flow works (new user creates account)
- [ ] Sign-in flow works (existing user logs in)
- [ ] Clerk webhook fires and creates User record in database
- [ ] Role-based access works (CLIENT sees portal, ADMIN sees admin panel)
- [ ] OAuth sign-in works (Google, if configured)

### 3.2 Product Catalog

- [ ] All products display correctly with names, descriptions, pricing
- [ ] Product categories filter correctly
- [ ] Product images load (if uploaded)
- [ ] Cold chain indicators show on relevant products
- [ ] Market rate products show "call for pricing" or current price
- [ ] Minimum order quantities enforced in cart

### 3.3 Order Flow

- [ ] Add items to cart
- [ ] Adjust quantities, remove items
- [ ] Submit order — status shows PENDING
- [ ] Admin can view and confirm order (PENDING -> CONFIRMED)
- [ ] Admin can mark order as packed, shipped, delivered
- [ ] Client receives order confirmation email
- [ ] Client can view order history and status

### 3.4 Payments

- [ ] Stripe checkout session creates correctly
- [ ] Payment completes and order is marked as paid
- [ ] Stripe webhook updates payment status in database
- [ ] Invoice is auto-generated for paid orders (if autoInvoice enabled)
- [ ] ACH/wire payment instructions display correctly (if applicable)

### 3.5 Email

- [ ] Order confirmation email sends and renders correctly
- [ ] Invoice email sends with correct amounts
- [ ] Password reset email works
- [ ] Onboarding welcome email triggers for new orgs

### 3.6 SMS Ordering (if enabled)

- [ ] Client can text order to Bloo.io number
- [ ] AI parses order text into structured items
- [ ] SMS order draft appears in admin panel
- [ ] Admin can confirm or modify SMS order
- [ ] Confirmation SMS sent back to client

### 3.7 Admin Panel

- [ ] Dashboard loads with key metrics
- [ ] Client list shows all organizations
- [ ] Order management board functions (filter, sort, status updates)
- [ ] Invoice management works (create, send, mark paid)
- [ ] Fulfillment workflow operates correctly

---

## 4. Ongoing Monitoring

### 4.1 Health Scoring

- [ ] RFM (Recency, Frequency, Monetary) health scores calculating for all orgs
- [ ] At-risk clients flagged (score dropping below threshold)
- [ ] Smart reorder alerts triggering for overdue repeat clients

### 4.2 Analytics

- [ ] Vercel Analytics collecting page views
- [ ] Order volume trends tracking correctly
- [ ] Revenue dashboards showing accurate totals
- [ ] Product performance metrics updating

### 4.3 Error Tracking

- [ ] Vercel deployment logs accessible
- [ ] Runtime error logs monitored
- [ ] Webhook delivery success rates checked weekly
- [ ] Cron job execution verified (standing orders, reminders, health scores)

### 4.4 Routine Maintenance

- [ ] Weekly: Check webhook delivery logs for failures
- [ ] Weekly: Review error logs in Vercel
- [ ] Monthly: Audit user accounts and permissions
- [ ] Monthly: Review Stripe payouts and reconciliation
- [ ] Monthly: Check database size and query performance
- [ ] Quarterly: Rotate `CRON_SECRET` and review API keys
- [ ] Quarterly: Review and update product catalog with client

---

## 5. TBGC-Specific Notes

TBGC (Truffle Boys & Girls Club) is the first production client and the reference implementation. Key details:

### Infrastructure

- **GitHub**: `adamwolfe2/TBGC`
- **Vercel Project**: `prj_GxMgXdOYErqgqg6Hsabk5oom5M94`
- **Current URL**: `tbgclub.vercel.app` (migrating to `truffleboys.com`)
- **Status**: LIVE since 2025-12-14

### Data Scale

- 122+ SKUs across truffles, caviar, wagyu, foie gras, specialty items
- 342+ wholesale clients (Michelin restaurants, hotels, private chefs)
- 313 historical organizations imported with 1,661 invoices
- Cold chain required for most product categories

### Unique Configuration

- SMS/iMessage ordering via Bloo.io is a critical workflow
- AI order parsing (Gemini) for natural-language SMS orders
- Loyalty program active with point accumulation
- Referral program active with credit rewards
- Market rate pricing on fresh truffles and saffron (prices fluctuate)
- Prepay required on all Japanese A5 wagyu and fresh truffle orders
- Supplier portal for seasonal sourcing submissions

### Domain Migration (In Progress)

The portal is migrating from `tbgclub.vercel.app` to `truffleboys.com`. When completing this migration:

1. Add `truffleboys.com` as custom domain in Vercel
2. Update DNS records at domain registrar
3. Update Clerk allowed origins
4. Update Stripe webhook endpoints
5. Update Bloo.io webhook endpoints
6. Update Resend sending domain
7. Update `NEXT_PUBLIC_APP_URL` in Vercel env vars
8. Verify all webhooks fire correctly on new domain
9. Set up redirect from old URL to new domain

### Seed Scripts

- `scripts/seed-tbgc-client.ts` — Seeds TBGC as a Project in the portal-intake admin
- `scripts/seed-tbgc-products.ts` — Seeds 20 demo products, 3 orgs, 5 orders, 3 invoices

### Env Var Status

All env vars configured except:
- `UPSTASH_REDIS_REST_URL` — missing (KV store not yet provisioned)
- `UPSTASH_REDIS_REST_TOKEN` — missing (KV store not yet provisioned)
