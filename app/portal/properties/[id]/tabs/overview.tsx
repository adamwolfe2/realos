import { prisma } from "@/lib/db";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
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
  Sparkles,
  Cable,
  MessageSquare,
  Code,
  ListPlus,
  Building2,
  UserPlus,
  CalendarCheck,
  FileText,
  Star,
  FileSignature,
  ExternalLink,
  Settings,
  Pencil,
  Activity,
} from "lucide-react";
import { DataPlaceholder } from "@/components/portal/ui/data-placeholder";
import { InsightsHero } from "@/components/portal/dashboard/insights-hero";
import {
  getOpenInsights,
  getInsightCounts,
} from "@/lib/insights/queries";
import type { InsightCardData } from "@/components/portal/insights/insight-card";

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
  const rawAvailable =
    listingCounts?.availableCount != null
      ? listingCounts.availableCount
      : (listingCounts?.listings.length ?? 0);
  const availableUnits =
    totalUnits != null
      ? Math.max(0, Math.min(totalUnits, rawAvailable))
      : Math.max(0, rawAvailable);
  const leasedUnits =
    totalUnits != null ? Math.max(0, totalUnits - availableUnits) : null;
  const occupancyPct =
    totalUnits != null && totalUnits > 0 && leasedUnits != null
      ? Math.round((leasedUnits / totalUnits) * 100)
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
      {/* 1. Hero strip — name, photo, fact row. */}
      <PropertyHeroStrip
        name={propertyMeta.name}
        totalUnits={totalUnits}
        leasedUnits={leasedUnits}
        occupancyPct={occupancyPct}
        monthlyRentRollDisplay={monthlyRentRollDisplay}
        heroImageUrl={property.heroImageUrl ?? null}
        propertyType={property.propertyType}
        propertySubtype={
          property.residentialSubtype ?? property.commercialSubtype ?? null
        }
        yearBuilt={property.yearBuilt}
        lastSyncedAt={property.lastSyncedAt}
      />

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
            {propertyInsights.length > 0 ? (
              <InsightsHero
                insights={propertyInsights as InsightCardData[]}
                counts={{
                  critical: propertyInsightCounts.critical,
                  warning: propertyInsightCounts.warning,
                  info: propertyInsightCounts.info,
                  total: propertyInsightCounts.total,
                }}
                scope={{
                  kind: "property",
                  propertyId,
                  propertyName: propertyMeta.name,
                }}
              />
            ) : (
              <AiInsightCard insight={aiInsight} />
            )}

            {/* KPI tiles. Norman feedback (issues #71, #72, #77): we're
                pivoting away from rent-roll metrics (occupancy, monthly
                rent, renewals) toward marketing/website performance
                metrics. Occupancy + Monthly rent + Renewals tiles are
                hidden; tours and applications surface from the same KPI
                bundle without pulling rent data into the UI. */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <KpiTile
                label="Leads (28d)"
                value={kpis.leads28d > 0 ? kpis.leads28d : <DimZero />}
                delta={leadsDelta}
                hint={leadsHint}
              />
              <KpiTile
                label="Tours (28d)"
                value={kpis.tours28d > 0 ? kpis.tours28d : <DimZero />}
                hint={
                  kpis.tours28d === 0
                    ? "Tours show as leads schedule them"
                    : `${kpis.applications28d} applications`
                }
              />
              <KpiTile
                label="Applications (28d)"
                value={
                  kpis.applications28d > 0 ? kpis.applications28d : <DimZero />
                }
                hint={
                  kpis.applications28d === 0
                    ? "First application lands here"
                    : "Last 28 days"
                }
              />
              <KpiTile
                label="Available units"
                value={availableUnits > 0 ? availableUnits : <DimZero />}
                hint={
                  totalUnits != null
                    ? `${totalUnits.toLocaleString()} total units`
                    : "Connect AppFolio for live unit data"
                }
              />
            </section>

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

// ---------------------------------------------------------------------------
// PropertyHeroStrip — simplified. Photo + name + a single horizontal fact
// row. No ring, no briefing, no quick-actions rail.
// ---------------------------------------------------------------------------

function PropertyHeroStrip({
  name,
  totalUnits,
  leasedUnits,
  occupancyPct,
  monthlyRentRollDisplay,
  heroImageUrl,
  propertyType,
  propertySubtype,
  yearBuilt,
  lastSyncedAt,
}: {
  name: string;
  totalUnits: number | null;
  leasedUnits: number | null;
  occupancyPct: number | null;
  monthlyRentRollDisplay: string;
  heroImageUrl: string | null;
  propertyType: PropertyType;
  propertySubtype: ResidentialSubtype | CommercialSubtype | null;
  yearBuilt: number | null;
  lastSyncedAt: Date | null;
}) {
  const subtypeLabel =
    typeof propertySubtype === "string"
      ? propertySubtype.replace(/_/g, " ").toLowerCase()
      : null;
  const typeLine =
    subtypeLabel ??
    (propertyType ? propertyType.replace(/_/g, " ").toLowerCase() : null);

  const facts: string[] = [];
  if (totalUnits != null) {
    facts.push(`${totalUnits} units`);
  }
  if (occupancyPct != null) {
    facts.push(`${occupancyPct}% occupied`);
  } else if (totalUnits != null && leasedUnits != null) {
    facts.push(`${leasedUnits} of ${totalUnits} leased`);
  }
  if (monthlyRentRollDisplay !== "—") {
    facts.push(`${monthlyRentRollDisplay}/mo rent roll`);
  }
  if (yearBuilt) {
    facts.push(`built ${yearBuilt}`);
  }
  if (lastSyncedAt) {
    facts.push(`synced ${formatAge(lastSyncedAt)}`);
  }
  // Build a Pacific-time hover label for the whole fact row when we
  // have a sync timestamp — operators are PT-based so they expect the
  // absolute time to land in their local zone, not UTC. Issue #58.
  const syncedTitle = lastSyncedAt
    ? `Last synced ${formatPacific(lastSyncedAt)}`
    : undefined;

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-4 p-4 md:p-5">
        {heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImageUrl}
            alt={name}
            className="h-20 w-20 rounded-lg object-cover border border-border shrink-0"
          />
        ) : (
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0 border border-border">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="text-lg md:text-xl font-semibold text-foreground tracking-tight truncate">
            {name}
          </h2>
          {typeLine ? (
            <p className="mt-0.5 text-[11px] uppercase tracking-widest font-semibold text-muted-foreground first-letter:capitalize">
              {typeLine}
            </p>
          ) : null}
          {facts.length > 0 ? (
            <p
              className="mt-1.5 text-[12.5px] text-muted-foreground tabular-nums leading-snug"
              title={syncedTitle}
            >
              {facts.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// AI insight — fallback only. Used when the detector library hasn't run yet.
// ---------------------------------------------------------------------------

type InsightSeverity = "alert" | "warn" | "info" | "ok";
type AiInsightShape = {
  severity: InsightSeverity;
  headline: string;
  body: string;
};

function buildAiInsight(args: {
  occupancyPct: number | null;
  leasedUnits: number | null;
  totalUnits: number | null;
  availableUnits: number;
  leads28d: number;
  leadsPrev28d: number;
  tours28d: number;
  applications28d: number;
  expiringNext30: number;
  expiringNext60: number;
  noticeGiven: number;
  propertyName: string;
}): AiInsightShape {
  const candidates: AiInsightShape[] = [];

  if (
    args.occupancyPct != null &&
    args.occupancyPct < 80 &&
    args.availableUnits > 0
  ) {
    candidates.push({
      severity: "alert",
      headline: `Occupancy at ${args.occupancyPct}%. ${args.availableUnits} units sitting.`,
      body: `${args.propertyName} is below the 90% target. Push paid spend here, accelerate scheduled tours, and check listing photos on Available units.`,
    });
  }
  if (args.expiringNext30 >= 5) {
    candidates.push({
      severity: "alert",
      headline: `${args.expiringNext30} leases expire in 30 days`,
      body: `Renewal offers should already be out. Run the renewals report and confirm every resident has been contacted.`,
    });
  }
  if (
    args.leadsPrev28d > 5 &&
    args.leads28d < Math.round(args.leadsPrev28d * 0.6)
  ) {
    const dropPct = Math.round(
      (1 - args.leads28d / args.leadsPrev28d) * 100,
    );
    candidates.push({
      severity: "warn",
      headline: `Lead volume down ${dropPct}% week-over-week`,
      body: `Check ad spend pacing and chatbot capture rate. ${args.leadsPrev28d} leads previous window vs ${args.leads28d} now.`,
    });
  }
  if (args.leads28d >= 10 && args.tours28d === 0) {
    candidates.push({
      severity: "warn",
      headline: `${args.leads28d} leads, zero tours scheduled`,
      body: `Leads aren't converting to scheduled tours. Audit chatbot prompts and lead-response speed; the first reply window is decisive.`,
    });
  }
  if (args.tours28d >= 5 && args.applications28d === 0) {
    candidates.push({
      severity: "warn",
      headline: `${args.tours28d} tours, zero applications`,
      body: `Tours are happening but converting at 0%. Check pricing positioning and tour follow-up cadence.`,
    });
  }
  if (args.noticeGiven >= 5) {
    candidates.push({
      severity: "warn",
      headline: `${args.noticeGiven} residents have given notice`,
      body: `Predictive availability says these units come open soon. Get listings live now to bridge the gap.`,
    });
  }
  if (
    args.occupancyPct != null &&
    args.occupancyPct >= 95 &&
    args.expiringNext60 < 5
  ) {
    candidates.push({
      severity: "ok",
      headline: `Strong: ${args.occupancyPct}% occupied, low near-term churn`,
      body: `${args.propertyName} is performing well. Use the spare cycles to test rent increases on the next renewal cohort.`,
    });
  }

  if (candidates.length === 0) {
    return {
      severity: "info",
      headline: "Quiet on the data front",
      body: `Not enough signal yet to flag an action. Once leads, tours, and lease activity pick up, the model will surface what to do next.`,
    };
  }
  const order: Record<InsightSeverity, number> = {
    alert: 0,
    warn: 1,
    info: 2,
    ok: 3,
  };
  candidates.sort((a, b) => order[a.severity] - order[b.severity]);
  return candidates[0];
}

function AiInsightCard({ insight }: { insight: AiInsightShape }) {
  const tone =
    insight.severity === "alert"
      ? "border-primary/40 bg-primary/10 text-primary"
      : insight.severity === "warn"
        ? "border-primary/25 bg-primary/5 text-foreground"
        : insight.severity === "ok"
          ? "border-primary/25 bg-primary/5 text-primary"
          : "border-border bg-muted/30 text-foreground";
  return (
    <div
      className={`rounded-xl border px-3 py-2 flex items-start gap-2.5 ${tone}`}
    >
      <Sparkles className="h-4 w-4 shrink-0 mt-0.5 opacity-80" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-tight leading-tight">
          {insight.headline}
        </p>
        <p className="text-[11px] mt-0.5 opacity-90 leading-snug">
          {insight.body}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity timeline — unified feed across leads, tours, leases, mentions.
// ---------------------------------------------------------------------------

type ActivityKind = "lead" | "tour" | "lease" | "review" | "renewal" | "notice";

type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  summary: string;
  occurredAt: Date;
};

type ActivityLeadRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  source: string;
  createdAt: Date;
};
type ActivityTourRow = {
  id: string;
  status: string;
  scheduledAt: Date | null;
  createdAt: Date;
  lead: { firstName: string | null; lastName: string | null } | null;
};
type ActivityLeaseRow = {
  id: string;
  status: string;
  monthlyRentCents: number | null;
  endDate: Date | null;
  renewalSentAt: Date | null;
  noticeGivenAt: Date | null;
  updatedAt: Date;
};
type ActivityMentionRow = {
  id: string;
  source: string;
  rating: number | null;
  authorName: string | null;
  publishedAt: Date | null;
  createdAt: Date;
};

function fullName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  const joined = [f, l].filter(Boolean).join(" ");
  return joined.length > 0 ? joined : "Someone";
}

function sourceWord(source: string): string {
  const map: Record<string, string> = {
    GOOGLE_ADS: "Google Ads",
    META_ADS: "Meta Ads",
    ORGANIC: "organic",
    CHATBOT: "the chatbot",
    FORM: "the web form",
    PIXEL_OUTREACH: "pixel outreach",
    REFERRAL: "a referral",
    DIRECT: "direct",
    EMAIL_CAMPAIGN: "email",
    COLD_EMAIL: "cold email",
    MANUAL: "manual entry",
    OTHER: "other",
  };
  return map[source] ?? source.replace(/_/g, " ").toLowerCase();
}

function buildActivityEvents({
  leads,
  tours,
  // Lease activity intentionally not rendered in the timeline. Norman
  // feedback (issue #73): "Lease signed" / renewal-sent events are
  // rent-roll reporting territory and pull focus from marketing-side
  // signals (leads, tours, applications, reviews). The query still runs
  // so we can re-enable cheaply if/when we add an ops-flavoured view.
  leases: _leases,
  mentions,
}: {
  leads: ActivityLeadRow[];
  tours: ActivityTourRow[];
  leases: ActivityLeaseRow[];
  mentions: ActivityMentionRow[];
}): ActivityEvent[] {
  void _leases;
  const events: ActivityEvent[] = [];

  for (const l of leads) {
    events.push({
      id: `lead:${l.id}`,
      kind: "lead",
      summary: `${fullName(l.firstName, l.lastName)} came in via ${sourceWord(l.source)}`,
      occurredAt: l.createdAt,
    });
  }

  for (const t of tours) {
    const who = fullName(t.lead?.firstName, t.lead?.lastName);
    let summary = `${who} requested a tour`;
    if (t.status === "SCHEDULED" || t.status === "REQUESTED") {
      summary = t.scheduledAt
        ? `${who} scheduled a tour for ${formatShortDate(t.scheduledAt)}`
        : `${who} requested a tour`;
    } else if (t.status === "COMPLETED") {
      summary = `${who} completed a tour`;
    } else if (t.status === "NO_SHOW") {
      summary = `${who} no-showed for tour`;
    } else if (t.status === "CANCELLED") {
      summary = `${who} cancelled a tour`;
    }
    events.push({
      id: `tour:${t.id}`,
      kind: "tour",
      summary,
      occurredAt: t.createdAt,
    });
  }

  // Lease loop intentionally omitted — see "leases: _leases" comment above.

  for (const m of mentions) {
    const who = m.authorName ?? "Someone";
    const sourceLabel =
      m.source === "GOOGLE_REVIEW"
        ? "Google"
        : m.source === "YELP"
          ? "Yelp"
          : m.source === "REDDIT"
            ? "Reddit"
            : m.source === "FACEBOOK_PUBLIC"
              ? "Facebook"
              : "web";
    const rating = m.rating != null ? ` (${m.rating}★)` : "";
    events.push({
      id: `mention:${m.id}`,
      kind: "review",
      summary: `${who} left a ${sourceLabel} review${rating}`,
      occurredAt: m.publishedAt ?? m.createdAt,
    });
  }

  events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return events.slice(0, 8);
}

function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Activity
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            Recent events
          </h3>
        </div>
        {events.length > 0 ? (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Latest {events.length}
          </span>
        ) : null}
      </div>

      {events.length === 0 ? (
        <div className="flex items-center gap-2.5 px-1 py-3 text-muted-foreground">
          <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-[12px] leading-snug">
            Activity appears as leads, tours, and leases come in.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <ActivityRow key={e.id} event={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const { Icon, tone } = activityVisual(event.kind);
  return (
    <li className="flex items-start gap-3 min-w-0">
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${tone}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 flex items-baseline justify-between gap-3">
        <p className="text-[12.5px] text-foreground leading-snug truncate">
          {event.summary}
        </p>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {formatAgeShort(event.occurredAt)}
        </span>
      </div>
    </li>
  );
}

function activityVisual(kind: ActivityKind): {
  Icon: typeof UserPlus;
  tone: string;
} {
  switch (kind) {
    case "lead":
      return { Icon: UserPlus, tone: "bg-primary/10 text-primary" };
    case "tour":
      return { Icon: CalendarCheck, tone: "bg-primary/10 text-primary" };
    case "lease":
      return { Icon: FileSignature, tone: "bg-muted text-foreground" };
    case "renewal":
      return { Icon: FileText, tone: "bg-amber-500/10 text-amber-600" };
    case "notice":
      return { Icon: FileText, tone: "bg-amber-500/10 text-amber-600" };
    case "review":
      return { Icon: Star, tone: "bg-muted text-muted-foreground" };
  }
}

// ---------------------------------------------------------------------------
// Renewal timeline — horizontal 4-bucket stack.
// ---------------------------------------------------------------------------

function RenewalTimeline({
  buckets,
  total,
}: {
  buckets: Array<{ label: string; count: number; rentCents: number }>;
  total: number;
}) {
  // Opacity ramps down from urgent (0-30d) to far-out (91-120d).
  // Hand-picked Tailwind opacity classes so we don't depend on the
  // CSS `rgb(from …)` relative-color syntax landing in every browser.
  const tones = [
    "bg-primary/15 border-primary/30",
    "bg-primary/10 border-primary/20",
    "bg-primary/[0.06] border-border",
    "bg-muted/40 border-border",
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Next 120 days
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            Renewal pipeline
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {total === 0
            ? "Nothing in window"
            : `${total} ${total === 1 ? "lease" : "leases"}`}
        </span>
      </div>

      {total === 0 ? (
        <p className="text-[12px] text-muted-foreground leading-snug">
          No leases expiring in the next 120 days. Renewal cohorts appear here
          as lease end dates enter the window.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {buckets.map((b, i) => (
            <div
              key={b.label}
              className={`rounded-lg border px-3 py-2.5 min-w-0 ${tones[i]}`}
            >
              <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                {b.label}
              </p>
              <p className="mt-1 text-base font-semibold text-foreground tabular-nums">
                {b.count.toLocaleString()}
                <span className="ml-1 text-[10.5px] font-normal text-muted-foreground">
                  {b.count === 1 ? "lease" : "leases"}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums truncate">
                {b.rentCents > 0
                  ? `$${Math.round(b.rentCents / 100).toLocaleString()}/mo`
                  : "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sidebar — integrations list.
// ---------------------------------------------------------------------------

type IntegrationHealth = "healthy" | "degraded" | "off";

function PropertyIntegrationsList({
  appfolio,
  chatbot,
  pixel,
  ga4,
  gsc,
}: {
  appfolio: { connected: boolean; lastSyncedAt: Date | null };
  chatbot: { enabled: boolean; personaName: string | null };
  pixel: {
    connected: boolean;
    hasRecentEvents: boolean;
    lastEventAt: Date | null;
  };
  ga4: { connected: boolean; lastSyncAt: Date | null };
  gsc: { connected: boolean; lastSyncAt: Date | null };
}) {
  const rows: Array<{
    name: string;
    state: string;
    health: IntegrationHealth;
  }> = [
    {
      name: "AppFolio",
      state: appfolio.connected
        ? appfolio.lastSyncedAt
          ? `synced ${formatAge(appfolio.lastSyncedAt)}`
          : "connected"
        : "not connected",
      health: appfolio.connected
        ? appfolio.lastSyncedAt &&
          Date.now() - appfolio.lastSyncedAt.getTime() <
            7 * 24 * 60 * 60 * 1000
          ? "healthy"
          : "degraded"
        : "off",
    },
    {
      name: "Chatbot",
      state: chatbot.enabled
        ? chatbot.personaName
          ? `"${chatbot.personaName}" live`
          : "live"
        : "not enabled",
      health: chatbot.enabled ? "healthy" : "off",
    },
    {
      name: "Cursive Pixel",
      state: !pixel.connected
        ? "not installed"
        : pixel.hasRecentEvents
          ? "live"
          : "no recent events",
      health: !pixel.connected
        ? "off"
        : pixel.hasRecentEvents
          ? "healthy"
          : "degraded",
    },
    {
      name: "GA4",
      state: ga4.connected
        ? ga4.lastSyncAt
          ? `synced ${formatAge(ga4.lastSyncAt)}`
          : "connected"
        : "not connected",
      health: ga4.connected ? "healthy" : "off",
    },
    {
      name: "Search Console",
      state: gsc.connected
        ? gsc.lastSyncAt
          ? `synced ${formatAge(gsc.lastSyncAt)}`
          : "connected"
        : "not connected",
      health: gsc.connected ? "healthy" : "off",
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
        Integrations
      </p>
      <ul className="mt-2 space-y-2.5">
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex items-center justify-between gap-3 min-w-0"
          >
            <span className="flex items-center gap-2 min-w-0">
              <StatusDot health={row.health} />
              <span className="text-[12px] font-medium text-foreground truncate">
                {row.name}
              </span>
            </span>
            <span className="text-[11px] text-muted-foreground shrink-0 truncate max-w-[55%] text-right">
              {row.state}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusDot({ health }: { health: IntegrationHealth }) {
  const cls =
    health === "healthy"
      ? "bg-green-500"
      : health === "degraded"
        ? "bg-amber-500"
        : "bg-muted-foreground/30";
  return (
    <span
      className={`h-2 w-2 rounded-full shrink-0 ${cls}`}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Sidebar — property meta card.
// ---------------------------------------------------------------------------

function PropertyMetaCard({
  propertyType,
  residentialSubtype,
  commercialSubtype,
  totalUnits,
  yearBuilt,
  backendPlatform,
  backendPropertyGroup,
  lastSyncedAt,
}: {
  propertyType: PropertyType;
  residentialSubtype: ResidentialSubtype | null;
  commercialSubtype: CommercialSubtype | null;
  totalUnits: number | null;
  yearBuilt: number | null;
  backendPlatform: BackendPlatform;
  backendPropertyGroup: string | null;
  lastSyncedAt: Date | null;
}) {
  const subtype = residentialSubtype ?? commercialSubtype ?? null;
  const rows: Array<[string, string]> = [];
  if (propertyType) {
    rows.push(["Type", propertyType.replace(/_/g, " ").toLowerCase()]);
  }
  if (subtype) {
    rows.push(["Subtype", subtype.replace(/_/g, " ").toLowerCase()]);
  }
  if (totalUnits != null) {
    rows.push(["Units", totalUnits.toLocaleString()]);
  }
  if (yearBuilt != null) {
    rows.push(["Built", yearBuilt.toString()]);
  }
  if (backendPlatform && backendPlatform !== "NONE") {
    rows.push(["Backend", backendPlatform]);
  }
  if (backendPropertyGroup) {
    rows.push(["Group", backendPropertyGroup]);
  }
  if (lastSyncedAt) {
    rows.push(["Synced", formatAge(lastSyncedAt)]);
  }

  if (rows.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
        Property
      </p>
      <dl className="mt-2 space-y-1.5 text-[12px]">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex items-baseline justify-between gap-3 min-w-0"
          >
            <dt className="text-muted-foreground shrink-0">{k}</dt>
            <dd className="text-right text-foreground truncate first-letter:capitalize">
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Marketing section — promoted from sidebar to a main-column block per
// Norman feedback (issue #75). Renders four data-backed marketing
// signals over a 28-day window plus a conversion funnel mini-chart.
// Empties out cleanly when the data source isn't connected (chatbot
// off → "Connect" callout instead of "0 conversations").
// ---------------------------------------------------------------------------

function MarketingSection({
  propertyId,
  organicSessions28d,
  organicMapped,
  adSpendCents28d,
  chatbotConversations28d,
  leads28d,
  tours28d,
  applications28d,
  hasAdsModule,
  chatbotEnabled,
  pixelConnected,
}: {
  propertyId: string;
  organicSessions28d: number | null;
  organicMapped: boolean;
  adSpendCents28d: number;
  chatbotConversations28d: number;
  leads28d: number;
  tours28d: number;
  applications28d: number;
  hasAdsModule: boolean;
  chatbotEnabled: boolean;
  pixelConnected: boolean;
}) {
  void pixelConnected;
  // Conversion: leads / organic sessions. We use organic sessions as
  // the denominator (the audience the operator is actually responsible
  // for marketing to) rather than total visitors — paid sessions are
  // expected to convert and skew the ratio. Capped at 100% defensively.
  const conversionPct =
    organicSessions28d && organicSessions28d > 0
      ? Math.min(100, Math.round((leads28d / organicSessions28d) * 100))
      : null;

  type Metric = {
    label: string;
    value: React.ReactNode;
    hint: string;
    cta?: { label: string; href: string };
  };
  const metrics: Metric[] = [];

  metrics.push({
    label: "Organic sessions (28d)",
    value: organicMapped && organicSessions28d != null
      ? organicSessions28d.toLocaleString()
      : <DimZero />,
    hint: organicMapped
      ? organicSessions28d && organicSessions28d > 0
        ? "From GA4 / GSC matched URLs"
        : "GA4 connected, no sessions yet"
      : "Map a domain to surface organic traffic",
    cta: organicMapped
      ? undefined
      : { label: "Connect GA4", href: "/portal/connect" },
  });

  metrics.push({
    label: "Chatbot conversations (28d)",
    value: chatbotEnabled
      ? chatbotConversations28d > 0
        ? chatbotConversations28d.toLocaleString()
        : <DimZero />
      : <DimZero />,
    hint: chatbotEnabled
      ? chatbotConversations28d > 0
        ? "On-site capture"
        : "First conversation lands here"
      : "Chatbot off",
    cta: chatbotEnabled
      ? undefined
      : { label: "Enable chatbot", href: "/portal/chatbot" },
  });

  metrics.push({
    label: "Ad spend (28d)",
    value: hasAdsModule
      ? adSpendCents28d > 0
        ? centsToUsdShort(adSpendCents28d)
        : <DimZero />
      : <DimZero />,
    hint: hasAdsModule
      ? adSpendCents28d > 0
        ? `${leads28d > 0 ? `${centsToUsdShort(Math.round(adSpendCents28d / leads28d))}/lead` : "No leads attributed"}`
        : "No spend in window"
      : "Ad modules off",
    cta: hasAdsModule
      ? undefined
      : { label: "Connect ads", href: "/portal/connect" },
  });

  metrics.push({
    label: "Conversion rate",
    value: conversionPct != null ? `${conversionPct}%` : <DimZero />,
    hint:
      conversionPct == null
        ? organicMapped
          ? "Needs traffic + leads"
          : "Map a domain first"
        : `${leads28d} ${leads28d === 1 ? "lead" : "leads"} from ${organicSessions28d?.toLocaleString() ?? 0} sessions`,
  });

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Last 28 days
          </p>
          <h3 className="text-sm font-semibold text-foreground">Marketing</h3>
        </div>
        <a
          href={`/portal/properties/${propertyId}?tab=traffic`}
          className="text-[11.5px] font-semibold text-primary hover:underline whitespace-nowrap"
        >
          Open traffic →
        </a>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-border bg-muted/20 p-3 min-w-0"
          >
            <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground truncate">
              {m.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground tabular-nums leading-none">
              {m.value}
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
              {m.hint}
            </p>
            {m.cta ? (
              <a
                href={m.cta.href}
                className="mt-2 inline-flex text-[11px] font-semibold text-primary hover:underline"
              >
                {m.cta.label} →
              </a>
            ) : null}
          </div>
        ))}
      </div>

      {/* Funnel mini — sessions → leads → tours → applications.
          Hidden when there's no data in any stage so we don't render an
          empty rail. */}
      {leads28d > 0 || tours28d > 0 || applications28d > 0 ? (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground mb-2">
            Funnel
          </p>
          <FunnelMini
            stages={[
              {
                label: "Organic sessions",
                value: organicSessions28d ?? 0,
              },
              { label: "Leads", value: leads28d },
              { label: "Tours", value: tours28d },
              { label: "Applications", value: applications28d },
            ]}
          />
        </div>
      ) : null}
    </section>
  );
}

function FunnelMini({
  stages,
}: {
  stages: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <ul className="space-y-1.5">
      {stages.map((s) => {
        const pct = Math.round((s.value / max) * 100);
        return (
          <li key={s.label} className="grid grid-cols-[140px_1fr_auto] items-center gap-3 min-w-0">
            <span className="text-[11.5px] text-muted-foreground truncate">
              {s.label}
            </span>
            <span className="relative h-2 rounded-full bg-muted overflow-hidden">
              <span
                className="absolute inset-y-0 left-0 bg-primary/60 rounded-full"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-foreground shrink-0">
              {s.value.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function PropertyDescriptionCard({
  description,
  priceRange,
}: {
  description: string | null;
  priceRange: string | null;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
        Listing
      </p>
      {priceRange ? (
        <p className="mt-1.5 text-[12px] text-foreground">
          <span className="text-muted-foreground">Price range</span>{" "}
          <span className="font-medium tabular-nums">{priceRange}</span>
        </p>
      ) : null}
      {description ? (
        <p className="mt-2 text-[11.5px] text-muted-foreground leading-snug line-clamp-3">
          {description}
        </p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sidebar — quick actions.
// ---------------------------------------------------------------------------

function QuickActionsCard({
  propertyId,
  backendPlatform,
}: {
  propertyId: string;
  backendPlatform: BackendPlatform;
}) {
  const showAppFolioLink = backendPlatform === "APPFOLIO";

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
        Quick actions
      </p>
      <ul className="mt-2 space-y-1">
        {showAppFolioLink ? (
          <li>
            <a
              href="https://app.appfolio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[12.5px] text-foreground hover:text-primary transition-colors py-1"
            >
              <ExternalLink
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              Open in AppFolio
            </a>
          </li>
        ) : null}
        <li>
          <a
            href={`/portal/properties/${propertyId}?tab=onboarding`}
            className="flex items-center gap-2 text-[12.5px] text-foreground hover:text-primary transition-colors py-1"
          >
            <Pencil
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            Edit listing details
          </a>
        </li>
        <li>
          <a
            href={`/portal/properties/${propertyId}?tab=onboarding`}
            className="flex items-center gap-2 text-[12.5px] text-foreground hover:text-primary transition-colors py-1"
          >
            <Settings
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            Property settings
          </a>
        </li>
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sparse-data primitives.
// ---------------------------------------------------------------------------

function DimZero() {
  return <span className="text-muted-foreground/40 tabular-nums">—</span>;
}

// Compact "Property in onboarding" card. Renders in place of the dense
// dashboard layout for AppFolio-imported rows that haven't been activated.
function OnboardingShellCard({
  propertyId,
  propertyName,
  totalUnits,
  appfolioConnected,
  lastSyncedAt,
}: {
  propertyId: string;
  propertyName: string;
  totalUnits: number | null;
  appfolioConnected: boolean;
  lastSyncedAt: Date | null;
}) {
  const syncedLabel = lastSyncedAt
    ? `Last synced ${formatAge(lastSyncedAt)}`
    : "Not synced yet";
  return (
    <section className="rounded-xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Property in onboarding
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            {propertyName}
          </h2>
          <p className="mt-1 text-[12px] text-muted-foreground leading-snug max-w-[44ch]">
            Imported from AppFolio and waiting on activation.
            {totalUnits != null
              ? ` ${totalUnits} unit${totalUnits === 1 ? "" : "s"}.`
              : ""}{" "}
            {syncedLabel}.
          </p>
          <p className="mt-3 text-[11.5px] text-muted-foreground leading-snug max-w-[52ch]">
            Activate this property to start tracking leads, tours,
            applications, and ad attribution. The full dashboard fills
            in automatically once the first listing or lead lands.
          </p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <a
              href={`/portal/properties/${propertyId}?tab=onboarding`}
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-[12px] font-semibold hover:bg-primary-dark transition-colors"
            >
              Activate this property
            </a>
            {!appfolioConnected ? (
              <a
                href="/portal/connect"
                className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                Connect AppFolio
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers.
// ---------------------------------------------------------------------------

function formatAge(date: Date): string {
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// Norman feedback (issue #58): the "Last synced" relative-time labels
// were timezone-agnostic ("5h ago") but when operators hovered or
// inspected the value they got UTC or browser-local time. SG operates
// out of US Pacific, so this helper formats an absolute date string in
// Pacific time and returns it for use in title= tooltips alongside the
// relative-time label.
function formatPacific(date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      dateStyle: "medium",
      timeStyle: "short",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

// Tighter timestamp for activity rows — no "ago" suffix to keep the
// right-rail width predictable.
function formatAgeShort(date: Date): string {
  const ms = date.getTime() - Date.now();
  const past = ms <= 0;
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60000);
  if (past) {
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 14) return `${days}d`;
    return formatShortDate(date);
  }
  // Future (scheduled tour, lease end). Show calendar date.
  return formatShortDate(date);
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatRentShort(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K`;
  }
  return `$${dollars.toLocaleString()}`;
}
