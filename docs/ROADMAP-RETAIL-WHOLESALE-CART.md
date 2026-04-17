# TBGC — Retail vs Wholesale + Abandoned Cart Roadmap

## Overview

Two parallel tracks:
- **Track A**: Abandoned cart email recovery
- **Track B**: Retail vs Wholesale account differentiation

---

## Track A: Abandoned Cart Recovery

### Context
- Cart is currently localStorage-only (`lib/cart-context.tsx`)
- `SavedCart` model already exists in Prisma schema but is unused for the main cart
- Need to sync cart to DB so cron job can detect abandonment

### A1 — Schema change
```prisma
// Add to SavedCart
lastAbandonmentEmailAt DateTime?
```

### A2 — Cart sync API
- `POST /api/cart/sync` — upsert SavedCart for logged-in user
- `DELETE /api/cart/sync` — clear on checkout
- Only fires if user is signed in (Clerk)

### A3 — Update cart-context.tsx
- Add `useUser()` hook
- On every `items` change (debounced 1s), call `POST /api/cart/sync` if user signed in
- On `clearCart()`, call `DELETE /api/cart/sync`
- On mount, if user signed in, merge DB cart into localStorage cart

### A4 — Cron job
- `/api/cron/abandoned-carts` (GET, secured with `CRON_SECRET` header)
- Query: SavedCart where `updatedAt < now - 2hr` AND items not empty AND no checkout in 24hr AND `lastAbandonmentEmailAt` is null or `< now - 48hr`
- For each: load user email, send email, update `lastAbandonmentEmailAt`

### A5 — Email template
In `lib/email/index.ts`:
```
sendAbandonedCartEmail({ email, name, items, cartUrl })
```
Subject: `"wanna bump" this to the top of your inbox 👀`
Body: Creative copy reminding them + item list + checkout link

### A6 — Vercel cron config
`vercel.json`:
```json
{
  "crons": [{ "path": "/api/cron/abandoned-carts", "schedule": "0 10,14,18 * * *" }]
}
```

---

## Track B: Retail vs Wholesale Differentiation

### Context
- All users currently get CLIENT role via Clerk
- `Organization.isWholesaler` field exists (just added)
- Pricing is tier-based (NEW/REPEAT/VIP) via PricingRule
- Wholesale buyers need different pricing + Net-30 terms + pre-approval

### B1 — Schema: WholesaleApplication
```prisma
model WholesaleApplication {
  id               String   @id @default(cuid())
  businessName     String
  contactName      String
  email            String
  phone            String
  website          String?
  taxId            String?
  businessType     String   // "restaurant", "hotel", "retailer", "distributor", etc.
  yearsInBusiness  String?
  monthlyVolume    String?  // "$500-$1k", "$1k-$5k", etc.
  notes            String?
  status           WholesaleStatus @default(PENDING)
  reviewNotes      String?
  reviewedBy       String?  // userId
  reviewedAt       DateTime?
  convertedOrgId   String?  // set on approval
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([status, createdAt(sort: Desc)])
}

enum WholesaleStatus {
  PENDING
  APPROVED
  REJECTED
  WAITLISTED
}
```

### B2 — Public application form
- Route: `/wholesale/apply`
- Fields: business name, contact name, email, phone, website, business type (dropdown), EIN/tax ID, years in business, estimated monthly volume, notes
- On submit: `POST /api/wholesale/apply`
- Success: "Application received! We review within 48 hours."

### B3 — Admin review queue
- Route: `/admin/wholesale`
- Shows pending applications sorted by date
- Quick approve/reject buttons per row
- Route: `/admin/wholesale/[id]` — full detail view

### B4 — Approve flow (API: PATCH /api/admin/wholesale/[id])
On approval:
1. Create `Organization` with `isWholesaler = true`, `tier = VIP`, payment terms = `Net-30`
2. Set `convertedOrgId` on application
3. Update application status to APPROVED
4. Send Clerk invitation to their email via `clerkClient.invitations.createInvitation()`
5. Send welcome email via Resend
6. Create AuditEvent

On rejection:
1. Update status to REJECTED
2. Send rejection email (polite, invite to reapply)

### B5 — Wholesale pricing in catalog
- Product pages currently show flat price from DB
- For logged-in wholesalers: show "Wholesale: $X.XX" price (discounted)
- On product listing and product detail pages
- Use `getDiscountForOrg` which already handles VIP tier discounts
- Admin can set VIP discount via PricingRule to define wholesale discount %

### B6 — Checkout differentiation
- `createOrder` already calls `getDiscountForOrg` — wholesale orgs on VIP tier get discounts automatically
- Checkout page shows "Wholesale Account" badge if `isWholesaler`
- Net-30 invoicing is already built

### B7 — Client portal differentiation
- Retail portal: no changes
- Wholesale portal: show wholesale pricing, net-30 terms badge

### B8 — Redirect logic
- If a non-approved user tries to access `/wholesale` areas → redirect to `/wholesale/apply`
- Wholesale navigation link in marketing header → `/wholesale`

---

## Execution Order

1. **A1-A6**: Cart abandonment (schema → API → email → cron) — ~1-2 hours dev
2. **B1-B4**: Wholesale application + admin review — ~2-3 hours dev  
3. **B5-B8**: Wholesale pricing + portal changes — ~1-2 hours dev

---

## Environment Variables Needed

```
# Cron job security
CRON_SECRET=<random-32-char-secret>

# Already configured
RESEND_API_KEY=<your-resend-key>
NEXT_PUBLIC_APP_URL=<your-domain>
```

