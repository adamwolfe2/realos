import { prisma } from "@/lib/db";
import {
  getPropertyOverviewKpis,
  centsToUsdShort,
  pctChange,
} from "@/lib/properties/queries";
import {
  LeaseStatus,
  type BackendPlatform,
  type CommercialSubtype,
  type PropertyLifecycle,
  type PropertyLaunchStatus,
  type PropertyType,
  type ResidentialSubtype,
  type ResidentStatus,
} from "@prisma/client";
import {
  Cable,
  MessageSquare,
  Code,
  ListPlus,
} from "lucide-react";
import { DataPlaceholder } from "@/components/portal/ui/data-placeholder";
import { AttributesEditor } from "@/components/portal/properties/attributes-editor";
import {
  getOpenInsights,
  getInsightCounts,
} from "@/lib/insights/queries";
import type {
  ActivityLeadRow,
  ActivityTourRow,
  ActivityLeaseRow,
  ActivityMentionRow,
} from "@/components/portal/properties/overview/types";
import { buildAiInsight } from "@/components/portal/properties/overview/ai-insight-card";
import {
  ActivityTimeline,
  buildActivityEvents,
} from "@/components/portal/properties/overview/activity-timeline";
import { PropertyIntegrationsList } from "@/components/portal/properties/overview/property-integrations-list";
import { PropertyMetaCard } from "@/components/portal/properties/overview/property-meta-card";
import { MarketingSection } from "@/components/portal/properties/overview/marketing-section";
import { PropertyDescriptionCard } from "@/components/portal/properties/overview/property-description-card";
import { OnboardingShellCard } from "@/components/portal/properties/overview/onboarding-shell-card";

type OverviewProperty = {
  propertyType: PropertyType;
  residentialSubtype: ResidentialSubtype | null;
  commercialSubtype: CommercialSubtype | null;
  totalUnits: number | null;
  yearBuilt: number | null;
  // Lifecycle + launchStatus drive the sparse-data treatment. An
  // IMPORTED + ONBOARDING row with zero downstream activity gets the
  // compact "property in onboarding" card instead of a full grid of
  // empty Recharts. SG Real Estate launched with 120 of these rows
  // straight from AppFolio.
  lifecycle: PropertyLifecycle;
  launchStatus: PropertyLaunchStatus;
  backendPlatform: BackendPlatform;
  backendPropertyGroup: string | null;
  lastSyncedAt: Date | null;
  metaTitle: string | null;
  metaDescription: string | null;
  virtualTourUrl: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  description: string | null;
  // Bug #28 — photo for the hero strip so operators recognize the
  // property visually instead of by name alone. Falls back to a
  // building glyph when null.
  heroImageUrl?: string | null;
  /** Org-level: does either ad module (Google or Meta) light up? When
   *  false we suppress ad-spend tiles and ads-related signals entirely
   *  rather than show "$0 (28d)" in big numerals. */
  orgHasAdsModule: boolean;
  /** Operator-editable attributes added in #68 (Norman audit 2026-05-21).
   *  Drives the filter chips on /portal/properties. NULL / empty by
   *  default. */
  assetCategory: string | null;
  profileTags: string[];
};

// 28-day window in ms — matches getPropertyOverviewKpis and every other
// time-windowed KPI on this page. Inlined as a constant so the
// Marketing section's chatbot count uses the same horizon.
const WINDOW_28D_MS = 28 * 24 * 60 * 60 * 1000;

export async function OverviewTab({
  orgId,
  propertyId,
  propertyMeta,
  property,
}: {
  orgId: string;
  propertyId: string;
  propertyMeta: { slug: string; name: string };
  property: OverviewProperty;
}) {
  const next120 = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);

  const [
    kpis,
    listingCounts,
    expiringLeases,
    noticeResidents,
    rentRoll,
    cursiveIntegration,
    seoIntegrations,
    googleAdCampaign,
    metaAdCampaign,
    tenantSiteConfig,
    propertyInsights,
    propertyInsightCounts,
    recentLeads,
    recentTours,
    recentLeases,
    recentMentions,
    chatbotConversations28d,
  ] = await Promise.all([
    getPropertyOverviewKpis(orgId, propertyId, propertyMeta),
    prisma.property.findFirst({
      where: { id: propertyId, orgId },
      select: {
        availableCount: true,
        _count: { select: { listings: true, leads: true } },
        listings: {
          where: { isAvailable: true },
          select: { id: true },
        },
      },
    }),
    prisma.lease.findMany({
      where: {
        orgId,
        propertyId,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        endDate: { gte: new Date(), lte: next120 },
      },
      select: { endDate: true, monthlyRentCents: true },
    }),
    prisma.resident.count({
      where: {
        orgId,
        propertyId,
        status: "NOTICE_GIVEN" as ResidentStatus,
      },
    }),
    prisma.lease.aggregate({
      where: { orgId, propertyId, status: LeaseStatus.ACTIVE },
      _sum: { monthlyRentCents: true },
      _count: { _all: true },
    }),
    // Norman feedback (issue #74, #53): the integrations sidebar was
    // showing Cursive + GA4 as "not connected" on Telegraph Commons even
    // though the operator had wired them up at the org level. Root cause:
    // we filtered strictly by { orgId, propertyId } so org-scoped
    // integrations (propertyId=null in DB) never matched. Fixed by
    // accepting EITHER a property-specific record OR the org-wide one
    // — the property-specific record wins when both exist via the
    // findFirst's natural order on (propertyId desc nulls last).
    prisma.cursiveIntegration
      .findFirst({
        where: { orgId, OR: [{ propertyId }, { propertyId: null }] },
        orderBy: { propertyId: { sort: "desc", nulls: "last" } },
        select: {
          cursivePixelId: true,
          lastEventAt: true,
          totalEventsCount: true,
        },
      })
      .catch(() => null),
    prisma.seoIntegration
      .findMany({
        where: { orgId, OR: [{ propertyId }, { propertyId: null }] },
        select: { provider: true, lastSyncAt: true, propertyId: true },
      })
      .catch(
        () =>
          [] as Array<{
            provider: string;
            lastSyncAt: Date | null;
            propertyId: string | null;
          }>,
      ),
    prisma.adCampaign
      .findFirst({
        where: { orgId, propertyId, platform: "GOOGLE_ADS" },
        select: { id: true },
      })
      .catch(() => null),
    prisma.adCampaign
      .findFirst({
        where: { orgId, propertyId, platform: "META" },
        select: { id: true },
      })
      .catch(() => null),
    prisma.tenantSiteConfig
      .findUnique({
        where: { orgId },
        select: {
          chatbotEnabled: true,
          chatbotPersonaName: true,
        },
      })
      .catch(() => null),
    getOpenInsights(orgId, { propertyId, limit: 3 }).catch(
      () => [] as Awaited<ReturnType<typeof getOpenInsights>>,
    ),
    getInsightCounts(orgId, { propertyIds: [propertyId] }).catch(() => ({
      critical: 0,
      warning: 0,
      info: 0,
      open: 0,
      acknowledged: 0,
      total: 0,
    })),
    prisma.lead
      .findMany({
        where: { orgId, propertyId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          source: true,
          createdAt: true,
        },
      })
      .catch(() => [] as Array<ActivityLeadRow>),
    prisma.tour
      .findMany({
        where: { propertyId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          createdAt: true,
          lead: { select: { firstName: true, lastName: true } },
        },
      })
      .catch(() => [] as Array<ActivityTourRow>),
    prisma.lease
      .findMany({
        where: { orgId, propertyId },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          monthlyRentCents: true,
          endDate: true,
          renewalSentAt: true,
          noticeGivenAt: true,
          updatedAt: true,
        },
      })
      .catch(() => [] as Array<ActivityLeaseRow>),
    prisma.propertyMention
      .findMany({
        where: { orgId, propertyId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          source: true,
          rating: true,
          authorName: true,
          publishedAt: true,
          createdAt: true,
        },
      })
      .catch(() => [] as Array<ActivityMentionRow>),
    // Norman feedback (issue #75): the Marketing box was rendering
    // static counts (listings, all-time leads) that didn't reflect the
    // operator's day-to-day marketing performance. We add chatbot
    // conversations and visitor-session aggregates here so the new
    // Marketing section can show data-backed, time-windowed metrics
    // (28-day window matches every other KPI on this page).
    prisma.chatbotConversation
      .count({ where: { orgId, propertyId, createdAt: { gte: new Date(Date.now() - WINDOW_28D_MS) } } })
      .catch(() => 0),
  ]);

  const totalUnits = property.totalUnits ?? null;
  // "Available to lease" = marketing inventory (Bug #44 parity with the
  // per-unit table). For student housing this is often next-term
  // pre-leasing, NOT current vacancy — so it must not drive occupancy.
  const rawAvailable =
    listingCounts?.availableCount != null
      ? listingCounts.availableCount
      : (listingCounts?.listings.length ?? 0);
  const availableUnits =
    totalUnits != null
      ? Math.max(0, Math.min(totalUnits, rawAvailable))
      : Math.max(0, rawAvailable);
  // Occupancy reflects CURRENT leased reality: prefer active lease count
  // (rent roll), cap at totalUnits; fall back to listings only when no
  // lease signal exists. Mirrors getPropertyOccupancy + reports/generate.
  const activeLeaseCount = rentRoll._count._all;
  const leasedUnits =
    totalUnits != null
      ? activeLeaseCount > 0
        ? Math.min(totalUnits, activeLeaseCount)
        : Math.max(0, totalUnits - availableUnits)
      : null;
  const occupancyPct =
    totalUnits != null && totalUnits > 0 && leasedUnits != null
      ? Math.max(0, Math.min(100, Math.round((leasedUnits / totalUnits) * 100)))
      : null;

  const leadsDeltaPct = pctChange(kpis.leads28d, kpis.leadsPrev28d);
  const leadsDelta =
    leadsDeltaPct == null
      ? undefined
      : {
          value: `${leadsDeltaPct > 0 ? "+" : ""}${leadsDeltaPct}%`,
          trend:
            leadsDeltaPct > 0
              ? ("up" as const)
              : leadsDeltaPct < 0
                ? ("down" as const)
                : ("flat" as const),
        };

  // Renewal buckets — 0-30 / 31-60 / 61-90 / 91-120
  const now = Date.now();
  const buckets = [
    { label: "0–30d", count: 0, rentCents: 0 },
    { label: "31–60d", count: 0, rentCents: 0 },
    { label: "61–90d", count: 0, rentCents: 0 },
    { label: "91–120d", count: 0, rentCents: 0 },
  ];
  for (const l of expiringLeases) {
    if (!l.endDate) continue;
    const days = Math.floor(
      (l.endDate.getTime() - now) / (24 * 60 * 60 * 1000),
    );
    const idx =
      days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : days <= 120 ? 3 : -1;
    if (idx < 0) continue;
    buckets[idx].count += 1;
    buckets[idx].rentCents += l.monthlyRentCents ?? 0;
  }
  const expiringTotal = buckets.reduce((s, b) => s + b.count, 0);
  const renewalsNext30Rent = buckets[0].rentCents;

  // AI insight fallback — deterministic, used only when no detector-based
  // insights exist (first hour after data lands).
  const aiInsight = buildAiInsight({
    occupancyPct,
    leasedUnits,
    totalUnits,
    availableUnits,
    leads28d: kpis.leads28d,
    leadsPrev28d: kpis.leadsPrev28d,
    tours28d: kpis.tours28d,
    applications28d: kpis.applications28d,
    expiringNext30: buckets[0].count,
    expiringNext60: buckets[1].count,
    noticeGiven: noticeResidents,
    propertyName: propertyMeta.name,
  });

  const priceRange =
    property.priceMinCents || property.priceMaxCents
      ? `${centsToUsdShort(property.priceMinCents)}${"–"}${centsToUsdShort(property.priceMaxCents)}`
      : null;

  const monthlyRentRoll = (rentRoll._sum.monthlyRentCents ?? 0) / 100;
  const monthlyRentRollDisplay =
    monthlyRentRoll > 0
      ? `$${(monthlyRentRoll / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K`
      : "—";

  // Onboarding-shell + empty-state detection.
  const appfolioConnected =
    property.backendPlatform != null && property.backendPlatform !== "NONE";
  const allTimeLeads = listingCounts?._count.leads ?? 0;
  const allTimeListings = listingCounts?._count.listings ?? 0;
  const isOnboardingShell =
    property.lifecycle === "IMPORTED" &&
    property.launchStatus === "ONBOARDING" &&
    allTimeListings === 0 &&
    allTimeLeads === 0 &&
    !cursiveIntegration?.cursivePixelId &&
    !googleAdCampaign &&
    !metaAdCampaign &&
    (seoIntegrations?.length ?? 0) === 0;
  const isEmpty =
    !isOnboardingShell &&
    allTimeListings === 0 &&
    allTimeLeads === 0 &&
    !cursiveIntegration?.cursivePixelId &&
    !googleAdCampaign &&
    !metaAdCampaign &&
    (seoIntegrations?.length ?? 0) === 0;

  // Leads KPI hint
  const leadsHint =
    kpis.leads28d === 0
      ? "First lead lands here"
      : !property.orgHasAdsModule
        ? "No paid spend"
        : `${kpis.tours28d} tours · ${kpis.applications28d} apps`;

  const renewalsHint =
    expiringTotal === 0
      ? "No leases up in 120d"
      : renewalsNext30Rent > 0
        ? `$${Math.round(renewalsNext30Rent / 100 / 1000).toLocaleString()}K of monthly rent`
        : `${expiringTotal} in next 120d`;

  // Build the unified activity timeline.
  const activity = buildActivityEvents({
    leads: recentLeads,
    tours: recentTours,
    leases: recentLeases,
    mentions: recentMentions,
  });

  // Integration health rows for the sidebar. When both a property-
  // specific record AND an org-wide record exist, prefer the more
  // specific one (propertyId !== null) so per-property configuration
  // always wins over the org default.
  const pickIntegration = (provider: string) => {
    const matches = seoIntegrations.filter((r) => r.provider === provider);
    if (matches.length === 0) return null;
    return (
      matches.find((r) => r.propertyId === propertyId) ??
      matches.find((r) => r.propertyId === null) ??
      matches[0]
    );
  };
  const ga4 = pickIntegration("GA4");
  const gsc = pickIntegration("GSC");
  const pixelHasRecentEvents =
    cursiveIntegration?.lastEventAt != null &&
    Date.now() - cursiveIntegration.lastEventAt.getTime() <
      30 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6 ls-page-fade">
      {/* Norman 2026-05-21: hero identity + headline stats now live in
          the new PropertyHeroBanner ABOVE the tab nav (see
          app/portal/properties/[id]/page.tsx). Removed the in-tab
          PropertyHeroStrip — it was a duplicate identity card showing
          the same name / units / occupancy / synced-time the banner
          already surfaces. The property side panel covers the
          remaining metadata (type, subtype, year built, etc.). */}

      {isOnboardingShell ? (
        <OnboardingShellCard
          propertyId={propertyId}
          propertyName={propertyMeta.name}
          totalUnits={property.totalUnits}
          appfolioConnected={appfolioConnected}
          lastSyncedAt={property.lastSyncedAt}
        />
      ) : isEmpty ? (
        <section className="rounded-xl border border-border bg-card p-4 md:p-6">
          <div className="mb-4">
            <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
              Get this property reporting
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              Three steps to bring {propertyMeta.name} online
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground leading-snug max-w-xl">
              Reporting, leads, and ad attribution start flowing the
              moment these pieces are in place. Pick one to get going —
              the dashboard fills in automatically.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DataPlaceholder
              intent="connect"
              icon={
                appfolioConnected ? (
                  <ListPlus className="h-4 w-4" />
                ) : (
                  <Cable className="h-4 w-4" />
                )
              }
              title={
                appfolioConnected
                  ? "1. Add a listing"
                  : "1. Connect AppFolio"
              }
              body={
                appfolioConnected
                  ? "AppFolio is wired up — add a listing manually so leads have somewhere to land."
                  : "Sync units, occupancy, and rent roll automatically from your property management system."
              }
              action={
                appfolioConnected
                  ? {
                      label: "Add a listing",
                      href: `/portal/properties/${propertyId}?tab=onboarding`,
                    }
                  : { label: "Connect AppFolio", href: "/portal/connect" }
              }
            />
            <DataPlaceholder
              intent="connect"
              icon={<MessageSquare className="h-4 w-4" />}
              title="2. Enable the chatbot"
              body="Capture renter questions 24/7 and convert them into qualified leads in your inbox."
              action={{ label: "Enable chatbot", href: "/portal/chatbot" }}
            />
            <DataPlaceholder
              intent="connect"
              icon={<Code className="h-4 w-4" />}
              title="3. Install the visitor pixel"
              body="Drop one snippet on the listing site to unlock attribution, audiences, and traffic insights."
              action={{
                label: "Install pixel",
                href: `/portal/properties/${propertyId}?tab=onboarding`,
              }}
            />
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          {/* LEFT — the work. */}
          <div className="space-y-6 min-w-0">
            {/* Norman 2026-05-21: the in-tab InsightsHero / AiInsightCard
                pair is now served by the PropertyIntelligencePanel
                rendered ABOVE the tab nav (see page.tsx). Removed here
                to eliminate the duplicate insight surface — operators
                were seeing the same recommendations stacked twice
                ("INSIGHTS FOR TELEGRAPH COMMONS" + "INTELLIGENCE · LIVE
                SIGNALS"). The new panel uses the live recommendation
                engine and supersedes both. */}

            {/* Norman 2026-05-21 second screenshot: the standalone
                Tours / Applications / Available units KPI row was
                another bulky stat surface duplicating signal that
                MarketingSection's funnel already shows (Leads → Tours
                → Applications). Removed. The "Available units" /
                "Total units" inventory signal is now surfaced as a
                fact row in the MarketingSection header so the operator
                doesn't lose it. Net: one fewer section, ~120px of
                vertical real estate reclaimed. */}

            {/* Marketing — promoted from sidebar to main column per
                Norman feedback (#75). Replaces the static listings +
                all-time leads pair (which read as 141 vs 3 and looked
                wrong) with the four marketing signals the operator
                actually uses to judge a property: organic traffic,
                paid spend, chatbot engagement, and conversion to
                application. Every metric uses the same 28-day window
                as the KPI strip above. */}
            <MarketingSection
              propertyId={propertyId}
              organicSessions28d={kpis.organicSessions28d}
              organicMapped={kpis.organicMapped}
              adSpendCents28d={kpis.adSpendCents28d}
              chatbotConversations28d={chatbotConversations28d}
              leads28d={kpis.leads28d}
              tours28d={kpis.tours28d}
              applications28d={kpis.applications28d}
              hasAdsModule={property.orgHasAdsModule}
              chatbotEnabled={tenantSiteConfig?.chatbotEnabled ?? false}
              pixelConnected={!!cursiveIntegration?.cursivePixelId}
              availableUnits={availableUnits}
              totalUnits={totalUnits}
            />

            <ActivityTimeline events={activity} />

            {/* Renewal timeline hidden (issue #77) — rent-roll cadence is
                not the LeaseStack focus. Bucket math retained above so
                downstream callers (insights, AI fallback) still work. */}
          </div>

          {/* RIGHT — sidebar. */}
          <aside className="space-y-4 min-w-0">
            <PropertyIntegrationsList
              appfolio={{
                connected: appfolioConnected,
                lastSyncedAt: property.lastSyncedAt,
              }}
              chatbot={{
                enabled: tenantSiteConfig?.chatbotEnabled ?? false,
                personaName: tenantSiteConfig?.chatbotPersonaName ?? null,
              }}
              pixel={{
                connected: !!cursiveIntegration?.cursivePixelId,
                hasRecentEvents: pixelHasRecentEvents,
                lastEventAt: cursiveIntegration?.lastEventAt ?? null,
              }}
              ga4={{
                connected: !!ga4,
                lastSyncAt: ga4?.lastSyncAt ?? null,
              }}
              gsc={{
                connected: !!gsc,
                lastSyncAt: gsc?.lastSyncAt ?? null,
              }}
            />

            <PropertyMetaCard
              propertyType={property.propertyType}
              residentialSubtype={property.residentialSubtype}
              commercialSubtype={property.commercialSubtype}
              totalUnits={totalUnits}
              yearBuilt={property.yearBuilt}
              backendPlatform={property.backendPlatform}
              backendPropertyGroup={property.backendPropertyGroup}
              lastSyncedAt={property.lastSyncedAt}
            />

            {/* MarketingCard moved to main column as <MarketingSection>
                per issue #75. Description + price-range still useful
                context; surfaced inline on the meta card instead. */}
            {(property.description || priceRange) ? (
              <PropertyDescriptionCard
                description={property.description}
                priceRange={priceRange}
              />
            ) : null}

            {/* Norman audit 2026-05-21: closing the loop on the half-
                built #68 + #54 pair. AttributesEditor lets operators
                actually assign assetCategory + profileTags to a
                property — without it the filter chips on
                /portal/properties had nothing to filter against. */}
            <AttributesEditor
              propertyId={propertyId}
              initialAssetCategory={property.assetCategory ?? null}
              initialProfileTags={property.profileTags ?? []}
            />

            {/* Quick actions hidden (issue #76) — Open in AppFolio,
                Edit listing details, and Property settings either 404 or
                land on a half-built onboarding flow. Re-enable once each
                target route is functional end-to-end. */}
            {/* <QuickActionsCard
              propertyId={propertyId}
              backendPlatform={property.backendPlatform}
            /> */}
          </aside>
        </div>
      )}
    </div>
  );
}
