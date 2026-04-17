# Sprint 05 — Client Portal Foundation

**Duration:** 1 day
**Dependencies:** Sprint 02, 04
**Goal:** Tenant users log into `/portal`, see their dashboard, manage properties + leads + conversations + creative requests + billing + site settings. Works identically when Adam impersonates.

---

## Fork from Wholesail

**Keep and rewrite:**
- `app/client-portal/layout.tsx` → `app/portal/layout.tsx`
- `app/client-portal/page.tsx` → `app/portal/page.tsx` (dashboard)
- `app/client-portal/dashboard/page.tsx` — fold into `/portal` root
- `app/client-portal/settings/page.tsx` — keep, rewrite
- `app/client-portal/analytics/page.tsx` — rewrite for real estate metrics

**Delete:** catalog, orders, invoices, saved-carts, payments, quotes, standing-orders, inventory, fulfillment, referrals, messages (distribution-specific). Referrals gets rebuilt in v2.

**Create new:**
- `app/portal/properties/`
- `app/portal/properties/[id]/listings/`
- `app/portal/leads/`
- `app/portal/leads/[id]/`
- `app/portal/visitors/` (Sprint 08 fills in)
- `app/portal/conversations/` (Sprint 09)
- `app/portal/creative/` (Sprint 11)
- `app/portal/campaigns/`
- `app/portal/site-builder/`
- `app/portal/billing/`

---

## Step-by-step

### 1. Portal shell

```tsx
// app/portal/layout.tsx
import { getScope } from "@/lib/tenancy/scope";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PortalNav } from "@/components/portal/portal-nav";
import { ImpersonationBanner } from "@/components/portal/impersonation-banner";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");

  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
  });
  if (!org || org.orgType !== "CLIENT") redirect(scope.isAgency ? "/admin" : "/sign-in");

  return (
    <div className="min-h-screen bg-gray-50">
      {scope.isImpersonating && <ImpersonationBanner orgName={org.name} />}
      <PortalNav org={org} scope={scope} />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
```

### 2. Portal nav (reuse + adapt Wholesail's pattern)

Nav items (visibility based on modules):
- Dashboard (always)
- Properties (always)
- Leads (always)
- Visitors (if `modulePixel`)
- Conversations (if `moduleChatbot`)
- Campaigns (if `moduleGoogleAds || moduleMetaAds`)
- Creative (if `moduleCreativeStudio`)
- Site builder (if `moduleWebsite && !bringYourOwnSite`)
- Billing (always)
- Settings (always)

```tsx
// components/portal/portal-nav.tsx — adapt from Wholesail's portal-nav.tsx
```

### 3. Tenant dashboard

`app/portal/page.tsx`:

```tsx
import { requireClient } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/portal/stat-card";
import { LeadsFunnelChart } from "@/components/portal/leads-funnel";
import { RecentActivityFeed } from "@/components/portal/recent-activity";

export default async function PortalDashboard() {
  const scope = await requireClient();

  const since30d = new Date(Date.now() - 30 * 86400 * 1000);

  const [
    leadsTotal,
    leadsNew30d,
    toursScheduled,
    applicationsSubmitted,
    visitorsIdentified30d,
    chatbotConvos30d,
    propertiesCount,
    listingsAvailable,
  ] = await Promise.all([
    prisma.lead.count({ where: { orgId: scope.orgId } }),
    prisma.lead.count({ where: { orgId: scope.orgId, createdAt: { gte: since30d } } }),
    prisma.tour.count({ where: { lead: { orgId: scope.orgId }, status: "SCHEDULED" } }),
    prisma.application.count({ where: { lead: { orgId: scope.orgId }, status: "SUBMITTED" } }),
    prisma.visitor.count({ where: { orgId: scope.orgId, status: "IDENTIFIED", firstSeenAt: { gte: since30d } } }),
    prisma.chatbotConversation.count({ where: { orgId: scope.orgId, createdAt: { gte: since30d } } }),
    prisma.property.count({ where: { orgId: scope.orgId } }),
    prisma.listing.count({ where: { property: { orgId: scope.orgId }, isAvailable: true } }),
  ]);

  const leadsByStatus = await prisma.lead.groupBy({
    by: ["status"],
    where: { orgId: scope.orgId },
    _count: true,
  });

  const leadsBySource30d = await prisma.lead.groupBy({
    by: ["source"],
    where: { orgId: scope.orgId, createdAt: { gte: since30d } },
    _count: true,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Leads (30d)" value={leadsNew30d} />
        <StatCard label="Tours scheduled" value={toursScheduled} />
        <StatCard label="Applications" value={applicationsSubmitted} />
        <StatCard label="Available units" value={listingsAvailable} sub={`${propertiesCount} properties`} />
        <StatCard label="Identified visitors (30d)" value={visitorsIdentified30d} />
        <StatCard label="Chatbot conversations (30d)" value={chatbotConvos30d} />
        <StatCard label="Total leads" value={leadsTotal} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LeadsFunnelChart data={leadsByStatus} />
        {/* Leads by source pie/bar */}
      </div>

      <RecentActivityFeed orgId={scope.orgId} />
    </div>
  );
}
```

### 4. Properties

`app/portal/properties/page.tsx` — list. `app/portal/properties/[id]/page.tsx` — detail with tabs for Listings, Photos, SEO, Settings.

Key interactions:
- Add new property (agency only; clients can't add their own in v1)
- View listings pulled from AppFolio (Sprint 06 syncs these)
- Edit property photos, amenities, description
- Sync now button (triggers AppFolio re-pull)

```tsx
// app/portal/properties/page.tsx
import { requireClient } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function PropertiesList() {
  const scope = await requireClient();
  const properties = await prisma.property.findMany({
    where: { orgId: scope.orgId },
    include: { _count: { select: { listings: true, leads: true } } },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Your properties</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {properties.map(p => (
          <Link key={p.id} href={`/portal/properties/${p.id}`} className="block p-4 border rounded-lg bg-white hover:shadow-md transition">
            <div className="font-semibold text-lg">{p.name}</div>
            <div className="text-sm text-muted-foreground">{p.addressLine1}, {p.city}, {p.state}</div>
            <div className="mt-2 text-sm flex gap-4">
              <span>{p._count.listings} units</span>
              <span>{p._count.leads} leads</span>
              <span>{p.availableCount ?? 0} available</span>
            </div>
            {p.lastSyncedAt && <div className="text-xs text-muted-foreground mt-1">Last synced {new Date(p.lastSyncedAt).toLocaleString()}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

### 5. Leads

`app/portal/leads/page.tsx` — Kanban by `LeadStatus`, filters by source, property, search. Reuse Wholesail's `pipeline-board.tsx` pattern.

`app/portal/leads/[id]/page.tsx` — lead detail:
- Contact info
- Source + attribution
- Score, intent
- Tours list
- Applications list
- Conversation history (chatbot)
- Notes thread
- Status dropdown (updates + writes AuditEvent)
- Assign to team member
- Manual actions: "Send email" (opens compose), "Log call", "Schedule tour"

API routes under `app/api/tenant/leads/`:
```typescript
// app/api/tenant/leads/route.ts (GET, POST)
// app/api/tenant/leads/[id]/route.ts (GET, PATCH, DELETE)
// app/api/tenant/leads/[id]/status/route.ts (POST)
// app/api/tenant/leads/[id]/notes/route.ts (POST)
```

All routes use `requireClient()` and filter by `orgId`.

### 6. Campaigns

`app/portal/campaigns/page.tsx` — lists `AdCampaign` rows with performance (impressions, clicks, conversions, spend). Links out to ad platform for full management. v1 is read-only; clients see what we're running but don't edit.

### 7. Site builder

`app/portal/site-builder/page.tsx` — edit `TenantSiteConfig`. Form fields:
- Hero headline + subheadline
- Hero image upload (Vercel Blob)
- Tagline
- About copy (rich text)
- Primary CTA text + URL
- Phone, contact email
- Meta title + description + OG image
- Feature toggles (show listings, show reviews, exit intent, etc.)
- Exit intent popup copy + offer code
- Chatbot config (persona name, greeting, knowledge base)

"Save + publish" button writes to DB + triggers revalidation of tenant site routes.

### 8. Billing

`app/portal/billing/page.tsx`:
- Current subscription tier + next renewal
- Monthly recurring modules breakdown
- Ad spend this month
- Payment method (Stripe Customer Portal link)
- Invoice history (read from Stripe)

Reuse Wholesail's `lib/stripe/` helpers.

### 9. Settings

`app/portal/settings/page.tsx` — company info, primary contact, brand assets (logo, colors), users/team (invite flow via Clerk organizations), custom domain management.

### 10. Scoped API pattern

Every API route under `/api/tenant/*` follows this template:

```typescript
import { requireClient } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const scope = await requireClient();
  const rows = await prisma.lead.findMany({
    where: { orgId: scope.orgId },         // ALWAYS scoped
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ rows });
}
```

Enforce this pattern in code review; never use `prisma.xxx.findMany({})` without `orgId` filtering in tenant-scoped APIs. The one exception is `/api/admin/*` where Adam can cross-query.

---

## Done when

- [ ] Client user logs in, sees dashboard with their org's data
- [ ] Properties list + detail work, show listings + leads counts
- [ ] Leads Kanban drags between statuses, persists
- [ ] Lead detail shows all related entities
- [ ] Site builder form saves to `TenantSiteConfig` and revalidates tenant site
- [ ] Billing shows Stripe data
- [ ] Settings updates org fields
- [ ] Impersonation from admin lands on the same portal views with yellow banner
- [ ] Every `/api/tenant/*` route enforces `orgId` scoping

## Handoff to Sprint 06
Portal is live. Sprint 06 wires in AppFolio so listings actually sync into `Property.listings` — which the dashboard, site builder, and tenant marketing sites all consume.
