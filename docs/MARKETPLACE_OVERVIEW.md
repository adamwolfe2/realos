# LeaseStack Marketplace — Build Overview

> Use this doc as the script + reference for the Ryan walkthrough video.
> Every URL below is live in production after this commit deploys.

## What it is

A two-sided, standalone lead marketplace built on top of LeaseStack.
**Sellers** import real-estate leads (CSV upload OR Cursive segment).
**Buyers** browse, filter, and buy individual leads or subscribe to
auto-buy streams. Every sale splits revenue between the platform and
the seller who contributed the lead.

The marketplace is intentionally separate from the operator portal —
it has its own URL space (`/marketplace/*`), its own auth (magic-link,
no Clerk), and its own data model. None of it requires a LeaseStack
operator account.

---

## The four surfaces

### 1. Public browse — `/marketplace`
Anyone can land here. Filter by **market**, **property type**,
**intent floor**, and **price band**. Lead cards show:
- Real headshot (deterministic from the cursive profile id)
- Masked name (first name + last initial)
- Market + property type
- Intent score (0–100)
- One-line behavioural signal ("Mortgage pre-app · 3d")
- Price (tiered from intent score)
- "Buy lead →" button

Live ticker at the top shows recent purchases. 30s CDN cache so the
list feels fast.

### 2. Lead detail — `/marketplace/[id]`
Click any lead. Two states:
- **Not purchased**: masked PII ("•••••@•••••.com (revealed on purchase)"),
  big price tile, "Sign in to buy" or "Buy lead — $X" CTA
- **Purchased**: full name, email, phone, address, intent overlay,
  Stripe receipt URL

### 3. Buyer surfaces — `/marketplace/buyer/*`
- `/buyer/sign-in` — email-only magic-link form
- `/buyer` — dashboard with: leads purchased, total spent, active
  streams, full purchase history with PII
- `/buyer/streams` — saved-filter management (auto-buy every match)

### 4. Seller surfaces — `/marketplace/seller/*`
- `/seller/sign-in` — magic-link form (separate cookie from buyers)
- `/seller` — dashboard with: contributed/sold counts, lifetime accrued,
  **unpaid balance** (what we owe Ryan), recent sales feed, payout history
- `/seller/import` — two-tab importer: **CSV upload** or **Cursive segment**

### 5. Agency admin — `/admin/marketplace`
LeaseStack ops controls the master pool:
- List every `MarketplaceSyncSource`
- Add new platform-direct sources (no seller attribution)
- "Sync now" button per source
- Per-source last-3-runs + lead counts

---

## End-to-end demo flow for the video (suggested order)

1. **Browse** — open `/marketplace`, show ~50K Texas/CA/FL leads, play
   with filters (slide intent up to 90, drop price band to under $100,
   pick "Sale", market "Texas")
2. **Detail page** — click a card, point at the masked PII + scoring + price
3. **Sign in as buyer** — click "Sign in to buy", enter email, show
   "check your inbox", open magic-link email, click → land back as
   authenticated buyer
4. **Checkout** — click "Buy lead — $XX", redirect to Stripe Checkout,
   pay with Stripe test card (`4242 4242 4242 4242`)
5. **Receipt** — Stripe redirects to `/marketplace/buyer/purchases/{session_id}`,
   buyer dashboard shows the purchased lead with full PII revealed; email
   arrives with name/email/phone/address/intent overlay
6. **Streams** — go to `/marketplace/buyer/streams`, create a saved
   filter ("Texas SALE intent ≥85 max $100, $500/wk budget"), show
   it appears on the dashboard
7. **Sign out** — back to public marketplace
8. **Sign in as seller** — open a new email (or sign in to existing
   account) at `/marketplace/seller/sign-in`, click magic link
9. **Seller dashboard** — empty state, "Import leads →"
10. **CSV import** — drag in a CSV (template below), watch parsing,
    "Import 1,247 leads", see them appear on dashboard with statuses
11. **Cursive import** — switch to second tab, paste the audience UUID
    (`ba8c9817-f91c-4955-b2b0-53b933a15f7d`), pick Sale + United States,
    hit "Wire segment + sync now", watch ~49K leads ingest with seller
    attribution
12. **First sale** — back to public marketplace (incognito), buy one of
    Ryan's leads, complete checkout
13. **Seller dashboard refresh** — show "Recent sales" tile populated,
    `+$X.XX` credited to seller, **Unpaid balance** updated, totals tick
14. **Admin marketplace** — open `/admin/marketplace`, point out the
    sources table including the seller's source, "Sync now" button

---

## Data model

| Table | Purpose | Key fields |
|---|---|---|
| `MarketplaceSyncSource` | Where leads come from (Cursive seg, audience, manual) | `kind`, `externalId`, `baselineScore`, `defaultPriceCents` |
| `MarketplaceSyncRun` | Replenishment audit log | `status`, `fetchedCount`, `upsertedCount`, `newCount`, `expiredCount` |
| `MarketplaceLead` | The sellable lead | `intentScore`, `priceCents`, `status` (AVAILABLE/RESERVED/SOLD/EXPIRED), `sellerId` (nullable) |
| `MarketplaceBuyer` | Buyer account (magic-link) | `email`, `stripeCustomerId`, `webhookUrl` |
| `MarketplacePurchase` | One buyer-buys-a-lead transaction | `status` (PENDING/PAID/REFUNDED/FAILED), `sellerShareCents`, `platformShareCents` |
| `MarketplaceStream` | Saved buyer filter for auto-purchase | `market`, `propertyType`, `minIntent`, `maxPriceCents`, `weeklyBudgetCents` |
| `MarketplaceSeller` | Seller account (magic-link, separate cookie) | `email`, `revShareBps` (default 7000 = 70%), `unpaidOwedCents` |
| `MarketplaceSellerPayout` | Payout history | `amountCents`, `status` (PENDING/PAID/FAILED), `stripeTransferId` |

---

## Revenue split

Every `MarketplaceLead` carries an optional `sellerId`. When a buyer
purchases a lead:

1. Stripe `checkout.session.completed` webhook fires
2. The handler reads the lead's `sellerId` and the seller's current
   `revShareBps` (default 70/30 in seller's favor)
3. The split is **snapshotted** onto the purchase row
   (`sellerShareCents`, `platformShareCents`) — so future changes to
   `revShareBps` don't retroactively affect prior sales
4. Seller's `accruedCents` and `unpaidOwedCents` both increment by the
   seller share
5. Seller dashboard immediately reflects the new sale

Platform-direct leads (no `sellerId`) keep 100% on the platform.

### Payouts
A `MarketplaceSellerPayout` row tracks each disbursement. For now
payouts are recorded manually — Phase 2c will automate this via Stripe
Connect (the `stripeConnectAccountId` field on `MarketplaceSeller` is
ready for it).

---

## Scoring

`lib/marketplace/scoring.ts` computes a 0–100 composite from five
weighted dimensions:

| Component | Cap | Signals |
|---|---|---|
| Recency | 25 | Time since `lastSeenAt` |
| Search depth | 25 | `listingsViewed7d` |
| Segment fit | 20 | Real estate / buyer / mover segment memberships |
| Verification | 15 | Verified email + phone + address |
| Urgency | 15 | Mortgage pre-app, cash buyer, scheduled tour, relocating, distressed |

A `baselineScore` on the source bumps every member to a minimum floor
so identity-only segments (your Cursive audience) still produce
sellable leads. The default for the "high-intent buyers & sellers"
shape is 70.

## Pricing

`tierPrice()` scales the source's `defaultPriceCents` by intent:

| Intent | Multiplier | $75 base | $50 base |
|---|---|---|---|
| 90+ | 2.0x | $150 | $100 |
| 80–89 | 1.5x | $115 | $75 |
| 70–79 | 1.2x | $90 | $60 |
| 60–69 | 1.0x | $75 | $50 |
| <60 | 0.7x | $55 | $35 |

Always rounded to nearest $5.

## Replenishment

A weekly cron at `/api/cron/marketplace-replenish` (Mondays 06:00 UTC)
iterates every enabled source, pulls the latest member list, re-scores
everyone, and reaps leads past their `expiresAt` (14 days after last
enrichment).

For sellers using the **CSV path**, freshness is up to them — re-upload
to refresh. For the **Cursive path**, the cron handles it automatically.

---

## API surface

### Public (no auth)
- `GET /api/marketplace/leads` — paginated, filterable browse

### Buyer auth
- `POST /api/marketplace/auth/request` — request magic link
- `GET /api/marketplace/auth/verify?token=…` — exchange for session
- `POST /api/marketplace/auth/sign-out`

### Buyer (authenticated)
- `POST /api/marketplace/leads/[id]/checkout` — start Stripe Checkout
- `GET/POST /api/marketplace/streams` — list/create streams

### Seller auth
- `POST /api/marketplace/seller-auth/request`
- `GET /api/marketplace/seller-auth/verify?token=…`
- `POST /api/marketplace/seller-auth/sign-out`

### Seller (authenticated)
- `POST /api/marketplace/seller/import-csv` — body: `{ rows: CsvRow[] }`
- `POST /api/marketplace/seller/import-cursive` — wire a segment + sync

### Admin (Clerk-protected, `requireAdmin`)
- `GET/POST /api/admin/marketplace/sources`
- `POST /api/admin/marketplace/sync-now`

### Cron + webhook
- `GET /api/cron/marketplace-replenish` (Bearer `CRON_SECRET`)
- `POST /api/webhooks/stripe/marketplace` (Stripe signature)

---

## Required env vars (production)

```
# Stripe (existing)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...           # for the marketplace webhook
CRON_SECRET=...                           # for the replenish cron

# Marketplace-specific
MARKETPLACE_AUTH_SECRET=<32+ chars>       # falls back to ENCRYPTION_KEY

# Cursive (existing)
CURSIVE_API_KEY=...
CURSIVE_API_URL=https://api.audiencelab.io

# Resend (existing)
RESEND_API_KEY=...
RESEND_FROM_EMAIL=team@leasestack.co
```

## Stripe webhook setup

In Stripe Dashboard → Webhooks → Add endpoint:
- URL: `https://leasestack.co/api/webhooks/stripe/marketplace`
- Events: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`

---

## CSV template for the seller upload demo

```csv
firstName,lastName,email,phone,city,state,postalCode,propertyType,signal,timeline,listingsViewed7d,hasMortgagePreApp,hasScheduledTour,budgetMinCents,budgetMaxCents,budgetUnit
Marisol,Reyes,m.reyes@example.com,+19175550142,Brooklyn,NY,11215,SALE,Viewed 23 listings,0-30 days,23,true,false,68000000,92000000,ABS
Derek,Chen,derek.chen@example.com,+13055550118,Miami,FL,33139,SALE,Mortgage pre-app,30-60 days,11,true,false,140000000,210000000,ABS
Aisha,Salinas,aisha.s@example.com,+13105550377,Los Angeles,CA,90048,RENTAL,5 tours scheduled,0-14 days,18,false,true,380000,520000,MONTHLY
Tyler,Grant,tyler.g@example.com,+15125550289,Austin,TX,78704,INVESTMENT,Cash buyer signal,0-45 days,8,false,false,42000000,62000000,ABS
Rohan,Nair,rohan.n@example.com,+16175550450,Boston,MA,02116,SALE,Relocation - job offer,30-90 days,6,false,false,110000000,160000000,ABS
```

Save as `demo-leads.csv` and use it for the CSV upload demo step.

---

## What's NOT in this build (Phase 2b/2c targets)

- **Stream auto-purchase cron** — saved streams render and match
  conceptually but the cron that fires Stripe charges against saved
  payment methods isn't wired yet. Manual purchase still works.
- **Webhook delivery to buyer CRMs** — `MarketplaceBuyer.webhookUrl`
  exists but the delivery cron isn't built.
- **Dispute / refund self-service** — refunds today require a Stripe
  Dashboard refund (the webhook handles `charge.refunded` correctly).
- **Stripe Connect for seller payouts** — `stripeConnectAccountId`
  field exists; the actual onboarding flow + transfer logic is Phase 2c.
  Today payouts are tracked manually and `MarketplaceSellerPayout` rows
  are created by an admin.
- **Lead refresh from CSV path** — sellers re-upload to refresh; no
  weekly cron for CSV imports (only Cursive sources auto-refresh).

---

## File map

```
lib/marketplace/
  scoring.ts           composite 0-100 scoring
  cursive-sync.ts      pull Cursive segment + upsert leads
  seller-ingest.ts     CSV + seller-attributed Cursive ingest
  repo.ts              masked vs full-PII queries
  auth.ts              buyer magic-link auth + signed session cookie
  seller-auth.ts       seller magic-link auth (separate cookie)
  emails.ts            sign-in + lead-delivery transactional emails
  csv-client.ts        client-safe CSV parser (no deps)

app/
  marketplace/
    layout.tsx                 buyer/seller chrome
    page.tsx                   public browse
    [id]/page.tsx              lead detail (masked vs full)
    buyer/
      sign-in/page.tsx
      page.tsx                 buyer dashboard
      streams/page.tsx         stream CRUD
    seller/
      sign-in/page.tsx
      page.tsx                 seller dashboard
      import/page.tsx          CSV + Cursive import
  admin/marketplace/page.tsx   agency-admin source mgmt
  api/marketplace/
    leads/route.ts             GET browse
    leads/[id]/checkout/route.ts  POST Stripe Checkout
    auth/{request,verify,sign-out}/route.ts
    seller-auth/{request,verify,sign-out}/route.ts
    seller/{import-csv,import-cursive}/route.ts
    streams/route.ts
  api/admin/marketplace/
    sources/route.ts           list + create
    sync-now/route.ts          manual trigger
  api/cron/marketplace-replenish/route.ts
  api/webhooks/stripe/marketplace/route.ts

components/marketplace/
  marketplace-live.tsx         the public browse UI
  sign-in-form.tsx             buyer magic-link
  seller-sign-in-form.tsx      seller magic-link
  buy-lead-button.tsx          Stripe Checkout trigger
  stream-form.tsx              buyer stream creation
  seller-import-tabs.tsx       CSV + Cursive import UI
components/admin/
  marketplace-source-form.tsx
  marketplace-source-list.tsx
```
