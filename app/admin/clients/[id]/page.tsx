import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType } from "@prisma/client";
import { ImpersonateButton } from "./impersonate-button";
import { InviteUserButton } from "./invite-user-button";
import { getUsageSummary } from "@/lib/rentcast/budget";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { marketableOrgClause } from "@/lib/tenancy/property-filter";
import type { ToggleableModule } from "@/lib/actions/admin-modules";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  humanTenantStatus,
  tenantStatusTone,
  humanPropertyType,
  humanResidentialSubtype,
  humanCommercialSubtype,
  humanSubscriptionTier,
} from "@/lib/format";
import { getClientActionItems } from "@/lib/admin/insights";
import { getTenantDataSinks } from "@/lib/admin/data-sinks";
import {
  ClientDetailTabs,
  CLIENT_TAB_KEYS,
  type ClientTabKey,
} from "./client-detail-tabs";
import { OverviewTab } from "./overview-tab";
import { IntegrationsTab } from "./integrations-tab";
import { TeamTab } from "./team-tab";
import { ModulesDomainsTab } from "./modules-domains-tab";
import { PropertiesTab } from "./properties-tab";
import { ActivityTab } from "./activity-tab";

export const metadata: Metadata = { title: "Client detail" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Client detail page — restructured 2026-07-24 from a single 700-line
// endless scroll into a `?tab=` driven tabbed layout. Every data query
// below is UNCHANGED from the prior version (same semantics, same
// filters, same take/orderBy) — this file only decides how the results
// get composed into tab panels. Per-tab presentation lives in the
// sibling *-tab.tsx files; the persistent header (name, status, contact,
// Invite/Impersonate) renders above the tab nav on every tab since those
// actions are useful regardless of which panel is open.
// ---------------------------------------------------------------------------

export default async function ClientDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAgency();
  const { id } = await params;
  const sp = await searchParams;
  const tab: ClientTabKey = CLIENT_TAB_KEYS.includes(sp.tab as ClientTabKey)
    ? (sp.tab as ClientTabKey)
    : "overview";

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          properties: true,
          leads: true,
          chatbotConversations: true,
          creativeRequests: true,
          users: true,
          adCampaigns: true,
          domains: true,
        },
      },
      properties: {
        include: { _count: { select: { listings: true } } },
        take: 20,
        orderBy: { updatedAt: "desc" },
      },
      domains: true,
      tenantSiteConfig: true,
      appfolioIntegration: {
        select: {
          instanceSubdomain: true,
          syncStatus: true,
          lastSyncAt: true,
          lastError: true,
        },
      },
      projects: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { tasks: true, notes: true } } },
      },
      clientNotes: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!org || org.orgType !== OrgType.CLIENT) notFound();

  // Scoped to the properties enabled in LeaseStack, like every operator
  // surface. The relation `_count` above CANNOT express this (a Prisma
  // relation count is a bare FK filter with no room for a lifecycle join),
  // so the numbers that matter are recounted explicitly here — otherwise
  // this page reports the operator's whole synced AppFolio account and
  // disagrees with the client's own portal.
  const marketableClause = await marketableOrgClause(org.id, "propertyId", {
    includeOrgLevel: true,
  });
  const DAY_MS = 24 * 60 * 60 * 1000;
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const since60 = new Date(Date.now() - 60 * DAY_MS);
  const leadWhere = { orgId: org.id, ...marketableClause };
  const [
    leads30d,
    leadsPrev30d,
    chats30d,
    chatsPrev30d,
    marketablePropertyCount,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: since30 } } }),
    prisma.lead.count({
      where: { ...leadWhere, createdAt: { gte: since60, lt: since30 } },
    }),
    prisma.chatbotConversation.count({
      where: { ...leadWhere, createdAt: { gte: since30 } },
    }),
    prisma.chatbotConversation.count({
      where: { ...leadWhere, createdAt: { gte: since60, lt: since30 } },
    }),
    prisma.property.count({ where: marketablePropertyWhere(org.id) }),
  ]);

  const moduleRows: Array<[ToggleableModule, string, boolean]> = [
    // Acquisition + on-site
    ["moduleWebsite", "Website", org.moduleWebsite],
    ["moduleLeadCapture", "Lead capture", org.moduleLeadCapture],
    ["moduleChatbot", "AI chatbot", org.moduleChatbot],
    ["moduleConversations", "Conversations", org.moduleConversations],
    ["modulePopups", "Popups", org.modulePopups],
    // Paid + organic
    ["moduleGoogleAds", "Google Ads", org.moduleGoogleAds],
    ["moduleMetaAds", "Meta Ads", org.moduleMetaAds],
    ["moduleSEO", "SEO", org.moduleSEO],
    ["moduleCreativeStudio", "Creative studio", org.moduleCreativeStudio],
    // Lifecycle email
    ["moduleEmail", "Email nurture", org.moduleEmail],
    ["moduleOutboundEmail", "Outbound email", org.moduleOutboundEmail],
    ["moduleReferrals", "Referrals", org.moduleReferrals],
    // Intelligence
    ["moduleAttribution", "Attribution", org.moduleAttribution],
    ["moduleInsights", "Insights", org.moduleInsights],
    ["moduleReputation", "Reputation", org.moduleReputation],
    // Norman feedback (May 22): RentCast market intelligence (estimated
    // rent + nearby comparables + hot/cold market badge) on the
    // property detail page. Off by default — residential operators
    // typically don't want rent-comp data alongside their digital-
    // marketing dashboards. Flip on per-tenant when there's a use case.
    //
    // 2026-06-04: label trimmed from "Market intelligence (RentCast
    // comparables)" to "Market intel" so the 2-up grid layout aligns
    // — every other module label is 1-2 words.
    ["moduleMarketIntelligence", "Market intel", org.moduleMarketIntelligence],
    // Operations (AppFolio-backed) + tours
    ["moduleTours", "Tours", org.moduleTours],
    // Label trimmed from "Resident operations (residents / renewals /
    // work orders / applications)" — the sub-modules are visible on
    // the operator's sidebar; this toggle only needs to name the
    // gate.
    ["moduleResidents", "Resident ops", org.moduleResidents],
    // Add-ons
    ["moduleVault", "Vault", org.moduleVault],
  ];

  const recentLeads = await prisma.lead.findMany({
    where: { orgId: org.id, ...marketableClause },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { property: { select: { name: true } } },
  });

  const teamMembersRaw = await prisma.user.findMany({
    where: { orgId: org.id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      clerkUserId: true,
      lastLoginAt: true,
      createdAt: true,
      // Pull each user's UserPropertyAccess rows so the agency team
      // panel can edit per-user property scope inline. Empty array =
      // org-wide; non-empty = restricted to those property ids.
      propertyAccess: {
        select: { propertyId: true },
      },
    },
    take: 100,
  });
  const teamMembers = teamMembersRaw.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    clerkUserId: u.clerkUserId,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    propertyIds: u.propertyAccess.map((p) => p.propertyId),
  }));

  const lastLoginUser = teamMembersRaw
    .filter((u) => u.lastLoginAt)
    .sort((a, b) => b.lastLoginAt!.getTime() - a.lastLoginAt!.getTime())[0];
  const lastLogin = lastLoginUser
    ? {
        at: lastLoginUser.lastLoginAt!,
        who:
          [lastLoginUser.firstName, lastLoginUser.lastName]
            .filter(Boolean)
            .join(" ") || lastLoginUser.email,
      }
    : null;

  // Property list for the access editor. Only marketable + visible
  // properties so the agency panel matches what operators see.
  const teamProperties = await prisma.property.findMany({
    where: { orgId: org.id, lifecycle: { in: ["ACTIVE", "IMPORTED"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const recentAudits = await prisma.auditEvent.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // "Needs attention" — agency-level integration + lifecycle alerts
  // scoped to this client. Feeds the Overview tab's "Fires" summary.
  const actionItems = await getClientActionItems(org.id).catch(() => []);

  // RentCast usage breadcrumb — lazily upserts an OrgRentCastUsage row
  // for this org if none exists, so the admin row always renders with a
  // current monthly counter + the operator's budget. Safe to call even
  // for tenants who've never opened the Market Intelligence section.
  const rentCastUsage = await getUsageSummary(org.id).catch(() => null);

  // Per-tenant data-sinks board — same single-pane-of-glass that lives on
  // /admin/system, but scoped to this client. Catches the "this one
  // tenant's GA4 hasn't run in 4 days while the platform-wide cron looks
  // fine" failure mode the audit flagged.
  const tenantDataSinks = await getTenantDataSinks(org.id).catch((err) => {
    console.error("[admin/clients] tenant data sinks failed", org.id, err);
    return [];
  });
  const failingSinks = tenantDataSinks.filter(
    (s) => s.status === "erroring" || s.status === "dead",
  );

  const propertyTypeLabel = [
    humanPropertyType(org.propertyType),
    org.residentialSubtype
      ? humanResidentialSubtype(org.residentialSubtype)
      : org.commercialSubtype
        ? humanCommercialSubtype(org.commercialSubtype)
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const readinessItems = [
    {
      label: "Clerk org linked",
      // Informational only — inviting users does NOT require a Clerk
      // Organization (the invite route creates a standalone Clerk
      // invitation + DB User directly). "warn" not "missing": this
      // never blocks sending invites. See the Overview "Fires" band
      // for the actual Clerk provisioning error when AT_RISK.
      status: (org.clerkOrgId ? "ok" : "warn") as "ok" | "warn" | "missing",
      hint: org.clerkOrgId
        ? undefined
        : "No Clerk Organization on file — doesn't block invites. Only affects Clerk-side org membership bookkeeping.",
    },
    {
      label: "Primary contact email",
      status: (org.primaryContactEmail ? "ok" : "missing") as
        | "ok"
        | "warn"
        | "missing",
      hint: org.primaryContactEmail ?? "Add a primary contact before inviting.",
    },
    {
      label: "At least one team member",
      status: (org._count.users > 0 ? "ok" : "warn") as "ok" | "warn" | "missing",
      hint:
        org._count.users > 0
          ? `${org._count.users} user${org._count.users === 1 ? "" : "s"}`
          : "No users yet. Sending an invite counts.",
    },
    {
      label: "Primary property added",
      status: (org._count.properties > 0 ? "ok" : "missing") as
        | "ok"
        | "warn"
        | "missing",
      href: "/admin/clients/" + org.id,
      hint:
        org._count.properties > 0
          ? `${marketablePropertyCount} live of ${org._count.properties} synced`
          : "At least one Property is required for listings.",
    },
    {
      label: "Custom domain attached",
      status: (org.domains.length > 0 ? "ok" : "warn") as "ok" | "warn" | "missing",
      hint:
        org.domains.length > 0
          ? org.domains.map((d) => d.hostname).join(", ")
          : "Fallback is {slug}.leasestack.co — configure a real hostname soon.",
    },
    {
      label: "Chatbot enabled on tenant site",
      status: (org.tenantSiteConfig?.chatbotEnabled ? "ok" : "warn") as
        | "ok"
        | "warn"
        | "missing",
      hint: org.tenantSiteConfig?.chatbotEnabled
        ? "Loader renders on the live site."
        : "Client toggles this from /portal/chatbot.",
    },
    {
      label: "AppFolio connected",
      status: (org.appfolioIntegration?.lastSyncAt ? "ok" : "warn") as
        | "ok"
        | "warn"
        | "missing",
      hint: org.appfolioIntegration?.lastSyncAt
        ? `Last sync ${org.appfolioIntegration.lastSyncAt.toISOString().slice(0, 10)}`
        : "Client pastes credentials in /portal/settings/integrations.",
    },
    {
      label: "Brand colors + logo",
      status: (org.logoUrl && org.primaryColor ? "ok" : "warn") as
        | "ok"
        | "warn"
        | "missing",
      hint:
        org.logoUrl && org.primaryColor
          ? "Portal is branded."
          : "Client sets these in /portal/settings.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <span aria-hidden="true">←</span> All clients
          </Link>
        }
        title={org.name}
        description={
          <span className="flex items-center gap-2 flex-wrap">
            {org.slug.endsWith("-demo") ? (
              <StatusBadge tone="danger">Demo workspace</StatusBadge>
            ) : null}
            <span>{propertyTypeLabel}</span>
            <span className="text-muted-foreground">·</span>
            <StatusBadge tone={tenantStatusTone(org.status)}>
              {humanTenantStatus(org.status)}
            </StatusBadge>
            {org.subscriptionTier ? (
              <>
                <span className="text-muted-foreground">·</span>
                <span>{humanSubscriptionTier(org.subscriptionTier)} tier</span>
              </>
            ) : null}
            {org.primaryContactName || org.primaryContactEmail ? (
              <>
                <span className="text-muted-foreground">·</span>
                <span>
                  {[org.primaryContactName, org.primaryContactEmail, org.primaryContactPhone]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </>
            ) : null}
          </span>
        }
        actions={
          <>
            <InviteUserButton
              orgId={org.id}
              clerkOrgId={org.clerkOrgId}
              suggestedEmail={org.primaryContactEmail}
              suggestedName={org.primaryContactName}
            />
            <ImpersonateButton orgId={org.id} />
          </>
        }
      />

      <ClientDetailTabs
        orgId={org.id}
        active={tab}
        propertiesCount={org.properties.length}
        failingSyncCount={failingSinks.length}
      />

      {tab === "overview" ? (
        <OverviewTab
          orgId={org.id}
          stats={{
            leads30d,
            leadsPrev30d,
            chats30d,
            chatsPrev30d,
            liveProperties: marketablePropertyCount,
            // org._count is a bare FK count: every property synced from
            // the operator's AppFolio account, live in LeaseStack or not.
            syncedProperties: org._count.properties,
            lastLogin,
          }}
          readinessItems={readinessItems}
          actionItems={actionItems}
          dataSinks={tenantDataSinks}
          recentLeads={recentLeads}
          activeProjects={org.projects}
        />
      ) : null}

      {tab === "integrations" ? (
        <IntegrationsTab
          orgId={org.id}
          tenantDataSinks={tenantDataSinks}
        />
      ) : null}

      {tab === "team" ? (
        <TeamTab members={teamMembers} properties={teamProperties} />
      ) : null}

      {tab === "modules" ? (
        <ModulesDomainsTab
          orgId={org.id}
          moduleRows={moduleRows}
          rentCastUsage={rentCastUsage}
          fallbackSlug={org.slug}
          domains={org.domains.map((d) => ({
            id: d.id,
            hostname: d.hostname,
            isPrimary: d.isPrimary,
            sslStatus: d.sslStatus,
            dnsConfigured: d.dnsConfigured,
          }))}
        />
      ) : null}

      {tab === "properties" ? (
        <PropertiesTab properties={org.properties} />
      ) : null}

      {tab === "activity" ? <ActivityTab events={recentAudits} /> : null}
    </div>
  );
}
