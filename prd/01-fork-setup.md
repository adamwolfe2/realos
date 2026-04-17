# Sprint 01 — Fork Setup & Infrastructure Cleanup

**Duration:** 0.5 day
**Dependencies:** `00-schema.prisma` reviewed
**Goal:** Hard fork Wholesail into `{{PRODUCT_NAME}}`, strip distribution domain code, keep infrastructure intact, pass a clean build.

---

## Step-by-step

### 1. Create new repo
```bash
# On your machine
git clone https://github.com/adamwolfe2/wholesail.git {{PRODUCT_NAME}}
cd {{PRODUCT_NAME}}
rm -rf .git
git init
git remote add origin https://github.com/adamwolfe2/{{PRODUCT_NAME}}.git
git add -A && git commit -m "chore: initial fork from wholesail"
git push -u origin main
```

### 2. Rebrand package.json and env
```diff
{
-  "name": "wholesail-template",
-  "description": "Wholesail — white-label B2B distribution portal template",
+  "name": "{{PRODUCT_NAME_KEBAB}}",
+  "description": "{{PRODUCT_NAME}} — managed marketing SaaS for real estate operators",
```
Copy `.env.example` → `.env.example.new`, add env vars from `CLAUDE.md`. Rebuild `.env.local` from the new template.

### 3. Replace Prisma schema
```bash
# Back up Wholesail schema for reference
cp prisma/schema.prisma prisma/schema.wholesail.backup.prisma
# Replace with our schema
cp ../prd/00-schema.prisma prisma/schema.prisma
pnpm db:reset              # blow away existing migrations
pnpm db:push               # push new schema to a fresh Neon branch
pnpm db:generate
```

### 4. Delete distribution domain files

**API routes to delete:**
```bash
rm -rf app/api/drops
rm -rf app/api/attachments
rm -rf app/api/shipments
rm -rf app/api/products
rm -rf app/api/parse-order
rm -rf app/api/checkout
rm -rf app/api/supplier
rm -rf app/api/scrape
rm -rf app/api/wholesale
rm -rf app/api/notify-me
rm -rf app/api/claim
rm -rf app/api/client/loyalty
rm -rf app/api/client/quotes
rm -rf app/api/client/conversations
rm -rf app/api/client/pricing-tier
rm -rf app/api/client/notifications
```

**Pages/routes to delete:**
```bash
rm -rf app/catalog
rm -rf app/checkout
rm -rf app/claim
rm -rf app/supplier
rm -rf app/admin/products
rm -rf app/admin/orders
rm -rf app/admin/shipments
rm -rf app/admin/fulfillment
rm -rf app/admin/suppliers
rm -rf app/admin/drops
rm -rf app/admin/subscribers
rm -rf app/admin/reps
rm -rf app/admin/quotes
rm -rf app/admin/pricing
rm -rf app/admin/wholesale
rm -rf app/client-portal/catalog
rm -rf app/client-portal/orders
rm -rf app/client-portal/invoices
rm -rf app/client-portal/saved-carts
rm -rf app/client-portal/payments
rm -rf app/client-portal/quotes
rm -rf app/client-portal/standing-orders
rm -rf app/client-portal/inventory
rm -rf app/client-portal/fulfillment
rm -rf app/client-portal/referrals
rm -rf app/client-portal/messages
```

**Lib files to delete:**
```bash
rm -f lib/products.ts
rm -f lib/catalog-categories.ts
rm -f lib/cart-context.tsx
rm -f lib/order-number.ts
rm -f lib/smart-reorder.ts
rm -f lib/sms-ordering.ts
rm -f lib/provenance.ts
rm -rf lib/pdf
rm -rf lib/payments
rm -f lib/integrations/blooio.ts
rm -f lib/pricing.ts
rm -f lib/loyalty.ts
rm -f lib/referrals.ts
rm -f lib/credit.ts
rm -f lib/tier-upgrade.ts
rm -f lib/client-data.ts
rm -f lib/client-health.ts
rm -f lib/portal-config.ts
rm -f lib/ai/order-parser.ts
rm -f lib/ai/platform-knowledge.ts
```

**Components to delete:**
```bash
rm -f components/ai-order-parser.tsx
rm -f components/cart-sidebar.tsx
rm -f components/catalog-client.tsx
rm -f components/order-delivery-checklist.tsx
rm -f components/product-card.tsx
rm -f components/product-detail-actions.tsx
rm -f components/reorder-button.tsx
rm -f components/industry-page-template.tsx
rm -f components/state-page-template.tsx
```

**Industry marketing pages to delete** (we will create real estate verticals in Sprint 12):
```bash
rm -rf app/\(marketing\)/seafood-meat
rm -rf app/\(marketing\)/school-supply
rm -rf app/\(marketing\)/specialty-food
rm -rf app/\(marketing\)/flooring-distributor
rm -rf app/\(marketing\)/gift-novelty
rm -rf app/\(marketing\)/chemical-supply
rm -rf app/\(marketing\)/building-materials
rm -rf app/\(marketing\)/auto-parts
rm -rf app/\(marketing\)/candy-confectionery
rm -rf app/\(marketing\)/plumbing-hvac
rm -rf app/\(marketing\)/tobacco-vape
rm -rf app/\(marketing\)/jan-san
rm -rf app/\(marketing\)/safety-equipment-distributor
rm -rf app/\(marketing\)/apparel-fashion
rm -rf app/\(marketing\)/electrical-supply
rm -rf app/\(marketing\)/agricultural-supply
rm -rf app/\(marketing\)/dairy-distributor
rm -rf app/\(marketing\)/sporting-goods-distributor
rm -rf app/\(marketing\)/frozen-dessert
rm -rf app/\(marketing\)/industrial-supply
rm -rf app/\(marketing\)/bakery-distribution
rm -rf app/\(marketing\)/hardware-tools
rm -rf app/\(marketing\)/wine-spirits
rm -rf app/\(marketing\)/food-beverage
rm -rf app/\(marketing\)/coffee-tea
rm -rf app/\(marketing\)/restaurant-equipment
rm -rf app/\(marketing\)/supplements
rm -rf app/\(marketing\)/jewelry-accessories
rm -rf app/\(marketing\)/journal
rm -rf app/\(marketing\)/ai-ified
rm -rf app/\(marketing\)/organic-natural
rm -rf app/\(marketing\)/craft-art-supply
rm -rf app/\(marketing\)/drops
rm -rf app/\(marketing\)/provenance
rm -rf app/\(marketing\)/apply
rm -rf app/\(marketing\)/wholesale
rm -rf app/\(marketing\)/new-york
rm -rf app/\(marketing\)/washington
rm -rf app/\(marketing\)/illinois
rm -rf app/\(marketing\)/colorado
rm -rf app/\(marketing\)/ohio
rm -rf app/\(marketing\)/georgia
rm -rf app/\(marketing\)/michigan
rm -rf app/\(marketing\)/florida
rm -rf app/\(marketing\)/pennsylvania
rm -rf app/\(marketing\)/arizona
rm -rf app/\(marketing\)/california
rm -rf app/\(marketing\)/north-carolina
rm -rf app/\(marketing\)/demo
rm -rf app/\(marketing\)/social
rm -rf app/\(marketing\)/seafood-meat
```

**Keep these from `app/(marketing)/`:**
- `about/`
- `terms/`
- `privacy/`
- `page.tsx` (rewrite in Sprint 12)

Also rename the route group `(marketing)` → `(platform)` to reflect the new purpose.

### 5. Rewire cron jobs
The directory `app/api/cron/` survives. Some jobs keep their purpose (onboarding-drip, weekly-digest), others get deleted:

**Delete these crons:**
```bash
rm -rf app/api/cron/low-stock-alerts
rm -rf app/api/cron/abandoned-carts
rm -rf app/api/cron/partner-nurture
rm -rf app/api/cron/lapsed-clients      # Will rewrite in Sprint 10 as lapsed-leads
```

**Keep and repurpose:**
- `onboarding-drip` — drips to new clients after intake
- `weekly-digest` — weekly roll-up to client teams
- `weekly-report` — weekly performance email
- `intake-nurture` — follow up on unconverted intake submissions
- `billing-reminders` — unpaid invoice reminders
- `webhook-retry` — keep as-is, it's plumbing

Rewrite bodies in Sprint 10. For now, just stub them so they don't crash:
```typescript
// app/api/cron/onboarding-drip/route.ts
export async function GET() {
  return Response.json({ ok: true, message: "Stubbed — rewrites in Sprint 10" });
}
```

### 6. Repoint `lib/ai/`
Delete distribution-specific AI files. Keep:
- `lib/ai/ai-tools.ts` — Claude tool-use framework (will be used by chatbot)
- `lib/ai/tool-cache.ts` — caching layer
- `lib/ai/tools/` — tool implementations (delete distribution tools, keep framework)

Stub any broken imports with `// TODO: Sprint 09` comments.

### 7. Update `lib/brand.ts`
```typescript
// lib/brand.ts
export const BRAND = {
  name: "{{PRODUCT_NAME}}",
  shortName: "{{PRODUCT_SHORT_NAME}}",
  tagline: "Managed marketing for real estate operators",
  email: "hello@{{PRODUCT_DOMAIN}}",
  supportEmail: "support@{{PRODUCT_DOMAIN}}",
  url: "https://{{PRODUCT_DOMAIN}}",
  agencySlug: process.env.AGENCY_ORG_SLUG ?? "{{PRODUCT_SHORT_NAME}}-agency",
};
```

### 8. Seed script
Rewrite `prisma/seed.ts`:
```typescript
import { PrismaClient, OrgType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Create the singleton AGENCY org
  const agency = await prisma.organization.upsert({
    where: { slug: process.env.AGENCY_ORG_SLUG ?? "agency" },
    update: {},
    create: {
      name: "{{PRODUCT_NAME}} Agency",
      slug: process.env.AGENCY_ORG_SLUG ?? "agency",
      orgType: OrgType.AGENCY,
      primaryContactEmail: process.env.AGENCY_ADMIN_EMAIL ?? "adam@example.com",
    },
  });

  // 2. Seed Adam's user (Clerk webhook will link clerkUserId on first login)
  await prisma.user.upsert({
    where: { email: process.env.AGENCY_ADMIN_EMAIL ?? "adam@example.com" },
    update: {},
    create: {
      clerkUserId: "seed_pending",
      email: process.env.AGENCY_ADMIN_EMAIL ?? "adam@example.com",
      firstName: "Adam",
      lastName: "Wolfe",
      role: "AGENCY_OWNER",
      orgId: agency.id,
    },
  });

  // 3. Seed Telegraph Commons as first test client
  const tc = await prisma.organization.upsert({
    where: { slug: "telegraph-commons" },
    update: {},
    create: {
      name: "SG Real Estate",
      shortName: "SG",
      slug: "telegraph-commons",
      orgType: OrgType.CLIENT,
      propertyType: "RESIDENTIAL",
      residentialSubtype: "STUDENT_HOUSING",
      status: "BUILD_IN_PROGRESS",
      primaryContactName: "Jessica Vernaglia",
      primaryContactEmail: "jessica@sgrealestateco.com",
      primaryContactPhone: "510-692-4200",
      primaryContactRole: "VP of Operations",
      subscriptionTier: "SCALE",
    },
  });

  await prisma.property.upsert({
    where: { orgId_slug: { orgId: tc.id, slug: "telegraph-commons" } },
    update: {},
    create: {
      orgId: tc.id,
      name: "Telegraph Commons",
      slug: "telegraph-commons",
      propertyType: "RESIDENTIAL",
      residentialSubtype: "STUDENT_HOUSING",
      addressLine1: "2490 Channing Way",
      city: "Berkeley",
      state: "CA",
      postalCode: "94704",
      backendPlatform: "APPFOLIO",
      backendPropertyGroup: "Telegraph Commons",
      totalUnits: 100,
    },
  });

  console.log("Seeded agency, Adam, and Telegraph Commons test tenant.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

### 9. Pass build
```bash
pnpm install
pnpm db:generate
pnpm type-check             # Fix any broken imports
pnpm build                  # Must pass before moving to Sprint 02
```

Expected failures during type-check: many imports referencing deleted distribution files. Fix by deleting the importer, not by restoring the deleted file. If an importer is a page we want to keep (e.g., homepage), stub it with a placeholder component and a `// TODO: Sprint 12` comment.

### 10. Commit
```bash
git add -A
git commit -m "chore: strip distribution domain, replace schema for real estate"
git push
```

---

## Done when

- [ ] Repo forked, rebranded, deployed to Vercel
- [ ] `pnpm build` passes
- [ ] Prisma schema matches `00-schema.prisma` exactly
- [ ] Seed script runs cleanly and creates Agency org + Telegraph Commons tenant
- [ ] All distribution domain files removed
- [ ] All kept files have stub TODOs for sprints that will rewrite them

## Handoff to Sprint 02
After this sprint, the codebase is a clean skeleton with Wholesail's infrastructure (auth, billing, email, admin scaffolding, intake wizard framework, shadcn/ui, Sentry, PostHog, cron system) but no domain logic. Sprint 02 layers in multi-tenancy and custom domain routing.
