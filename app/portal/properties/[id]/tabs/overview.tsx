import { prisma } from "@/lib/db";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import {
  getPropertyOverviewKpis,
  centsToUsdShort,
  pctChange,
} from "@/lib/properties/queries";
import {
  LeaseStatus,
  TourStatus,
  type BackendPlatform,
  type CommercialSubtype,
  type PropertyLifecycle,
  type PropertyLaunchStatus,
  type PropertyType,
  type ResidentialSubtype,
  type LeadSource,
  type ResidentStatus,
} from "@prisma/client";
import { Sparkles, Cable, MessageSquare, Code, ListPlus, Building2 } from "lucide-react";
import { DataPlaceholder } from "@/components/portal/ui/data-placeholder";
import { AnimatedNumber } from "@/components/portal/ui/animated-number";
import { InsightsHero } from "@/components/portal/dashboard/insights-hero";
import {
  getOpenInsights,
  getInsightCounts,
} from "@/lib/insights/queries";
import type { InsightCardData } from "@/components/portal/insights/insight-card";
import { cn } from "@/lib/utils";

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

const SOURCE_LABEL: Record<LeadSource, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  ORGANIC: "Organic",
  CHATBOT: "Chatbot",
  FORM: "Web form",
  PIXEL_OUTREACH: "Pixel outreach",
  REFERRAL: "Referral",
  DIRECT: "Direct",
  EMAIL_CAMPAIGN: "Email",
  COLD_EMAIL: "Cold email",
  MANUAL: "Manual",
  OTHER: "Other",
};

// Single muted accent palette so the donut reads as data, not as a rainbow.
// All slices step through the brand blue scale, with neutral gray taking
// over once we run out of blue tones for long-tail buckets.
const CHART_COLORS = [
  "#1D4ED8",
  "#2563EB",
  "#3B82F6",
  "#60A5FA",
  "#93C5FD",
  "#9CA3AF",
  "#D1D5DB",
  "#E5E7EB",
];

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
  const since28d = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const next120 = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);

  const [
    kpis,
    listingCounts,
    leadSourceGroups,
    expiringLeases,
    activeResidents,
    noticeResidents,
    rentRoll,
    // Bug #27 — Overview tab focus pivot. Pull which marketing
    // features are currently active for this property so we can
    // surface a "What's running" status strip near the top.
    cursiveIntegration,
    seoIntegrations,
    googleAdCampaign,
    metaAdCampaign,
    chatbotConfig,
    latestReputationScan,
    chatbotConvos28d,
    reputationMentionTotal,
    reputationUnreviewedCount,
    propertyInsights,
    propertyInsightCounts,
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
    prisma.lead.groupBy({
      by: ["source"],
      where: { orgId, propertyId, createdAt: { gte: since28d } },
      _count: { _all: true },
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
      where: { orgId, propertyId, status: "ACTIVE" as ResidentStatus },
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
    prisma.cursiveIntegration
      .findFirst({
        where: { orgId, propertyId },
        select: { cursivePixelId: true, lastEventAt: true },
      })
      .catch(() => null),
    prisma.seoIntegration
      .findMany({
        where: { orgId, propertyId },
        select: { provider: true, lastSyncAt: true },
      })
      .catch(() => [] as Array<{ provider: string; lastSyncAt: Date | null }>),
    prisma.adCampaign
      .findFirst({
        where: { orgId, propertyId, platform: "GOOGLE_ADS" },
        select: { id: true, status: true },
      })
      .catch(() => null),
    prisma.adCampaign
      .findFirst({
        where: { orgId, propertyId, platform: "META" },
        select: { id: true, status: true },
      })
      .catch(() => null),
    prisma.organization
      .findUnique({
        where: { id: orgId },
        select: {
          tenantSiteConfig: { select: { chatbotEnabled: true } },
        },
      })
      .catch(() => null),
    prisma.reputationScan
      .findFirst({
        where: { orgId, propertyId },
        orderBy: { createdAt: "desc" },
        select: { completedAt: true },
      })
      .catch(() => null),
    prisma.chatbotConversation
      .count({
        where: { orgId, propertyId, createdAt: { gte: since28d } },
      })
      .catch(() => 0),
    // Bug #38 — summary metrics for the right-nav action rail. We
    // pull the mention total + recent negative count so the
    // Reputation card surfaces signal (e.g. "35 mentions · 4 needs
    // response") instead of an empty arrow tile.
    prisma.propertyMention
      .count({ where: { orgId, propertyId } })
      .catch(() => 0),
    prisma.propertyMention
      .count({
        where: { orgId, propertyId, reviewedByUserId: null },
      })
      .catch(() => 0),
    // Per-property insights — filtered top 3 from the detector library.
    // Renders in the InsightsHero at the top of this tab so operators
    // see actionable signals scoped to this property without leaving
    // the page.
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

  // Funnel conversions
  const tourRate =
    kpis.leads28d > 0 ? Math.round((kpis.tours28d / kpis.leads28d) * 100) : 0;
  const appRate =
    kpis.tours28d > 0
      ? Math.round((kpis.applications28d / kpis.tours28d) * 100)
      : 0;

  // Lead source slices
  const sourceTotal = leadSourceGroups.reduce(
    (s, g) => s + g._count._all,
    0,
  );
  const sourceSlices = leadSourceGroups
    .filter((g) => g._count._all > 0)
    .map((g) => ({
      label: SOURCE_LABEL[g.source] ?? g.source,
      value: g._count._all,
    }))
    .sort((a, b) => b.value - a.value);

  // Renewal buckets
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
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));
  const expiringTotal = buckets.reduce((s, b) => s + b.count, 0);

  // AI insight — deterministic but actually useful: surfaces the single
  // most actionable signal for this property. No LLM call; we rank a few
  // rule-based candidates by severity and pick the top one.
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
      : "—";

  const monthlyRentRoll = (rentRoll._sum.monthlyRentCents ?? 0) / 100;

  // Build a one-paragraph operator briefing — deterministic narrative that
  // surfaces the highest-signal facts about this property. Helps Norman see
  // the state of the building in one read instead of triangulating across
  // five different tiles.
  const briefing = buildPropertyBriefing({
    name: propertyMeta.name,
    occupancyPct,
    totalUnits,
    leasedUnits,
    availableUnits,
    monthlyRentRoll,
    expiringNext30: buckets[0].count,
    expiringNext120: expiringTotal,
    leads28d: kpis.leads28d,
    tours28d: kpis.tours28d,
    noticeGiven: noticeResidents,
    activeResidents: activeResidents,
  });

  // Bug #41 — Empty-property detection: no listings, no leads, zero
  // integrations. Collapses the dense KPI grid + active-features strip
  // into a single onboarding panel until real data lands. SG Real
  // Estate's launch had 120 IMPORTED rows straight from AppFolio that
  // hit this branch.
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
  // Legacy `isEmpty` retained for the "no activity but not freshly
  // imported" case (e.g. an operator-curated ACTIVE property that
  // hasn't seen any traffic yet) so we still get the 3-step setup
  // panel instead of a wall of broken charts.
  const isEmpty =
    !isOnboardingShell &&
    allTimeListings === 0 &&
    allTimeLeads === 0 &&
    !cursiveIntegration?.cursivePixelId &&
    !googleAdCampaign &&
    !metaAdCampaign &&
    (seoIntegrations?.length ?? 0) === 0;

  // Sparse-data thresholds. Below 5 leads in the 28d window the
  // Recharts funnel renders as a 4-bar grid that's mostly empty
  // pixels; under that threshold we swap to a compact step list with
  // counts + a "needs more volume" note. Same logic for the source
  // breakdown: 1 channel is a single-color donut (looks broken) and
  // becomes a horizontal "All N from Chatbot" callout.
  const FUNNEL_MIN = 5;
  const showCompactFunnel = kpis.leads28d < FUNNEL_MIN;

  return (
    <div className="space-y-3 ls-page-fade">
      {/* Hero strip — property identity at a glance with the headline metric
          (occupancy ring), the single-paragraph briefing, and a quick-actions
          rail. Replaces the previous "page just dropped you into KPIs"
          experience with a deliberate orientation moment.
          Bug #28 — now passes heroImageUrl + property type/subtype/year so
          the hero shows a thumbnail and the basics inline, instead of
          burying that info way down in a "Property details" card. */}
      <PropertyHeroStrip
        name={propertyMeta.name}
        occupancyPct={occupancyPct}
        totalUnits={totalUnits}
        leasedUnits={leasedUnits}
        availableUnits={availableUnits}
        monthlyRentRoll={monthlyRentRoll}
        briefing={briefing}
        propertyMeta={propertyMeta}
        heroImageUrl={property.heroImageUrl ?? null}
        propertyType={property.propertyType}
        propertySubtype={
          property.residentialSubtype ?? property.commercialSubtype ?? null
        }
        yearBuilt={property.yearBuilt}
        lastSyncedAt={property.lastSyncedAt}
        // Bug #38 — summary metrics for the quick-actions rail.
        // Each card now shows one number instead of just an arrow.
        renewalsNext30={buckets[0].count}
        renewalsNext120={expiringTotal}
        activeResidents={activeResidents}
        noticeResidents={noticeResidents}
        adSpendCents28d={kpis.adSpendCents28d}
        adLeads28d={kpis.leads28d}
        orgHasAdsModule={property.orgHasAdsModule}
        reputationMentions={reputationMentionTotal}
        reputationUnreviewed={reputationUnreviewedCount}
        reputationLastAt={latestReputationScan?.completedAt ?? null}
      />

      {isOnboardingShell ? (
        // Compact "Property in onboarding" card. Renders for AppFolio-
        // imported rows that haven't been touched yet (120 of SG's 127
        // properties at launch). The full dashboard re-appears the
        // moment any real activity lands (listing, lead, integration).
        <OnboardingShellCard
          propertyId={propertyId}
          propertyName={propertyMeta.name}
          totalUnits={property.totalUnits}
          appfolioConnected={appfolioConnected}
          lastSyncedAt={property.lastSyncedAt}
        />
      ) : isEmpty ? (
        // Bug #41 — Single onboarding panel for operator-curated
        // properties that haven't seen any data yet. Keeps the existing
        // 3-step setup layout because these rows already passed the
        // IMPORTED-row curation gate; they just need integrations.
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
        <>
      {/* Insights hero — top 3 ranked open insights filtered to THIS
          property. Replaces the legacy single-card deterministic
          AiInsightCard with real DB-backed insights from the detector
          library. Falls back to the rule-based AiInsightCard ONLY when
          there are zero stored insights (gives a useful signal during
          the first hour after the user connects data and detectors
          haven't run yet). */}
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

      {/* Bug #27 — "Active features" strip. Pivot the overview's
          headline focus from leasing/occupancy to marketing/website.
          Each chip shows a feature's current connection state so the
          operator scans "what's running" at a glance. Click-through
          deep links to the respective settings/onboarding surface. */}
      <ActiveFeaturesStrip
        propertyId={propertyId}
        chatbotEnabled={
          chatbotConfig?.tenantSiteConfig?.chatbotEnabled ?? false
        }
        chatbotConvos28d={chatbotConvos28d}
        pixelInstalled={Boolean(cursiveIntegration?.cursivePixelId)}
        pixelLastEventAt={cursiveIntegration?.lastEventAt ?? null}
        ga4Connected={seoIntegrations.some(
          (s) => s.provider === "GA4" && s.lastSyncAt != null,
        )}
        gscConnected={seoIntegrations.some(
          (s) => s.provider === "GSC" && s.lastSyncAt != null,
        )}
        googleAdsConnected={Boolean(googleAdCampaign)}
        metaAdsConnected={Boolean(metaAdCampaign)}
        adSpendCents28d={kpis.adSpendCents28d}
        showAdChips={property.orgHasAdsModule}
      />

      {/* Top KPI strip — hero metric (Leads) anchors the row at 1.6x
          weight, with the rest of the funnel (Tours, Apps, Organic,
          and optionally Spend) rendered as secondary tiles alongside.
          Hierarchy mirrors the operator's mental model: leads is the
          leading indicator, the others are downstream context.
          When the org has no ad modules turned on we drop the Spend
          tile entirely so the row doesn't read "$0" in big numerals;
          dropping to a 3-tile secondary block keeps the grid clean. */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_2fr] gap-2">
        <HeroLeadsTile
          leads={kpis.leads28d}
          delta={leadsDelta}
          spark={kpis.leadsSparkline}
          tours={kpis.tours28d}
          applications={kpis.applications28d}
          tourRate={tourRate}
          appRate={appRate}
        />
        <div
          className={cn(
            "grid gap-2",
            property.orgHasAdsModule
              ? "grid-cols-2"
              : "grid-cols-1 sm:grid-cols-3",
          )}
        >
          <KpiTile
            label="Tours (28d)"
            value={kpis.tours28d > 0 ? kpis.tours28d : <DimZero />}
            hint={
              kpis.leads28d > 0
                ? kpis.tours28d > 0
                  ? `${tourRate}% of leads`
                  : "Schedule from a lead to start"
                : "First lead lands here"
            }
          />
          <KpiTile
            label="Applications (28d)"
            value={kpis.applications28d > 0 ? kpis.applications28d : <DimZero />}
            hint={
              kpis.tours28d > 0
                ? kpis.applications28d > 0
                  ? `${appRate}% of tours`
                  : "Sent from a completed tour"
                : "First tour lands here"
            }
          />
          {property.orgHasAdsModule ? (
            <KpiTile
              label="Ad spend (28d)"
              value={
                kpis.adSpendCents28d > 0 ? (
                  centsToUsdShort(kpis.adSpendCents28d)
                ) : (
                  <DimZero />
                )
              }
              hint={
                kpis.adSpendCents28d > 0 && kpis.leads28d > 0
                  ? `$${Math.round(kpis.adSpendCents28d / 100 / kpis.leads28d).toLocaleString()}/lead`
                  : kpis.adSpendCents28d > 0
                    ? "Attributed to this property"
                    : "Connect ad accounts in Settings"
              }
            />
          ) : null}
          <KpiTile
            label="Organic (28d)"
            value={
              kpis.organicMapped &&
              kpis.organicSessions28d != null &&
              kpis.organicSessions28d > 0 ? (
                kpis.organicSessions28d.toLocaleString()
              ) : (
                <DimZero />
              )
            }
            hint={
              kpis.organicMapped
                ? kpis.organicSessions28d != null && kpis.organicSessions28d > 0
                  ? "Sessions on matching URLs"
                  : "No matching sessions yet"
                : "Map listing URLs in SEO settings"
            }
          />
        </div>
      </section>

      {/* Visualization row 1 — Occupancy donut + Lead funnel + Lead source */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <DashboardSection
          title="Occupancy"
          eyebrow="Live"
          description={
            totalUnits != null
              ? `${leasedUnits} of ${totalUnits} units leased`
              : "Connect AppFolio for live occupancy"
          }
        >
          <OccupancyDonut
            leased={leasedUnits ?? 0}
            available={availableUnits}
            total={totalUnits ?? availableUnits}
            occupancyPct={occupancyPct}
          />
          <ul className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
            <Legend
              color="#1D4ED8"
              label="Leased"
              value={leasedUnits ?? 0}
            />
            <Legend
              color="#93C5FD"
              label="Available"
              value={availableUnits}
            />
            <Legend
              color="#9CA3AF"
              label="Notice given"
              value={noticeResidents}
            />
            <Legend
              color="#2563EB"
              label="Active residents"
              value={activeResidents}
            />
          </ul>
        </DashboardSection>

        <DashboardSection
          title="Lead funnel"
          eyebrow="28-day"
          description={
            kpis.leads28d === 0
              ? "Visit → lead → tour → application progression."
              : showCompactFunnel
                ? "Visit → lead → tour → application. Needs more volume to read as a chart."
                : "Visit-to-lease progression. Drop-off rates show where the funnel leaks."
          }
        >
          {kpis.leads28d === 0 ? (
            <FunnelEmpty />
          ) : showCompactFunnel ? (
            <CompactFunnel
              leads={kpis.leads28d}
              tours={kpis.tours28d}
              applications={kpis.applications28d}
            />
          ) : (
            <FunnelBars
              stages={[
                { label: "Leads", value: kpis.leads28d, color: "#1D4ED8" },
                { label: "Tours", value: kpis.tours28d, color: "#2563EB" },
                {
                  label: "Applications",
                  value: kpis.applications28d,
                  color: "#3B82F6",
                },
              ]}
            />
          )}
        </DashboardSection>

        <DashboardSection
          title="Lead sources"
          eyebrow="28-day"
          description={
            sourceTotal === 0
              ? "Channel mix appears once leads start flowing."
              : sourceSlices.length === 1
                ? `${sourceTotal} lead${sourceTotal === 1 ? "" : "s"} from one channel`
                : `${sourceTotal} leads across ${sourceSlices.length} channels`
          }
        >
          {sourceTotal === 0 ? (
            <SourceMixEmpty />
          ) : sourceSlices.length === 1 ? (
            // Single-channel callout. The previous build rendered this
            // as a one-color donut that looked broken; this reads as a
            // deliberate "all leads attributed here" statement.
            <SingleSourceCallout
              label={sourceSlices[0].label}
              value={sourceSlices[0].value}
            />
          ) : (
            <SourceMix slices={sourceSlices} />
          )}
        </DashboardSection>
      </section>

      {/* Visualization row 2 — Renewal pipeline + Rent roll snapshot */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <DashboardSection
          title="Renewal pipeline"
          eyebrow="Next 120 days"
          description={
            expiringTotal === 0
              ? "No leases up for renewal in the window."
              : `${expiringTotal} ${expiringTotal === 1 ? "lease" : "leases"} up for renewal`
          }
          className="lg:col-span-2"
        >
          {expiringTotal === 0 ? (
            <RenewalEmpty />
          ) : (
            <RenewalBars buckets={buckets} max={maxBucket} />
          )}
        </DashboardSection>

        <DashboardSection
          title="Rent roll"
          eyebrow="Active leases"
          description="Monthly recurring revenue from this property"
        >
          <div className="space-y-2.5">
            <div>
              <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                Monthly rent roll
              </p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                <AnimatedNumber value={monthlyRentRoll} format="currency" />
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                Active leases
              </p>
              <p
                className="mt-0.5 text-base font-semibold tabular-nums text-foreground"
                title="Lease rows in ACTIVE status synced from AppFolio. May trail occupancy when residents are tracked but their lease records haven't synced yet — see the reconciliation note below."
              >
                <AnimatedNumber value={activeResidents} />
              </p>
            </div>
            {/* Compact reconciliation line. The full explainer is now in
                a hover/title tooltip so the rent-roll card stays scannable
                instead of carrying a paragraph of AppFolio sync trivia. */}
            {leasedUnits != null && Math.abs(leasedUnits - activeResidents) >= 1 ? (
              <p
                className="text-[10.5px] text-muted-foreground leading-snug"
                title={`${leasedUnits} units occupied (AppFolio unit roll-up), ${activeResidents} lease rows synced as ACTIVE. The gap is residents whose lease rows haven't propagated yet (new move-ins, pending renewals, month-to-month rolls AppFolio hasn't reissued). Avg rent stays stable because it divides by the unit denominator, not the lease-row count.`}
              >
                <span className="tabular-nums">{leasedUnits}</span> units occupied,{" "}
                <span className="tabular-nums">{activeResidents}</span> lease rows synced.{" "}
                <a
                  href="?tab=residents"
                  className="text-primary underline underline-offset-2 hover:no-underline"
                >
                  Open Residents →
                </a>
              </p>
            ) : null}
            <div>
              <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                Avg rent / unit
              </p>
              <p
                className="mt-0.5 text-base font-semibold tabular-nums text-foreground"
                title="Monthly rent roll divided by the number of leased physical units. Uses the unit-level occupancy denominator — not the active-lease row count — so the figure stays stable when AppFolio's lease-row sync lags."
              >
                <AnimatedNumber
                  value={
                    // Bug #33 — Norman: was dividing rent roll by
                    // activeResidents (21 lease rows) instead of
                    // leasedUnits (100 occupied units), yielding
                    // $4,408 instead of the real ~$925. Fix: divide
                    // by leasedUnits when known, fall back to
                    // activeResidents only when no unit count is
                    // available.
                    leasedUnits != null && leasedUnits > 0
                      ? Math.round(monthlyRentRoll / leasedUnits)
                      : activeResidents > 0
                        ? Math.round(monthlyRentRoll / activeResidents)
                        : 0
                  }
                  format="currency"
                />
              </p>
            </div>
          </div>
        </DashboardSection>
      </section>

      {/* Property details + Marketing.
          Bug #28 — show only the rows we have real data for. Empty
          fields used to render as "Year built: —" which looked like
          a tracking gap; now they're hidden so the section reads
          cleanly. The hero strip above handles the basics inline. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <DashboardSection title="Property details" eyebrow="Basics">
          <dl className="space-y-1 text-xs">
            {property.propertyType ? (
              <Row k="Type" v={property.propertyType} />
            ) : null}
            {property.residentialSubtype || property.commercialSubtype ? (
              <Row
                k="Subtype"
                v={
                  property.residentialSubtype ?? property.commercialSubtype ?? ""
                }
              />
            ) : null}
            {property.totalUnits != null ? (
              <Row k="Total units" v={property.totalUnits.toString()} />
            ) : null}
            {property.yearBuilt != null ? (
              <Row k="Year built" v={property.yearBuilt.toString()} />
            ) : null}
            {property.backendPlatform &&
            property.backendPlatform !== "NONE" ? (
              <Row k="Backend" v={property.backendPlatform} />
            ) : null}
            {property.backendPropertyGroup ? (
              <Row k="Property group" v={property.backendPropertyGroup} />
            ) : null}
            {property.lastSyncedAt ? (
              <Row
                k="Last synced"
                v={new Date(property.lastSyncedAt).toLocaleString()}
              />
            ) : null}
          </dl>
        </DashboardSection>

        <DashboardSection title="Marketing" eyebrow="SEO & listings">
          <dl className="space-y-1 text-xs">
            {/* Bug #28 — hide unpopulated SEO/listing rows instead of
                rendering "—" placeholders. Listings + all-time leads
                always show because zero is a meaningful value there. */}
            {property.metaTitle ? (
              <Row k="Meta title" v={property.metaTitle} />
            ) : null}
            {property.metaDescription ? (
              <Row k="Meta description" v={property.metaDescription} />
            ) : null}
            {property.virtualTourUrl ? (
              <Row k="Virtual tour" v={property.virtualTourUrl} />
            ) : null}
            {priceRange !== "—" ? <Row k="Price range" v={priceRange} /> : null}
            <Row
              k="Listings configured"
              v={(listingCounts?._count.listings ?? 0).toString()}
            />
            <Row
              k="All-time leads"
              v={(listingCounts?._count.leads ?? 0).toString()}
            />
          </dl>
          {property.description ? (
            <div className="pt-2 mt-2 border-t border-border">
              <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground mb-1">
                Description
              </div>
              <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-snug">
                {property.description}
              </p>
            </div>
          ) : null}
        </DashboardSection>
      </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PropertyHeroStrip — opens the Overview tab. Three-column layout:
//
//   ┌─────────────────────────────────────────────────────────────────────┐
//   │ [97%]   Telegraph Commons        ▸ Open Renewals  ▸ Open Ads        │
//   │  full   2-paragraph briefing      ▸ Open Residents  ▸ Open Reports  │
//   │  ring   ($4.4M monthly · 71 u)                                      │
//   └─────────────────────────────────────────────────────────────────────┘
//
// The ring on the left is the single biggest visual on the page so the
// operator's eye lands on the headline metric (occupancy) first. The
// briefing is plain English so it's skim-friendly. The action rail on the
// right takes them to the most likely next step.
// ---------------------------------------------------------------------------

// Bug #27 — Active features strip. Each chip shows a marketing-side
// feature's connection state, with a deep link to the relevant
// settings or onboarding surface. Renders as a compact, scannable
// row near the top of the overview so operators see "what's
// running" without scrolling. Connected chips lead with a green
// dot; not-connected chips are muted with a "Set up" link.
function ActiveFeaturesStrip({
  propertyId,
  chatbotEnabled,
  chatbotConvos28d,
  pixelInstalled,
  pixelLastEventAt,
  ga4Connected,
  gscConnected,
  googleAdsConnected,
  metaAdsConnected,
  adSpendCents28d,
  showAdChips,
}: {
  propertyId: string;
  chatbotEnabled: boolean;
  chatbotConvos28d: number;
  pixelInstalled: boolean;
  pixelLastEventAt: Date | null;
  ga4Connected: boolean;
  gscConnected: boolean;
  googleAdsConnected: boolean;
  metaAdsConnected: boolean;
  adSpendCents28d: number;
  /** When false, Google/Meta Ads chips are dropped — the org has no
   *  ad modules turned on and the chips would just be permanent "Not
   *  connected" pills with no useful action behind them. */
  showAdChips: boolean;
}) {
  const PIXEL_FRESH_DAYS = 14;
  const pixelFiring =
    pixelInstalled &&
    pixelLastEventAt != null &&
    Date.now() - pixelLastEventAt.getTime() <
      PIXEL_FRESH_DAYS * 24 * 60 * 60 * 1000;

  type Chip = {
    label: string;
    connected: boolean;
    detail: string;
    href: string;
  };
  const chips: Chip[] = [
    {
      label: "Chatbot",
      connected: chatbotEnabled,
      detail: chatbotEnabled
        ? `${chatbotConvos28d} conversation${chatbotConvos28d === 1 ? "" : "s"} (28d)`
        : "Not enabled",
      href: "/portal/chatbot",
    },
    {
      label: "Cursive Pixel",
      connected: pixelFiring,
      // When stale, surface the actual age of the last event ("Last event
      // 16d ago") so the operator knows whether to chase a broken pixel
      // install or just no traffic. Previously the generic "no recent
      // events" left them guessing — and the Sync action on /visitors
      // wasn't updating this surface even when it pulled fresh visitors
      // from AudienceLab (now fixed in runCursiveSegmentSync).
      detail: pixelFiring
        ? "Firing"
        : pixelInstalled
          ? pixelLastEventAt
            ? `Installed · last event ${formatPixelAge(pixelLastEventAt)}`
            : "Installed · no events yet"
          : "Not installed",
      href: `/portal/properties/${propertyId}?tab=onboarding`,
    },
    {
      label: "GA4",
      connected: ga4Connected,
      detail: ga4Connected ? "Connected" : "Not connected",
      href: `/portal/seo?provider=GA4&propertyId=${propertyId}`,
    },
    {
      label: "GSC",
      connected: gscConnected,
      detail: gscConnected ? "Connected" : "Not connected",
      href: `/portal/seo?provider=GSC&propertyId=${propertyId}`,
    },
    // Bug #35 — both ads chips routed to /portal/integrations/ads
    // which returns 404. The actual ads detail surface lives at
    // ?tab=ads on the property page, so we redirect there. The
    // platform query param is preserved so the ads tab can scroll
    // to the relevant campaign block.
    // Bug #36 — "Active campaign" label was showing even when the
    // attributed 28d ad spend was $0. We pass through the spend
    // figure and downgrade the detail to "No recent spend" when
    // the campaign is connected but spend is zero.
    // Only render the ad chips when the org actually has an ad
    // module on; otherwise these were two permanent "Not connected"
    // pills with no useful click target.
    ...(showAdChips
      ? [
          {
            label: "Google Ads",
            connected: googleAdsConnected,
            detail: googleAdsConnected
              ? adSpendCents28d > 0
                ? "Active campaign"
                : "Connected · $0 recent spend"
              : "Not connected",
            href: `/portal/properties/${propertyId}?tab=ads&platform=GOOGLE`,
          },
          {
            label: "Meta Ads",
            connected: metaAdsConnected,
            detail: metaAdsConnected
              ? adSpendCents28d > 0
                ? "Active campaign"
                : "Connected · $0 recent spend"
              : "Not connected",
            href: `/portal/properties/${propertyId}?tab=ads&platform=META`,
          },
        ]
      : []),
    // Bug #37 — Reputation was sitting in the Active Features strip
    // even though it's a passive monitoring surface, not an active
    // marketing channel. We've removed it here and trigger a
    // background scan when the operator visits the reputation tab
    // instead, so the data feels live without forcing them through
    // a separate setup state.
  ];

  const liveCount = chips.filter((c) => c.connected).length;

  return (
    <section className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] tracking-widest uppercase font-semibold text-muted-foreground shrink-0">
          Channels &middot;{" "}
          <span className="text-foreground tabular-nums">
            {liveCount}/{chips.length} live
          </span>
        </p>
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {chips.map((chip) => (
            <a
              key={chip.label}
              href={chip.href}
              title={chip.detail}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors ${
                chip.connected
                  ? "border-primary/25 bg-primary/[0.06] hover:bg-primary/10"
                  : "border-border bg-muted/30 hover:bg-muted/50"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  chip.connected ? "bg-primary" : "bg-muted-foreground/40"
                }`}
              />
              <span className="text-[11px] font-semibold text-foreground">
                {chip.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// HeroLeadsTile — anchors the property KPI strip. Big numeric display
// (32-40px), prominent delta, taller sparkline, and a funnel-rate
// micro-summary so the operator sees "where did the leads go" without
// scanning the secondary tiles. Renders inside the same grid as the
// 2x2 secondary KpiTile grid; matches that visual language but reads
// as the dominant signal.
function HeroLeadsTile({
  leads,
  delta,
  spark,
  tours,
  applications,
  tourRate,
  appRate,
}: {
  leads: number;
  delta?: { value: string; trend: "up" | "down" | "flat" };
  spark: number[] | null | undefined;
  tours: number;
  applications: number;
  tourRate: number;
  appRate: number;
}) {
  const showSpark = Array.isArray(spark) && spark.length > 1;
  return (
    <div className="relative h-full rounded-xl border border-border bg-card p-4 flex flex-col gap-3 ls-hover-lift">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Leads · 28 days
        </span>
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums",
              delta.trend === "up"
                ? "text-primary bg-primary/10"
                : delta.trend === "down"
                  ? "text-destructive bg-destructive/10"
                  : "text-muted-foreground bg-muted",
            )}
          >
            {delta.value}
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3 min-w-0">
        {leads === 0 ? (
          // Zero-state: drop the giant "0" — it reads as broken, not
          // as a deliberate "no leads yet." Replace with a smaller
          // dimmed dash and an explicit helper line.
          <div className="flex flex-col gap-1">
            <span className="text-[28px] leading-none font-semibold tabular-nums text-muted-foreground/40">
              —
            </span>
            <span className="text-[11px] text-muted-foreground leading-tight">
              First lead lands here
            </span>
          </div>
        ) : (
          <div className="text-[40px] leading-none font-semibold tracking-tight tabular-nums text-foreground">
            {leads.toLocaleString()}
          </div>
        )}
        {/* Funnel breakdown — micro horizontal bar showing tour & app
            conversion as a fraction of leads. We only render this when
            there's leads volume; otherwise it's just a trio of "0 ·"
            lines that adds noise. */}
        {leads > 0 ? (
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Funnel
            </p>
            <p className="text-[12px] text-foreground mt-0.5 tabular-nums">
              {tours} tours
              {tourRate > 0 ? (
                <span className="text-muted-foreground"> · {tourRate}%</span>
              ) : null}
            </p>
            <p className="text-[12px] text-foreground tabular-nums">
              {applications} apps
              {appRate > 0 ? (
                <span className="text-muted-foreground"> · {appRate}%</span>
              ) : null}
            </p>
          </div>
        ) : null}
      </div>

      {/* Sparkline only renders once we have a real curve to draw.
          Previously an empty "Sparkline appears once 7+ days of data
          exists" panel held the slot — that looked like a broken
          chart shell. Now the tile just gets shorter when sparse. */}
      {showSpark ? (
        <div className="-mx-1 -mb-1 mt-auto">
          <HeroSparkline data={spark as number[]} />
        </div>
      ) : null}
    </div>
  );
}

// Taller sparkline variant for the hero tile — 56px high vs the
// secondary KpiTile's 28px. Same brand-blue palette so the row reads
// as a unified system, not a one-off chart.
function HeroSparkline({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 56;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `M0,${h} L${points.split(" ").join(" L")} L${w},${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-12 overflow-visible"
      aria-hidden="true"
    >
      <path d={areaPath} fill="#2563EB" opacity="0.1" />
      <polyline
        points={points}
        fill="none"
        stroke="#2563EB"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function PropertyHeroStrip({
  name,
  occupancyPct,
  totalUnits,
  leasedUnits,
  availableUnits,
  monthlyRentRoll,
  briefing,
  propertyMeta,
  heroImageUrl,
  propertyType,
  propertySubtype,
  yearBuilt,
  lastSyncedAt,
  renewalsNext30,
  renewalsNext120,
  activeResidents,
  noticeResidents,
  adSpendCents28d,
  adLeads28d,
  orgHasAdsModule,
  reputationMentions,
  reputationUnreviewed,
  reputationLastAt,
}: {
  name: string;
  occupancyPct: number | null;
  totalUnits: number | null;
  leasedUnits: number | null;
  availableUnits: number;
  monthlyRentRoll: number;
  briefing: string;
  propertyMeta: { slug: string; name: string };
  heroImageUrl: string | null;
  propertyType: PropertyType;
  propertySubtype: ResidentialSubtype | CommercialSubtype | null;
  yearBuilt: number | null;
  lastSyncedAt: Date | null;
  // Bug #38 — summary metrics for the quick-actions rail.
  renewalsNext30: number;
  renewalsNext120: number;
  activeResidents: number;
  noticeResidents: number;
  adSpendCents28d: number;
  adLeads28d: number;
  /** When false, the "Ad performance" card is dropped from the rail —
   *  the Ads sub-tab is hidden upstream so a link there is dead. */
  orgHasAdsModule: boolean;
  reputationMentions: number;
  reputationUnreviewed: number;
  reputationLastAt: Date | null;
}) {
  const monthlyDisplay =
    monthlyRentRoll > 0
      ? `$${(monthlyRentRoll / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K /mo`
      : "—";
  const occupancyLabel = occupancyPct != null ? `${occupancyPct}%` : "—";
  const occupancyTone =
    occupancyPct == null
      ? "stroke-muted-foreground/40"
      : occupancyPct >= 90
        ? "stroke-primary-dark"
        : occupancyPct >= 75
          ? "stroke-primary"
          : "stroke-primary/50";

  // Bug #28 — inline property-detail summary. Builds a clean line of
  // "Type · Subtype · Year · Last synced" from whatever fields are
  // populated, dropping silently when a field is null. No more "Year
  // built: —" or "Subtype: —" leaking into the UI.
  const subtypeLabel =
    typeof propertySubtype === "string"
      ? propertySubtype.replace(/_/g, " ").toLowerCase()
      : null;
  const detailBits: string[] = [];
  if (subtypeLabel) {
    detailBits.push(subtypeLabel);
  } else if (propertyType) {
    detailBits.push(propertyType.replace(/_/g, " ").toLowerCase());
  }
  if (totalUnits != null) detailBits.push(`${totalUnits} units`);
  if (yearBuilt) detailBits.push(`built ${yearBuilt}`);
  if (lastSyncedAt) {
    const synced = new Date(lastSyncedAt);
    const days = Math.floor(
      (Date.now() - synced.getTime()) / (24 * 60 * 60 * 1000),
    );
    detailBits.push(
      days === 0
        ? "synced today"
        : days === 1
          ? "synced yesterday"
          : days < 7
            ? `synced ${days}d ago`
            : `synced ${synced.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[auto_auto_1fr_auto] gap-5 p-4 md:p-5">
        {/* Hero photo — small thumbnail for quick property
            recognition. Falls back to nothing (the occupancy ring
            anchors the row) when no heroImageUrl is set. Bug #28. */}
        {heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImageUrl}
            alt={name}
            className="h-20 w-20 md:h-24 md:w-24 rounded-lg object-cover border border-border self-center shrink-0"
          />
        ) : null}

        {/* Occupancy ring — large, anchored */}
        <div className="flex items-center gap-4 md:gap-5">
          <HeroOccupancyRing
            pct={occupancyPct}
            strokeClass={occupancyTone}
            label={occupancyLabel}
            sublabel={
              totalUnits != null && leasedUnits != null
                ? `${leasedUnits}/${totalUnits} leased`
                : "No unit count"
            }
          />
        </div>

        {/* Identity + briefing */}
        <div className="min-w-0 self-center">
          <div className="flex items-baseline flex-wrap gap-2 mb-1.5">
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {name}
            </h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {monthlyDisplay}
            </span>
            {availableUnits > 0 ? (
              <span className="text-[11px] text-foreground font-medium tabular-nums">
                · {availableUnits} open
              </span>
            ) : null}
          </div>
          {/* Bug #28 — inline detail bits instead of a buried details
              card. Capitalize-first-letter applied via class for a
              clean read. */}
          {detailBits.length > 0 ? (
            <p className="text-[11px] text-muted-foreground/80 mb-1.5 first-letter:capitalize tabular-nums">
              {detailBits.join(" · ")}
            </p>
          ) : null}
          <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[560px]">
            {briefing}
          </p>
        </div>

        {/* Quick actions rail. Bug #38 — Norman noted these were
            empty arrow tiles with no signal. Each card now leads with
            a metric so the operator gets at-a-glance data density
            consistent with every other module on the page. */}
        <nav
          aria-label="Quick actions"
          className="flex flex-row md:flex-col gap-1 md:min-w-[170px] self-center"
        >
          {(() => {
            const renewalMetric =
              renewalsNext30 > 0
                ? `${renewalsNext30} in 30d`
                : renewalsNext120 > 0
                  ? `${renewalsNext120} in 120d`
                  : "Quiet";
            const residentMetric =
              noticeResidents > 0
                ? `${activeResidents} · ${noticeResidents} notice`
                : `${activeResidents} active`;
            const spendDollars = Math.round(adSpendCents28d / 100);
            const adMetric =
              spendDollars > 0
                ? adLeads28d > 0
                  ? `$${spendDollars.toLocaleString()} · ${adLeads28d} leads`
                  : `$${spendDollars.toLocaleString()} (28d)`
                : "No spend (28d)";
            const reputationMetric =
              reputationMentions > 0
                ? reputationUnreviewed > 0
                  ? `${reputationMentions} · ${reputationUnreviewed} to review`
                  : `${reputationMentions} mentions`
                : reputationLastAt
                  ? "No mentions found"
                  : "Not scanned yet";
            const cards: Array<{
              tab: string;
              label: string;
              metric: string;
            }> = [
              { tab: "renewals", label: "Renewals", metric: renewalMetric },
              {
                tab: "residents",
                label: "Residents",
                metric: residentMetric,
              },
              // Ads card only renders when the org actually has an ad
              // module turned on. Otherwise the Ads sub-tab is hidden
              // upstream and this card would route to a dead link.
              ...(orgHasAdsModule
                ? [
                    {
                      tab: "ads",
                      label: "Ad performance",
                      metric: adMetric,
                    },
                  ]
                : []),
              {
                tab: "reputation",
                label: "Reputation",
                metric: reputationMetric,
              },
            ];
            return cards.map((a) => (
              <a
                key={a.tab}
                href={`?tab=${a.tab}`}
                className="inline-flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 hover:border-primary/40 transition-colors group"
              >
                <span className="flex flex-col min-w-0">
                  <span className="leading-tight">{a.label}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums truncate">
                    {a.metric}
                  </span>
                </span>
                <span className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  →
                </span>
              </a>
            ));
          })()}
        </nav>
      </div>
    </section>
  );
}

// Big SVG occupancy ring used in the hero strip. 96px outer, 14px stroke.
function HeroOccupancyRing({
  pct,
  strokeClass,
  label,
  sublabel,
}: {
  pct: number | null;
  strokeClass: string;
  label: string;
  sublabel: string;
}) {
  const size = 96;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const fraction = pct != null ? Math.max(0, Math.min(1, pct / 100)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={strokeClass}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${fraction * circ} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {/* Bug #32 — Norman flagged that the sublabel "100/100 leased"
          was clipping the ring's outer stroke. We tighten the layout:
          padded inner, narrower text, drop the "leased" suffix from
          the inline ratio (it's already implied by the ring), and
          fall back to a smaller font when the ratio width grows past
          a single line. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <span className="text-[18px] font-semibold tracking-tight text-foreground tabular-nums leading-none">
          {label}
        </span>
        <span
          className="mt-1 uppercase tracking-wider font-semibold text-muted-foreground leading-tight"
          style={{
            // Shrink the secondary line dynamically: 10-char ratios
            // (e.g. "100/100") fit at 8px; longer strings drop a bit
            // further. The ring is 96px wide so we have ~64px of safe
            // text width inside the stroke.
            fontSize: sublabel.length > 10 ? 7 : 8,
            letterSpacing: "0.05em",
          }}
        >
          {sublabel.replace(/\s+leased$/i, "")}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// buildPropertyBriefing — produces a 1–2 sentence operator-grade summary
// of the property's current state. Picks the most relevant facts based on
// what data exists; degrades gracefully when AppFolio + ad accounts +
// reputation aren't all wired up yet.
// ---------------------------------------------------------------------------

function buildPropertyBriefing(args: {
  name: string;
  occupancyPct: number | null;
  totalUnits: number | null;
  leasedUnits: number | null;
  availableUnits: number;
  monthlyRentRoll: number;
  expiringNext30: number;
  expiringNext120: number;
  leads28d: number;
  tours28d: number;
  noticeGiven: number;
  activeResidents: number;
}): string {
  const parts: string[] = [];

  if (args.occupancyPct != null) {
    if (args.occupancyPct >= 95) {
      parts.push(
        `Sitting at ${args.occupancyPct}% occupancy. Effectively full.`,
      );
    } else if (args.occupancyPct >= 85) {
      parts.push(
        `Occupancy is healthy at ${args.occupancyPct}% with ${args.availableUnits} unit${args.availableUnits === 1 ? "" : "s"} available.`,
      );
    } else {
      parts.push(
        `Occupancy is ${args.occupancyPct}%. ${args.availableUnits} unit${args.availableUnits === 1 ? "" : "s"} sitting, worth attention.`,
      );
    }
  } else if (args.totalUnits != null) {
    parts.push(`${args.totalUnits} units total.`);
  }

  if (args.expiringNext120 > 0) {
    parts.push(
      `${args.expiringNext120} lease${args.expiringNext120 === 1 ? "" : "s"} up for renewal in the next 120 days${args.expiringNext30 > 0 ? `, including ${args.expiringNext30} inside 30 days` : ""}.`,
    );
  }

  if (args.noticeGiven > 0) {
    parts.push(
      `${args.noticeGiven} resident${args.noticeGiven === 1 ? " has" : "s have"} given notice. Renewal campaigns should already be live.`,
    );
  }

  if (args.leads28d > 0) {
    const conv =
      args.leads28d > 0
        ? Math.round((args.tours28d / args.leads28d) * 100)
        : 0;
    parts.push(
      `${args.leads28d} lead${args.leads28d === 1 ? "" : "s"} in the last 28 days converting at ${conv}% lead-to-tour.`,
    );
  } else {
    parts.push(`No leads tracked in the last 28 days yet.`);
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// AI insight — deterministic, rule-based. Picks the single most actionable
// signal for this property and surfaces it as a one-line takeaway with a
// recommended next step. No LLM call required; just data ranking.
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
  if (
    args.tours28d >= 5 &&
    args.applications28d === 0
  ) {
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
  // Severity priority: alert > warn > info > ok
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
  // Brand-aligned tone scale. Severity is signalled by emphasis (border
  // weight, accent fill) inside a single brand-blue palette — no green,
  // amber, red. The destructive token is reserved for actual destructive
  // confirmations (delete modals), not informational alerts.
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
// Visualizations — pure SVG so they stream from the server.
// ---------------------------------------------------------------------------

function OccupancyDonut({
  leased,
  available,
  total,
  occupancyPct,
}: {
  leased: number;
  available: number;
  total: number;
  occupancyPct: number | null;
}) {
  const size = 132;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circ = 2 * Math.PI * radius;
  const denom = Math.max(1, total);
  const leasedFrac = leased / denom;
  const availFrac = available / denom;
  return (
    <div className="flex justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={stroke}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#1D4ED8"
            strokeWidth={stroke}
            strokeDasharray={`${leasedFrac * circ} ${circ}`}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#93C5FD"
            strokeWidth={stroke}
            strokeDasharray={`${availFrac * circ} ${circ}`}
            strokeDashoffset={`${-leasedFrac * circ}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-2xl font-semibold leading-none tabular-nums">
            {occupancyPct != null ? `${occupancyPct}%` : "—"}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            Occupied
          </p>
        </div>
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <li className="flex items-center justify-between gap-2 min-w-0">
      <span className="flex items-center gap-1.5 min-w-0">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="truncate text-foreground">{label}</span>
      </span>
      <span className="tabular-nums text-muted-foreground shrink-0">
        {value.toLocaleString()}
      </span>
    </li>
  );
}

function FunnelBars({
  stages,
}: {
  stages: Array<{ label: string; value: number; color: string }>;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <ul className="space-y-2">
      {stages.map((s, i) => {
        const widthPct = Math.max(6, Math.round((s.value / max) * 100));
        const dropPct =
          i === 0 || stages[i - 1].value === 0
            ? null
            : Math.round((s.value / stages[i - 1].value) * 100);
        return (
          <li key={s.label} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="font-medium text-foreground">{s.label}</span>
              <span className="tabular-nums">
                <span className="text-foreground font-semibold">
                  {s.value.toLocaleString()}
                </span>
                {dropPct != null ? (
                  <span className="ml-1.5 text-muted-foreground">
                    {dropPct}% from prev
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: s.color,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SourceMix({
  slices,
}: {
  slices: Array<{ label: string; value: number }>;
}) {
  // Senior-design rewrite: replaced the second donut on this row (which
  // rendered 100% with a single-channel segment when traffic was
  // concentrated, providing no information) with a clean horizontal bar
  // list. The page now has exactly one donut (occupancy) and a single
  // bar visual language for the funnel + source breakdown.
  const total = slices.reduce((s, x) => s + x.value, 0);
  const max = slices.reduce((m, s) => Math.max(m, s.value), 0) || 1;
  const rows = slices.slice(0, 6).map((s, i) => ({
    ...s,
    color: CHART_COLORS[i % CHART_COLORS.length],
    pct: Math.round((s.value / total) * 100),
    barPct: Math.max(2, (s.value / max) * 100),
  }));

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-[12px] min-w-0">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate font-medium text-foreground">
                {row.label}
              </span>
            </span>
            <span className="tabular-nums text-muted-foreground shrink-0 text-[11.5px]">
              <span className="font-semibold text-foreground">{row.value}</span>
              <span className="ml-1">&middot; {row.pct}%</span>
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: "rgba(37,99,235,0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${row.barPct}%`,
                backgroundColor: row.color,
                transition: "width 600ms cubic-bezier(.2,.7,.2,1)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RenewalBars({
  buckets,
  max,
}: {
  buckets: Array<{ label: string; count: number; rentCents: number }>;
  max: number;
}) {
  // Renewal urgency expressed via blue saturation rather than red→amber
  // →blue. Closest expirations get the deepest blue (= "look here first"),
  // distant buckets fade to neutral gray.
  const TONES = ["#1D4ED8", "#2563EB", "#60A5FA", "#9CA3AF"];
  return (
    <div className="grid grid-cols-4 gap-2">
      {buckets.map((b, i) => {
        const heightPct = b.count > 0 ? Math.max(8, (b.count / max) * 100) : 4;
        return (
          <div key={b.label} className="flex flex-col items-stretch gap-1.5">
            <div className="h-24 flex items-end">
              <div
                className="w-full rounded-md transition-all"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: TONES[i],
                  opacity: b.count > 0 ? 1 : 0.2,
                }}
              />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold tabular-nums leading-none text-foreground">
                {b.count}
              </p>
              <p className="text-[10px] tracking-wider uppercase text-muted-foreground mt-1">
                {b.label}
              </p>
              {b.rentCents > 0 ? (
                <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                  ${Math.round(b.rentCents / 100).toLocaleString()}/mo
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] text-muted-foreground">{k}</dt>
      <dd className="text-right truncate text-[11px] text-foreground">
        {v}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparse-data primitives. Pulled into their own helpers so every
// section uses the same visual language for "we don't have data here
// yet" — no half-broken Recharts, no giant "0" tiles.
// ---------------------------------------------------------------------------

// Single character placeholder used inside KpiTile when a zero value
// would otherwise read as broken. Wrapping the dash in this dim style
// keeps the tile's height locked while signalling "no data" softly.
function DimZero() {
  return (
    <span className="text-muted-foreground/40 tabular-nums">—</span>
  );
}

// Compact step-list funnel for when the 28d window has < 5 leads.
// Three rows of label + count + conversion %, separated by a faint
// vertical rule so the eye reads it as a sequence. Replaces the
// Recharts FunnelBars which renders as a stack of nearly-empty
// bars when the data is this sparse.
function CompactFunnel({
  leads,
  tours,
  applications,
}: {
  leads: number;
  tours: number;
  applications: number;
}) {
  const rows: Array<{ label: string; value: number; pct: number | null }> = [
    { label: "Leads", value: leads, pct: null },
    {
      label: "Tours",
      value: tours,
      pct: leads > 0 ? Math.round((tours / leads) * 100) : null,
    },
    {
      label: "Applications",
      value: applications,
      pct: tours > 0 ? Math.round((applications / tours) * 100) : null,
    },
  ];
  return (
    <div className="space-y-2">
      <ol className="rounded-lg border border-border bg-card/40 divide-y divide-border">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3 px-3 py-2"
          >
            <span className="text-[12px] text-foreground">{row.label}</span>
            <span className="flex items-baseline gap-2 tabular-nums">
              <span className="text-[14px] font-semibold text-foreground">
                {row.value.toLocaleString()}
              </span>
              {row.pct != null ? (
                <span className="text-[10.5px] text-muted-foreground">
                  {row.pct}%
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[10.5px] text-muted-foreground leading-snug">
        Needs more volume to read as a chart. The full funnel view returns
        once {leads >= 1 ? `${5 - leads} more` : "5"} leads land.
      </p>
    </div>
  );
}

function FunnelEmpty() {
  return (
    <p className="text-[12px] text-muted-foreground leading-snug">
      The funnel fills out once leads start landing for this property.
      Drop-off rates and bar widths appear automatically.
    </p>
  );
}

function SourceMixEmpty() {
  return (
    <p className="text-[12px] text-muted-foreground leading-snug">
      Channel mix appears here as leads come in. Every lead carries its
      source (Chatbot, Ads, Organic, etc.) so the breakdown is automatic.
    </p>
  );
}

// Single-channel callout. Used in place of a one-color donut when
// every lead in the window came from the same source — the donut
// reads as broken, the callout reads as intentional. Renders as a
// short statement with a single horizontal bar at 100%.
function SingleSourceCallout({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-3 space-y-2">
      <p className="text-[12.5px] text-foreground leading-snug">
        All <span className="font-semibold tabular-nums">{value}</span>{" "}
        {value === 1 ? "lead" : "leads"} from{" "}
        <span className="font-semibold">{label}</span>.
      </p>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "rgba(37,99,235,0.08)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: "100%", backgroundColor: "#2563EB" }}
        />
      </div>
      <p className="text-[10.5px] text-muted-foreground leading-snug">
        Mix expands the moment a second channel reports a lead.
      </p>
    </div>
  );
}

function RenewalEmpty() {
  return (
    <p className="text-[12px] text-muted-foreground leading-snug">
      No leases expiring in the next 120 days. Renewal cohorts appear
      here as lease end dates enter the window.
    </p>
  );
}

// Compact "Property in onboarding" card. Renders in place of the dense
// dashboard layout for AppFolio-imported rows that haven't been
// activated yet. Single card, clear next-step CTA. SG Real Estate's
// launch surfaced 120 of these from a fresh AppFolio sync; without
// this treatment each one would render an empty dashboard.
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
    ? `Last synced ${formatPixelAge(lastSyncedAt)}`
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

// Compact relative-age formatter for the Cursive Pixel "last event" chip.
// Reads as "2h ago", "3d ago", "16d ago" — operator-scannable without
// the verbose "about 16 days ago" formatDistanceToNow output.
function formatPixelAge(date: Date): string {
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
