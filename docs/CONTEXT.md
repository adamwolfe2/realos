# TBGC - Product Context

## What is TBGC?

**Truffle Boys & Girls Club** is a SoCal-based luxury food distributor specializing in fresh truffles, caviar, salumi, and gourmet specialty products. They supply Michelin-starred restaurants, hotels, private chefs, and fine dining establishments.

## Business Facts

- 342+ wholesale client accounts
- 22-person sales team
- 46K Instagram followers
- Products: 200+ SKUs across truffles, caviar, duck, wagyu, salumi, pantry items
- Operations currently run off the CEO's phone
- Existing Shopify consumer site at truffleboys.com

## What We're Building

A **custom B2B order portal + client management system** that replaces phone-based operations with a self-serve digital platform.

### Users & Roles

| Role | Jobs-to-be-done |
|------|-----------------|
| **Chef / Purchaser** | Browse catalog, place orders, reorder, view invoices |
| **AP / Accounting** | Pay invoices, manage payment methods, view statements |
| **Owner / GM** | Manage team users, approve large orders, view spend |
| **Sales Rep** | Manage accounts, build orders for clients, send quotes |
| **Ops / Fulfillment** | Pick/pack/ship, manage substitutions, delivery scheduling |
| **Admin / Finance** | Manage catalogs/tiers, payment terms, reporting |

### Core Flows

1. **Browse → Cart → Checkout → Order → Payment → Fulfillment**
2. **Client Portal:** Dashboard, Orders, Invoices, Payments, Messages, Analytics
3. **Admin:** Account management, product/pricing management, order ops

## What Exists Today (MVP)

- Next.js 16 marketplace with 33 products and category filtering
- Client portal with dashboard, invoices, messages, analytics, payments
- All data is hardcoded (no database, no auth, no payments)
- Beautiful UI with shadcn/ui — ready to wire to real data

## What's Missing for Production

- Real authentication (Clerk)
- Database (Postgres via Neon + Prisma)
- Payment processing (Stripe)
- Email notifications (Resend)
- Admin panel
- Real product/order/client data
- API routes or server actions

## Non-Goals (For Now)

- Cold outbound email campaigns
- Marketing automation (ManyChat, Instantly)
- Call recording / sales intelligence
- Shopify integration (we ARE the custom portal)
- Mobile native apps
- Multi-language support
