# Repo Audit - TBGC Order Portal MVP

**Audited:** 2026-02-23
**Framework:** Next.js 16.1.6 (App Router) + React 19.2.4
**Package manager:** pnpm
**Styling:** Tailwind CSS 4.2 + shadcn/ui (60+ components)
**TypeScript:** Strict mode enabled
**Hosting:** Vercel (analytics included)

## Routes / Pages

| Route | Purpose | Data Source |
|-------|---------|-------------|
| `/` | Marketplace - product catalog with search/filter | `lib/products.ts` (hardcoded) |
| `/checkout` | Order form (business name, contact, delivery) | Cart context (localStorage) |
| `/confirmation` | Order confirmation display | `localStorage.lastOrder` |
| `/client-portal` | Login page (mock auth) | Hardcoded "ritzcarlton" |
| `/client-portal/dashboard` | Dashboard: stats, orders, meetings, deals | `lib/client-data.ts` |
| `/client-portal/invoices` | Invoice list with detail modals | Hardcoded |
| `/client-portal/messages` | Message thread UI | Hardcoded conversations |
| `/client-portal/analytics` | Charts (recharts) - spending, categories | Hardcoded |
| `/client-portal/payments` | Payment history + methods + make payment | Hardcoded |

## Data Layer

- **ALL FAKE DATA** - everything hardcoded in `lib/products.ts` and `lib/client-data.ts`
- **Products:** 33 items across 9 categories (truffles, caviar, butters, oils, salumi, seasonings, preserved, accessories)
- **Client data:** Single demo client (Ritz-Carlton) with orders, meetings, deals, invoices, conversations, payments
- **Cart state:** React Context (`lib/cart-context.tsx`) persisted to localStorage
- **Auth:** Mock login - `sessionStorage` with hardcoded "ritzcarlton" username

## Key Components

| Component | Purpose |
|-----------|---------|
| `ProductCard` | Product display with add-to-cart |
| `CartSidebar` | Slide-out cart sheet |
| `PortalNav` + `PortalLayout` | Sidebar nav for client portal (desktop + mobile) |
| `MobileNav` | Hamburger menu for marketplace |
| `ThemeProvider` | next-themes (imported but not active in layout) |

## What Blocks Production

1. **No real auth** - sessionStorage mock only
2. **No database** - all data hardcoded in TS files
3. **No payment processing** - checkout simulates with `setTimeout`
4. **No API routes / server actions** - everything client-side
5. **No email/notifications** - none
6. **No admin panel** - none
7. **TS build errors ignored** in `next.config.mjs`
8. **No error boundaries** (beyond basic loading spinners)
9. **No tests**
10. **No CI/CD pipeline**

## What's Good (Keep)

- Clean UI with consistent shadcn/ui components
- Responsive design (mobile + desktop)
- Product catalog with search + category filtering
- Full client portal layout with sidebar nav
- Rich data models in `lib/client-data.ts` (good schema reference)
- Cart with localStorage persistence
- Recharts integration for analytics
