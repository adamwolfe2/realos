# Sprint 04 — Master Admin CRM & Fulfillment Pipeline

**Duration:** 1 day
**Dependencies:** Sprint 02, 03
**Goal:** Adam and the agency team have a single pane of glass across every client. Intake queue → pipeline Kanban → client detail views → impersonation. Tenant provisioning works end-to-end.

---

## Fork from Wholesail

**Keep & rename:**
- `app/admin/page.tsx` — CEO dashboard (rewrite content)
- `app/admin/clients/page.tsx` — client list (rewrite for Organization model)
- `app/admin/clients/[id]/page.tsx` — client detail (rewrite)
- `app/admin/pipeline/page.tsx` — pipeline Kanban (rewrite statuses)
- `app/admin/leads/page.tsx` — cross-tenant leads (rewrite)
- `app/admin/tasks/page.tsx` — agency task list (keep)
- `app/admin/ceo/page.tsx` — CEO roll-up (rewrite metrics)
- `app/admin/analytics/page.tsx` — keep, rewrite metrics
- `app/admin/audit-log/page.tsx` — keep as-is
- `components/pipeline-board.tsx`, `pipeline-card.tsx` — reuse

**Create new:**
- `app/admin/intake/page.tsx` — intake submission queue
- `app/admin/intake/[id]/page.tsx` — submission detail + convert action
- `app/admin/creative-requests/page.tsx` — creative queue (Sprint 11 fills in)
- `app/admin/campaigns/page.tsx` — ad campaigns across clients
- `app/admin/visitors/page.tsx` — cross-tenant pixel visitor view (Sprint 08)

---

## Step-by-step

### 1. Tenant provisioning pipeline

`lib/build/provision-tenant.ts` — the core function that turns a submission into a live tenant:

```typescript
import { prisma } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { DEFAULT_TASKS } from "./default-tasks";
import type { IntakeSubmission } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function provisionTenant(submission: IntakeSubmission) {
  return prisma.$transaction(async (tx) => {
    // 1. Create Organization
    const slug = submission.shortName?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ??
                 submission.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

    const org = await tx.organization.create({
      data: {
        name: submission.companyName,
        shortName: submission.shortName,
        slug,
        orgType: "CLIENT",
        propertyType: submission.propertyType,
        residentialSubtype: submission.residentialSubtype,
        commercialSubtype: submission.commercialSubtype,
        status: "CONSULTATION_BOOKED",
        primaryContactName: submission.primaryContactName,
        primaryContactEmail: submission.primaryContactEmail,
        primaryContactPhone: submission.primaryContactPhone,
        primaryContactRole: submission.primaryContactRole,
        hqCity: submission.hqCity,
        hqState: submission.hqState,
        // Module flags from submission
        moduleWebsite: (submission.selectedModules as string[])?.includes("website") ?? true,
        modulePixel: (submission.selectedModules as string[])?.includes("pixel") ?? false,
        moduleChatbot: (submission.selectedModules as string[])?.includes("chatbot") ?? false,
        moduleGoogleAds: (submission.selectedModules as string[])?.includes("googleAds") ?? false,
        moduleMetaAds: (submission.selectedModules as string[])?.includes("metaAds") ?? false,
        moduleSEO: (submission.selectedModules as string[])?.includes("seo") ?? false,
        moduleEmail: (submission.selectedModules as string[])?.includes("email") ?? false,
        moduleOutboundEmail: (submission.selectedModules as string[])?.includes("outboundEmail") ?? false,
        moduleReferrals: (submission.selectedModules as string[])?.includes("referrals") ?? false,
        moduleCreativeStudio: (submission.selectedModules as string[])?.includes("creativeStudio") ?? false,
      },
    });

    // 2. Create Clerk organization
    const client = await clerkClient();
    const clerkOrg = await client.organizations.createOrganization({
      name: submission.companyName,
      slug,
    });
    await tx.organization.update({
      where: { id: org.id },
      data: { clerkOrgId: clerkOrg.id },
    });

    // 3. Create Stripe customer
    const stripeCustomer = await stripe.customers.create({
      name: submission.companyName,
      email: submission.primaryContactEmail,
      metadata: { orgId: org.id, platform: "{{PRODUCT_NAME}}" },
    });
    await tx.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: stripeCustomer.id },
    });

    // 4. Link submission → org
    await tx.intakeSubmission.update({
      where: { id: submission.id },
      data: { orgId: org.id, status: "converted", convertedAt: new Date() },
    });

    // 5. Create TenantSiteConfig stub
    await tx.tenantSiteConfig.create({
      data: {
        orgId: org.id,
        siteTitle: submission.companyName,
        enableChatbot: (submission.selectedModules as string[])?.includes("chatbot") ?? false,
        enablePixel: (submission.selectedModules as string[])?.includes("pixel") ?? false,
        enableExitIntent: true,
      },
    });

    // 6. Create Project with 28 default tasks
    const project = await tx.project.create({
      data: {
        orgId: org.id,
        name: `${submission.companyName} build`,
        startedAt: new Date(),
      },
    });
    await tx.projectTask.createMany({
      data: DEFAULT_TASKS.map((t, idx) => ({
        projectId: project.id,
        title: t.title,
        description: t.description,
        phase: t.phase,
        sortOrder: idx,
      })),
    });

    // 7. AppFolio integration stub (populated during build)
    if (submission.currentBackendPlatform === "APPFOLIO") {
      await tx.appFolioIntegration.create({
        data: {
          orgId: org.id,
          instanceSubdomain: "",
          plan: submission.backendPlanTier?.toLowerCase(),
        },
      });
    }

    // 8. Cursive pixel integration stub (provisioned during build if module enabled)
    if ((submission.selectedModules as string[])?.includes("pixel")) {
      await tx.cursiveIntegration.create({
        data: {
          orgId: org.id,
        },
      });
    }

    return org;
  });
}
```

### 2. Default tasks (fork + rewrite)

`lib/build/default-tasks.ts` — the 28-task operator checklist. Wholesail's version is in the same file, adapt it:

```typescript
export const DEFAULT_TASKS = [
  // Phase: Onboarding
  { title: "Send welcome email + access request", phase: "Onboarding", description: "Deliver onboarding packet. Request logo, photos, brand colors, domain access." },
  { title: "Schedule kickoff call", phase: "Onboarding" },
  { title: "Collect brand assets", phase: "Onboarding", description: "Logo (SVG + PNG), brand colors, fonts, 10+ property photos." },
  { title: "Collect domain registrar access", phase: "Onboarding", description: "GoDaddy/Namecheap/Porkbun login OR delegate via auth code." },
  { title: "Collect backend platform credentials", phase: "Onboarding", description: "AppFolio API key, or client granted API access via Plus plan." },

  // Phase: Infrastructure
  { title: "Provision Cursive pixel", phase: "Infrastructure", description: "Create pixel in Cursive platform, store pixel ID in CursiveIntegration." },
  { title: "Connect AppFolio REST API", phase: "Infrastructure", description: "Configure OAuth or API key; test listing pull from propertyGroupFilter." },
  { title: "Attach custom domain via Vercel", phase: "Infrastructure" },
  { title: "Verify DNS + SSL provisioning", phase: "Infrastructure" },
  { title: "Create Stripe subscription", phase: "Infrastructure" },

  // Phase: Site Build
  { title: "Draft TenantSiteConfig content", phase: "Site Build", description: "Hero headline, tagline, about copy, CTA labels." },
  { title: "Upload property photos to Vercel Blob", phase: "Site Build" },
  { title: "Generate AI draft copy (Claude)", phase: "Site Build", description: "Run tenant-site content generator with property facts + brand voice." },
  { title: "Review + approve draft with client", phase: "Site Build" },
  { title: "Configure chatbot knowledge base", phase: "Site Build" },
  { title: "Configure exit-intent offer copy", phase: "Site Build" },

  // Phase: Ads + Growth (only if modules enabled)
  { title: "Connect Google Ads account", phase: "Ads" },
  { title: "Connect Meta Ads account", phase: "Ads" },
  { title: "Create initial Google Ads campaign", phase: "Ads" },
  { title: "Create initial Meta campaign", phase: "Ads" },
  { title: "Install pixel on tenant site", phase: "Ads" },
  { title: "Configure SEO landing pages", phase: "SEO" },

  // Phase: QA + Launch
  { title: "Lighthouse audit: >90 on all surfaces", phase: "QA" },
  { title: "Pixel firing verification", phase: "QA" },
  { title: "Chatbot E2E test: lead captured → CRM", phase: "QA" },
  { title: "Mobile responsive review", phase: "QA" },
  { title: "Client walkthrough + training", phase: "Launch" },
  { title: "Flip DNS live; monitor first 48h", phase: "Launch" },
];
```

### 3. CEO dashboard

`app/admin/page.tsx` — top-level metrics for Adam:

```tsx
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/admin/stat-card";

export default async function AdminHome() {
  await requireAgency();

  const [
    activeClients,
    atRiskClients,
    intakeThisMonth,
    leadsThisMonth,
    tenantCount,
    mrrRows,
  ] = await Promise.all([
    prisma.organization.count({ where: { orgType: "CLIENT", status: "ACTIVE" } }),
    prisma.organization.count({ where: { orgType: "CLIENT", status: "AT_RISK" } }),
    prisma.intakeSubmission.count({
      where: { submittedAt: { gte: new Date(Date.now() - 30 * 86400 * 1000) } },
    }),
    prisma.lead.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86400 * 1000) } },
    }),
    prisma.organization.count({ where: { orgType: "CLIENT" } }),
    prisma.organization.aggregate({
      where: { orgType: "CLIENT", subscriptionStatus: "ACTIVE" },
      _sum: { mrrCents: true },
    }),
  ]);

  const mrr = (mrrRows._sum.mrrCents ?? 0) / 100;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Agency Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active clients" value={activeClients} />
        <StatCard label="At-risk" value={atRiskClients} tone={atRiskClients > 0 ? "warn" : undefined} />
        <StatCard label="MRR" value={`$${mrr.toLocaleString()}`} />
        <StatCard label="Total tenants" value={tenantCount} />
        <StatCard label="Intake (30d)" value={intakeThisMonth} />
        <StatCard label="Leads generated (30d)" value={leadsThisMonth} />
      </div>

      {/* TODO: pipeline by-status bar chart, top performers, recent activity feed */}
    </div>
  );
}
```

### 4. Intake queue

`app/admin/intake/page.tsx`:

```tsx
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default async function IntakeList() {
  await requireAgency();
  const submissions = await prisma.intakeSubmission.findMany({
    orderBy: { submittedAt: "desc" },
    take: 100,
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Intake queue</h1>
      <div className="space-y-2">
        {submissions.map(s => (
          <Link
            key={s.id}
            href={`/admin/intake/${s.id}`}
            className="block p-4 border rounded-lg hover:bg-gray-50 transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{s.companyName}</div>
                <div className="text-sm text-muted-foreground">
                  {s.propertyType} · {s.numberOfProperties ?? "?"} properties · {s.currentBackendPlatform}
                </div>
                <div className="text-sm text-muted-foreground">Pain: {s.biggestPainPoint}</div>
              </div>
              <div className="text-right">
                <div className="text-sm">{formatDistanceToNow(s.submittedAt, { addSuffix: true })}</div>
                <div className="text-xs text-muted-foreground">{s.status}</div>
                {s.bookedCallAt && <div className="text-xs text-green-600">Call booked</div>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

### 5. Submission detail + convert

`app/admin/intake/[id]/page.tsx` — shows submission data, "Convert to tenant" button that calls `/api/admin/intake/[id]/convert`.

### 6. Clients list

`app/admin/clients/page.tsx` — table of all CLIENT orgs with columns: name, status, MRR, active modules, properties count, leads last 30d, last activity. Filters: status, property type, subscription tier. Each row links to `/admin/clients/[id]`.

### 7. Client detail

`app/admin/clients/[id]/page.tsx` — tabs:
- **Overview**: status, tier, MRR, modules, primary contact
- **Properties**: list all properties with listing count
- **Pipeline**: project tasks for this client
- **Leads**: their leads with source breakdown
- **Visitors**: their Cursive pixel visitors (Sprint 08)
- **Conversations**: chatbot convos (Sprint 09)
- **Campaigns**: ad campaigns
- **Creative**: creative requests
- **Billing**: Stripe subscription + invoices
- **Notes**: ClientNote thread
- **Audit log**: recent AuditEvents

Add a prominent **"Impersonate"** button that calls `/api/admin/impersonate/[orgId]/start` and redirects to `/portal`.

### 8. Pipeline Kanban

Rewrite `app/admin/pipeline/page.tsx` to use our `TenantStatus` enum as columns:

```tsx
const COLUMNS = [
  { status: "INTAKE_RECEIVED", label: "Intake" },
  { status: "CONSULTATION_BOOKED", label: "Call booked" },
  { status: "PROPOSAL_SENT", label: "Proposal sent" },
  { status: "CONTRACT_SIGNED", label: "Signed" },
  { status: "BUILD_IN_PROGRESS", label: "Building" },
  { status: "QA", label: "QA" },
  { status: "LAUNCHED", label: "Launched" },
  { status: "ACTIVE", label: "Active" },
  { status: "AT_RISK", label: "At risk" },
];
```

Reuse `components/pipeline-board.tsx` from Wholesail; just swap column labels and card body to show client name, MRR, active modules.

### 9. Cross-tenant leads

`app/admin/leads/page.tsx` — filterable table across ALL clients. Columns: client, property, source, status, score, created. This is your "is our chatbot working across the portfolio" view. Filter by client, source, date range.

### 10. Impersonation UX

Sticky top banner across `/portal/*` when `scope.isImpersonating`:

```tsx
// components/portal/impersonation-banner.tsx
import { endImpersonation } from "@/lib/tenancy/impersonate";

export function ImpersonationBanner({ orgName }: { orgName: string }) {
  return (
    <div className="bg-yellow-500 text-black px-4 py-2 flex justify-between items-center">
      <span>Viewing as <strong>{orgName}</strong> (agency impersonation)</span>
      <form action={async () => {
        "use server";
        await endImpersonation();
      }}>
        <button type="submit" className="underline">Exit</button>
      </form>
    </div>
  );
}
```

---

## Done when

- [ ] Adam logs in, sees CEO dashboard with live metrics
- [ ] Intake queue shows submissions, can open detail, can convert → provisions Organization + Clerk org + Stripe customer + 28 tasks + TenantSiteConfig
- [ ] Pipeline Kanban drags cards between statuses, persists to DB, writes AuditEvent
- [ ] Client detail tabs load with tenant-scoped data
- [ ] Impersonate button works; banner shows; exit returns to admin
- [ ] Audit log captures impersonation start/end

## Handoff to Sprint 05
Agency side is operational. Sprint 05 builds the client portal — what the tenant's team sees when they log in (or when Adam impersonates them).
