import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType } from "@prisma/client";
import { ImpersonateButton } from "./impersonate-button";
import { InviteUserButton } from "./invite-user-button";
import { getUsageSummary } from "@/lib/rentcast/budget";
import type { ToggleableModule } from "@/lib/actions/admin-modules";
import { headers } from "next/headers";
import { StatusBadge } from "@/components/admin/status-badge";
import { PageHeader } from "@/components/admin/page-header";
import {
  humanTenantStatus,
  tenantStatusTone,
  humanPropertyType,
  humanResidentialSubtype,
  humanCommercialSubtype,
  humanSubscriptionTier,
} from "@/lib/format";
import { getClientActionItems } from "@/lib/admin/insights";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Activity,
} from "lucide-react";
import { ClientTabs, type ClientTabDef } from "./_tabs/client-tabs";
import { OverviewClientTab } from "./_tabs/overview";
import { PropertiesClientTab } from "./_tabs/properties";
import { TeamClientTab } from "./_tabs/team";
import { BillingClientTab } from "./_tabs/billing";
import { ActivityClientTab } from "./_tabs/activity";

export const metadata: Metadata = { title: "Client detail" };
export const dynamic = "force-dynamic";

const TABS: ClientTabDef[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "properties", label: "Properties", icon: Building2 },
  { key: "team", label: "Team", icon: Users },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "activity", label: "Activity", icon: Activity },
];

export default async function ClientDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAgency();
  const { id } = await params;
  const { tab } = await searchParams;

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          properties: true,
          leads: true,
          visitors: true,
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
      // Per-property migration renamed cursiveIntegration → cursiveIntegrations
      // (1:many). Pull the legacy org-wide row (propertyId = NULL) plus
      // every per-property row; the admin UI surfaces the legacy one as
      // the org's primary pixel and the rest as scoped overrides.
      cursiveIntegrations: {
        orderBy: [{ propertyId: "asc" }, { createdAt: "asc" }],
      },
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

  // After the per-property integration migration the legacy "this is the
  // org's pixel" row is the one with propertyId = NULL. The admin client
  // panel shows that as the primary pixel so existing UX stays intact.
  const cursiveLegacy =
    org.cursiveIntegrations.find((c) => c.propertyId === null) ?? null;

  const moduleRows: Array<[ToggleableModule, string, boolean]> = [
    // Acquisition + on-site
    ["moduleWebsite", "Website", org.moduleWebsite],
    ["moduleLeadCapture", "Lead capture", org.moduleLeadCapture],
    ["modulePixel", "Visitor pixel", org.modulePixel],
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
    ["moduleInsights", "Insights (AEO + briefing + reports)", org.moduleInsights],
    ["moduleReputation", "Reputation", org.moduleReputation],
    // Norman feedback (May 22): RentCast market intelligence (estimated
    // rent + nearby comparables + hot/cold market badge) on the
    // property detail page. Off by default — residential operators
    // typically don't want rent-comp data alongside their digital-
    // marketing dashboards. Flip on per-tenant when there's a use case.
    ["moduleMarketIntelligence", "Market intelligence (RentCast comparables)", org.moduleMarketIntelligence],
    // Operations (AppFolio-backed) + tours
    ["moduleTours", "Tours", org.moduleTours],
    ["moduleResidents", "Resident operations (residents / renewals / work orders / applications)", org.moduleResidents],
    // Add-ons
    ["moduleVault", "Vault", org.moduleVault],
  ];

  const recentLeads = await prisma.lead.findMany({
    where: { orgId: org.id },
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
  // scoped to this client. Surfaces concrete issues (AppFolio 404, stale
  // build, silent pixel) at the top of the page so the admin doesn't
  // have to scroll to find what's broken.
  const actionItems = await getClientActionItems(org.id).catch(() => []);

  // RentCast usage breadcrumb — lazily upserts an OrgRentCastUsage row
  // for this org if none exists, so the admin row always renders with a
  // current monthly counter + the operator's budget. Safe to call even
  // for tenants who've never opened the Market Intelligence section.
  const rentCastUsage = await getUsageSummary(org.id).catch(() => null);

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

  // Resolve the Cursive webhook URLs at request time — the admin panel
  // shows BOTH the shared mailbox and the tenant-scoped variant for QA.
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("host") ?? "leasestack.co";
  const sharedWebhookUrl = `${proto}://${host}/api/webhooks/cursive`;
  const tenantWebhookUrl = cursiveLegacy?.webhookToken
    ? `${proto}://${host}/api/webhooks/cursive/${cursiveLegacy.webhookToken}`
    : null;

  const readinessItems = [
    {
      label: "Clerk org linked",
      status: org.clerkOrgId ? ("ok" as const) : ("missing" as const),
      hint: org.clerkOrgId
        ? undefined
        : "Convert the intake or re-provision to create the Clerk org.",
    },
    {
      label: "Primary contact email",
      status: org.primaryContactEmail ? ("ok" as const) : ("missing" as const),
      hint:
        org.primaryContactEmail ?? "Add a primary contact before inviting.",
    },
    {
      label: "At least one team member",
      status:
        org._count.users > 0 ? ("ok" as const) : ("warn" as const),
      hint:
        org._count.users > 0
          ? `${org._count.users} user${org._count.users === 1 ? "" : "s"}`
          : "No users yet. Sending an invite counts.",
    },
    {
      label: "Primary property added",
      status:
        org._count.properties > 0 ? ("ok" as const) : ("missing" as const),
      href: "/admin/clients/" + org.id,
      hint:
        org._count.properties > 0
          ? `${org._count.properties} propert${org._count.properties === 1 ? "y" : "ies"}`
          : "At least one Property is required for listings.",
    },
    {
      label: "Custom domain attached",
      status:
        org.domains.length > 0 ? ("ok" as const) : ("warn" as const),
      hint:
        org.domains.length > 0
          ? org.domains.map((d) => d.hostname).join(", ")
          : "Fallback is {slug}.leasestack.co — configure a real hostname soon.",
    },
    {
      label: "Cursive pixel provisioned",
      status: cursiveLegacy?.cursivePixelId
        ? ("ok" as const)
        : ("missing" as const),
      hint: cursiveLegacy?.cursivePixelId
        ? `Pixel ${cursiveLegacy.cursivePixelId}`
        : "Click 'Provision pixel' above.",
    },
    {
      label: "Pixel enabled on tenant site",
      status: org.tenantSiteConfig?.enablePixel
        ? ("ok" as const)
        : ("warn" as const),
      hint: org.tenantSiteConfig?.enablePixel
        ? "Rendering on the live site."
        : "Client toggles this in Site builder — we can pre-enable.",
    },
    {
      label: "Chatbot enabled on tenant site",
      status: org.tenantSiteConfig?.chatbotEnabled
        ? ("ok" as const)
        : ("warn" as const),
      hint: org.tenantSiteConfig?.chatbotEnabled
        ? "Loader renders on the live site."
        : "Client toggles this from /portal/chatbot.",
    },
    {
      label: "AppFolio connected",
      status: org.appfolioIntegration?.lastSyncAt
        ? ("ok" as const)
        : ("warn" as const),
      hint: org.appfolioIntegration?.lastSyncAt
        ? `Last sync ${org.appfolioIntegration.lastSyncAt.toISOString().slice(0, 10)}`
        : "Client pastes credentials in /portal/settings/integrations.",
    },
    {
      label: "Brand colors + logo",
      status:
        org.logoUrl && org.primaryColor
          ? ("ok" as const)
          : org.logoUrl || org.primaryColor
            ? ("warn" as const)
            : ("warn" as const),
      hint:
        org.logoUrl && org.primaryColor
          ? "Portal is branded."
          : "Client sets these in /portal/settings.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
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
            <span>{propertyTypeLabel}</span>
            <span className="text-muted-foreground/60">·</span>
            <StatusBadge tone={tenantStatusTone(org.status)}>
              {humanTenantStatus(org.status)}
            </StatusBadge>
            {org.subscriptionTier ? (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-xs">
                  {humanSubscriptionTier(org.subscriptionTier)} tier
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

      {org.primaryContactName ? (
        <p className="text-xs text-muted-foreground -mt-2">
          {org.primaryContactName}
          {org.primaryContactEmail ? ` · ${org.primaryContactEmail}` : ""}
          {org.primaryContactPhone ? ` · ${org.primaryContactPhone}` : ""}
        </p>
      ) : null}

      <ClientTabs
        initialTab={tab ?? "overview"}
        tabs={TABS}
        panels={{
          overview: (
            <OverviewClientTab
              orgId={org.id}
              orgName={org.name}
              counts={{
                properties: org._count.properties,
                leads: org._count.leads,
                visitors: org._count.visitors,
                chatbotConversations: org._count.chatbotConversations,
                adCampaigns: org._count.adCampaigns,
                domains: org._count.domains,
              }}
              actionItems={actionItems}
              readinessItems={readinessItems}
              moduleRows={moduleRows}
              rentCastUsage={rentCastUsage}
              domains={org.domains.map((d) => ({
                id: d.id,
                hostname: d.hostname,
                isPrimary: d.isPrimary,
                sslStatus: d.sslStatus,
                dnsConfigured: d.dnsConfigured,
              }))}
              fallbackSlug={org.slug}
              cursive={{
                cursivePixelId: cursiveLegacy?.cursivePixelId ?? null,
                cursiveSegmentId: cursiveLegacy?.cursiveSegmentId ?? null,
                installedOnDomain:
                  cursiveLegacy?.installedOnDomain ?? null,
                lastEventAt: cursiveLegacy?.lastEventAt
                  ? cursiveLegacy.lastEventAt.toISOString()
                  : null,
                lastSegmentSyncAt: cursiveLegacy?.lastSegmentSyncAt
                  ? cursiveLegacy.lastSegmentSyncAt.toISOString()
                  : null,
                totalEventsCount: cursiveLegacy?.totalEventsCount ?? 0,
              }}
              sharedWebhookUrl={sharedWebhookUrl}
              tenantWebhookUrl={tenantWebhookUrl}
            />
          ),
          properties: <PropertiesClientTab properties={org.properties} />,
          team: (
            <TeamClientTab
              members={teamMembers}
              properties={teamProperties}
            />
          ),
          billing: (
            <BillingClientTab
              billing={{
                stripeCustomerId: org.stripeCustomerId,
                subscriptionTier: org.subscriptionTier,
                subscriptionStatus: org.subscriptionStatus,
                subscriptionStartedAt: org.subscriptionStartedAt,
                trialEndsAt: org.trialEndsAt,
                mrrCents: org.mrrCents,
                buildFeePaidCents: org.buildFeePaidCents,
                adSpendMarkupPct: org.adSpendMarkupPct,
              }}
            />
          ),
          activity: (
            <ActivityClientTab
              recentAudits={recentAudits}
              recentLeads={recentLeads}
            />
          ),
        }}
      />
    </div>
  );
}
