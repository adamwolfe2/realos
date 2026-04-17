# TBGC - Technology Stack

## Chosen Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 16 (App Router) | Already in use. SSR + server actions. |
| **Language** | TypeScript (strict) | Already in use. Type safety. |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Already in use. 60+ components. |
| **Auth** | Clerk | Fastest to implement. Handles roles, SSR, middleware. Free tier = 10K MAU. |
| **Database** | Postgres (Neon) | Serverless Postgres. Branching for dev/preview. Free tier generous. |
| **ORM** | Prisma | Type-safe queries. Migrations. Seeding. Industry standard. |
| **Payments** | Stripe | ACH ($5 cap), cards, checkout sessions, invoicing. Industry standard. |
| **Email** | Resend | Simple API. React Email templates. Free tier = 100 emails/day. |
| **Hosting** | Vercel | Already configured. Edge functions. Preview deploys. |
| **Analytics** | Vercel Analytics (now) → PostHog (later) | Already included. PostHog for product analytics Phase 2. |
| **Error tracking** | Sentry (Phase 2) | Free tier = 5K errors/month. |
| **File storage** | Vercel Blob or S3 (when needed) | Not needed for Phase 1. |

## Why These Choices

### Clerk over NextAuth
- Clerk: hosted UI, middleware helper, organization support, 15 min setup
- NextAuth: more config, self-managed, slower to set up
- **Decision:** Speed matters. Clerk gets us auth in hours, not days.

### Neon over Supabase
- Neon: pure Postgres, serverless scaling, branching, Prisma-native
- Supabase: includes auth/storage/realtime (we don't need — using Clerk)
- **Decision:** Neon is leaner. We only need Postgres. Founder prefers Neon.

### Prisma over Drizzle
- Prisma: mature, great migrations, widely understood, good docs
- Drizzle: lighter, SQL-like, newer
- **Decision:** Prisma has better ecosystem. Schema-first approach matches our data model docs.

### Resend over SendGrid
- Resend: React Email support, simpler API, built for Next.js
- SendGrid: more mature but heavier, SMTP complexity
- **Decision:** Resend integrates cleanly with our stack.

## Not Using (And Why)

| Technology | Why Not |
|-----------|---------|
| Shopify | We ARE the custom portal |
| Supabase | Using Clerk for auth, Neon for DB — Supabase would duplicate |
| tRPC | Server actions are simpler for our use case |
| Redux/Zustand | React Context + server components sufficient |
| Docker | Vercel handles deployment |
| GraphQL | REST/server actions simpler for internal app |
