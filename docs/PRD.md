# Truffle Boys & Girls Club — Executive Product Summary

**Prepared for:** TBGC Leadership
**Date:** February 23, 2026
**Version:** 1.0

---

## What We Built

We built a **custom B2B wholesale ordering platform and client management system** for Truffle Boys & Girls Club. This replaces the current phone-based, manual ordering process with a professional, self-service digital platform that your clients, sales team, and operations staff can all use from any device.

Think of it as your own private ordering portal — purpose-built for luxury food distribution — where your restaurant clients can browse your catalog, place orders, pay invoices, and track deliveries, while your team manages everything from a single admin dashboard.

This is not a generic template. Every screen, every workflow, and every integration was designed specifically around how TBGC operates today and how you want to operate tomorrow.

---

## The Problem This Solves

| Before (Manual) | After (TBGC Portal) |
|---|---|
| Orders come in via phone calls, texts, and DMs | Clients place orders themselves through a branded catalog |
| Pricing lives in spreadsheets and the CEO's head | Products, pricing, and availability are managed in one system |
| Invoices are tracked manually | Invoices are generated automatically and tied to orders |
| No visibility into who ordered what, when | Full order history, spending analytics, and audit trail |
| Sales reps juggle client info across apps | One CRM-style client management panel |
| No way for clients to self-serve | Clients get their own portal with orders, invoices, and analytics |
| Payment collection is inconsistent | Stripe handles cards and ACH transfers securely |
| Communication is scattered across iMessage/email | Centralized notifications via email and iMessage/SMS through Linq |

---

## Who Uses It — And How It Helps Them

### Your Clients (Chefs, Purchasers, Restaurant GMs)

Your clients — the 342+ restaurants, hotels, and private chefs you serve — get their own **Client Portal** where they can:

- **Browse the full product catalog** with search, category filters, and real-time pricing
- **Place orders** by adding items to a cart and checking out — just like any online store, but wholesale
- **Pay securely** via credit card or ACH bank transfer through Stripe
- **View their order history** with status tracking (Pending → Confirmed → Packed → Shipped → Delivered)
- **Review invoices** and see what's paid, what's pending, and what's overdue
- **Track their spending** with monthly charts, top products, and average order value
- **Message your team** directly through the portal
- **Reorder previous orders** with one click instead of starting from scratch

This means less time on the phone for your clients and fewer missed or incorrect orders for your team.

### Your Sales Team

Your 22-person sales team gets an **Admin Dashboard** where they can:

- **See everything at a glance** — total orders, revenue, pending actions, new clients, and recent activity all on one screen
- **Manage all orders** — search, filter by status, view order details, and update status through the fulfillment pipeline
- **Update orders in bulk** — select multiple orders and change their status at once (great during busy mornings)
- **Manage clients** — view every client organization, their tier (New, Repeat, VIP), order count, contact info, and full history
- **Drill into any client** — see their orders, invoices, members, addresses, total spend, and account details on one page
- **Change client tiers** — promote clients to Repeat or VIP status directly from their profile
- **Send notifications** — trigger iMessage/SMS or email notifications to clients about their orders with one click

### Your Operations Team

The ops and fulfillment team can:

- **Track order status** through a clear pipeline: Pending → Confirmed → Packed → Shipped → Delivered
- **Process orders visually** — each order shows a progress bar so you can see exactly where it is
- **Cancel orders** with a confirmation dialog to prevent mistakes
- **Export order data to CSV** for use in spreadsheets, accounting, or shipping manifests
- **Get notified automatically** when new orders come in (both email and iMessage/SMS)

### Admin / Finance

The back-office team has tools to:

- **Generate invoices** from any uninvoiced order with one click (auto-calculated totals and due dates)
- **Manage invoice status** — mark invoices as Paid, Pending, or Overdue
- **View financial analytics** — monthly revenue charts, top clients by spend, order status breakdown, product category distribution
- **Manage the product catalog** — add products individually or import hundreds at once via CSV upload
- **Edit products inline** — change prices, minimum orders, and availability with a click
- **Toggle product flags** — mark items as Market Rate, Prepay Required, or Cold Chain Required
- **Monitor all integrations** — see at a glance which services (Stripe, Linq, Resend, Clerk) are connected and working
- **View the full audit trail** — every order, payment, status change, and user action is logged automatically

---

## Complete Feature List

### Public-Facing Pages

| Feature | Description |
|---|---|
| **Product Marketplace** | Full catalog with 200+ products, search bar, category tabs (Truffles, Caviar, Salumi, etc.), product cards with pricing, and add-to-cart functionality |
| **Shopping Cart** | Slide-out cart sidebar with quantity controls, running total, and checkout button |
| **Partner Application** | "Become a Partner" page where new businesses apply for a wholesale account — collects business info, product interests, estimated volume, and delivery details |
| **Website Auto-Fill** | When a partner enters their website URL, the system automatically pulls their company name, email, phone, and logo to save time |
| **Secure Checkout** | Full checkout flow with business name, contact info, delivery address, order notes, and Stripe payment |
| **Order Confirmation** | Post-purchase confirmation page with order number and next steps |

### Client Portal (Authenticated)

| Feature | Description |
|---|---|
| **Dashboard** | Welcome screen with total spend, order count, average order value, account manager info, recent orders, monthly spending chart, and top products table |
| **Order History** | Full list of all past orders with status badges, date, total, and item count — click any order to see full details |
| **Order Detail** | Complete breakdown of every order: items, quantities, pricing, status timeline, payment info, and shipping address |
| **Invoices** | View all invoices with status (Draft, Pending, Paid, Overdue), amounts, due dates, and totals |
| **Payments** | Payment history showing all transactions, amounts, methods, and statuses |
| **Messages** | Communication channel with your team |
| **Analytics** | Spending insights: 7-month spend, average monthly, top category, order frequency, spending trend chart, spending by category pie chart, and order frequency graph |
| **Reorder** | One-click reorder from any previous order |

### Admin Panel

| Feature | Description |
|---|---|
| **Admin Dashboard** | KPI cards (orders, revenue, clients, products), pending action alerts, order status breakdown, recent orders feed, new clients list, and activity feed |
| **Order Management** | Searchable and filterable order table with pagination (20 per page), bulk status updates, checkbox selection, and CSV export |
| **Order Detail** | Full order view with progress pipeline, status control buttons, notification triggers, line items, payment history, timeline/audit log, and client info |
| **Cancel Confirmation** | Dedicated confirmation dialog before cancelling orders to prevent accidental cancellation |
| **Client Management** | Searchable client table with tier badges, contact info, payment terms, and order count |
| **Client Detail** | 360-degree client view: KPI cards (total orders, revenue, delivered, average value), tier control, contact info, addresses, team members, order history, invoices |
| **Tier Management** | Promote/demote client organizations between New, Repeat, and VIP tiers |
| **Product Catalog** | Full product table with inline editing for price and minimum order, availability toggle, and product flags (market rate, prepay, cold chain) |
| **Product Creation** | Add individual products with all fields (name, price, unit, category, description, minimum order, packaging, flags) |
| **CSV Product Import** | Bulk upload products via CSV/spreadsheet — existing products matched by name are updated, new ones are created |
| **Invoice Management** | Generate invoices from uninvoiced orders, update invoice status, view KPI summary (total, paid, pending, overdue) |
| **Analytics Dashboard** | Revenue charts (monthly bar chart), top clients by revenue, order status pie chart, product category distribution, and 5 KPI cards |
| **Command Palette** | Press Cmd+K (or Ctrl+K) to instantly search and jump to any admin page, create new items, or trigger exports — like Spotlight for your admin panel |
| **Settings** | Integration status dashboard showing which services are connected, webhook URL configuration with copy buttons, and quick links to external dashboards |
| **Send Notifications** | One-click iMessage/SMS and email notifications to clients about order updates — built into order and client detail pages |

### Technical Infrastructure

| Feature | Description |
|---|---|
| **User Authentication** | Secure sign-in/sign-up powered by Clerk with email + password and social login options |
| **Role-Based Access** | Four roles — Client, Sales Rep, Ops, Admin — each seeing only what they need |
| **Route Protection** | Every authenticated page is protected by middleware — no one can access pages they shouldn't |
| **Secure Payments** | Stripe Checkout for credit cards and ACH bank transfers, with webhook verification for payment confirmation |
| **Automated Emails** | Order confirmation, shipped notification, delivered notification, invoice emails, welcome emails, and internal ops alerts — all sent automatically through Resend |
| **iMessage & SMS** | Client notifications via iMessage (with automatic SMS fallback) through the Linq Partner API — order confirmations, shipping updates, delivery alerts, and invoice reminders |
| **Webhook Security** | All incoming webhooks (Stripe, Clerk, Linq) are cryptographically verified to prevent tampering |
| **Audit Trail** | Every state change in the system (order created, status changed, payment received, tier updated) is logged with timestamp and user info |
| **Database Indexing** | Optimized queries across orders, payments, users, and invoices for fast page loads even as data grows |
| **Skeleton Loading** | Every page shows a smooth loading skeleton that matches the actual page layout while data loads — no blank screens or spinner confusion |
| **Micro-Animations** | Subtle fade-in effects, staggered card animations, and hover transitions throughout the interface for a polished, premium feel |
| **Monochrome Design** | Consistent black-and-white design language across all status badges, charts, and UI elements — clean and professional |
| **Mobile Responsive** | Every page is designed to work on phones, tablets, and desktops with a mobile navigation menu |
| **CSV Export** | Export order data to CSV for use in external tools, accounting software, or delivery planning |

---

## Technology Stack (Plain English)

| What | Tool | Why It Matters |
|---|---|---|
| **The Application** | Next.js 16 (hosted on Vercel) | Modern, fast web framework — pages load instantly, works on any device, deploys automatically |
| **User Interface** | shadcn/ui + Tailwind CSS | 60+ professional UI components — buttons, tables, charts, dialogs — consistent look throughout |
| **User Accounts** | Clerk | Handles sign-up, sign-in, password reset, and user roles — enterprise-grade security out of the box |
| **Database** | PostgreSQL on Neon | Your data (orders, products, clients, invoices) lives in a secure, scalable cloud database |
| **Data Management** | Prisma ORM | The layer between your app and database — ensures data integrity and makes queries fast |
| **Payments** | Stripe | Industry-standard payment processing for credit cards and bank transfers — PCI compliant |
| **Email** | Resend | Sends beautiful transactional emails (order confirmations, shipping notifications, invoices) |
| **Messaging** | Linq Partner API v3 | Sends iMessage and SMS notifications to clients — more personal than email, higher open rates |
| **Charts** | Recharts | Clean, interactive charts for analytics dashboards |
| **Hosting** | Vercel | Automatic deployments, global CDN, preview environments for every change |

---

## How Each Role Interacts With the System

```
CLIENT (Chef / Purchaser / GM)
  → Browses catalog → Adds to cart → Checks out → Pays via Stripe
  → Views orders, invoices, payments, analytics in Client Portal
  → Receives email + iMessage notifications on order updates

SALES REP
  → Manages client accounts and tiers
  → Reviews orders and updates statuses
  → Sends targeted notifications to clients
  → Views client spending history and analytics

OPS / FULFILLMENT
  → Processes orders through the pipeline (Confirm → Pack → Ship → Deliver)
  → Bulk-updates order statuses during peak hours
  → Exports order data for logistics planning
  → Receives internal alerts on new orders

ADMIN / FINANCE
  → Manages product catalog and pricing
  → Generates and tracks invoices
  → Monitors revenue and business analytics
  → Oversees all integrations and system settings
```

---

## The Order Lifecycle

Here's exactly what happens when a client places an order:

1. **Client browses** the product catalog and adds items to their cart
2. **Client checks out** — fills in delivery details and clicks "Proceed to Payment"
3. **Stripe processes payment** — client pays via credit card or ACH
4. **Order is created** in the database with status "Pending"
5. **Confirmation email** is sent automatically to the client
6. **iMessage notification** is sent to the client's phone
7. **Internal alert** is sent to the ops team
8. **Admin reviews** the order and clicks "Confirm" — status updates to Confirmed
9. **Ops packs** the order — status updates to Packed
10. **Order ships** — status updates to Shipped, client gets a shipping notification
11. **Order delivered** — status updates to Delivered, client gets a delivery confirmation
12. **Invoice generated** — admin creates an invoice tied to the order
13. **Everything is logged** — every step is recorded in the audit trail

---

## What's Ready Today vs. What's Next

### Built and Ready (Current Release)

Everything described above is built, tested, and deployable. The system compiles with zero errors and has been through a full quality audit covering security, performance, and code quality.

### Potential Future Enhancements

These are features that could be added to extend the platform as the business grows:

| Feature | What It Would Do | Who It Helps |
|---|---|---|
| **Reorder & Saved Carts** | Let clients save favorite orders and reorder with one click | Clients |
| **Quote Builder** | Sales reps create custom quotes for prospects before they have accounts | Sales Team |
| **Credit Limit Enforcement** | Automatically block orders that exceed a client's credit limit | Finance |
| **Tax Calculation** | Auto-calculate sales tax based on delivery address | Finance |
| **Substitution Workflow** | When a product is unavailable, suggest alternatives before shipping | Ops |
| **Delivery Scheduling** | Let clients pick preferred delivery windows | Clients / Ops |
| **Favorites / Quick-Add** | Clients mark frequently ordered products for faster ordering | Clients |
| **Rep Dashboard** | Dedicated view for sales reps showing their assigned accounts, tasks, and pipeline | Sales Team |
| **Marketing Landing Pages** | SEO-optimized public pages showcasing products, company story, and press | Marketing |
| **Seasonal Collections** | Curated product groups for truffle season, holiday menus, etc. | Sales / Clients |
| **PostHog Analytics** | Product analytics tracking how users navigate the portal, what they search for, and where they drop off | Leadership |
| **Sentry Error Tracking** | Automatic error detection and alerting when something breaks in production | Engineering |
| **Mobile Native App** | A dedicated iOS/Android app for even faster ordering on the go | Clients |
| **Multi-Location Support** | Clients with multiple restaurants can manage orders per location | Clients |
| **Automated Payment Reminders** | Auto-send invoice reminders as due dates approach | Finance |
| **Shopify Sync** | Connect consumer Shopify store with wholesale portal for unified inventory | Ops |

---

## Security & Compliance

The platform was built with security as a priority:

- **All user sessions** are managed by Clerk (enterprise-grade auth provider)
- **All payments** are processed by Stripe (PCI DSS Level 1 compliant)
- **All webhooks** are cryptographically verified (HMAC-SHA256) to prevent spoofing
- **All routes** are protected by middleware — unauthenticated users cannot access any portal pages
- **Role-based access control** ensures clients only see their own data, sales reps see their accounts, and only admins access system settings
- **Audit logging** records every significant action with timestamps and user IDs
- **No secrets in code** — all API keys and credentials are stored as environment variables
- **Input validation** at all system boundaries using Zod schema validation
- **TypeScript strict mode** catches potential bugs before they reach production (0 type errors)

---

## Summary

This platform transforms TBGC from a phone-based operation into a modern, self-service wholesale business. Your clients get a premium ordering experience that matches the quality of your products. Your team gets the tools to manage orders, clients, and finances efficiently. And the business gets complete visibility into every order, payment, and client interaction.

The system is built on industry-standard technology, designed to scale as you grow, and ready to deploy.

---

*Built with Next.js 16, React 19, TypeScript, Prisma, PostgreSQL, Stripe, Clerk, Resend, Linq, and shadcn/ui.*
*Hosted on Vercel with automatic deployments and global CDN.*
