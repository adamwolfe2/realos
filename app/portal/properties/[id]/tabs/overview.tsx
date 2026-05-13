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
  type PropertyType,
  type ResidentialSubtype,
  type LeadSource,
  type ResidentStatus,
} from "@prisma/client";
import { Sparkles, Cable, MessageSquare, Code, ListPlus } from "lucide-react";
import { DataPlaceholder } from "@/components/portal/ui/data-placeholder";
import { AnimatedNumber } from "@/components/portal/ui/animated-number";
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
  // into a single "3 steps" panel until real data lands.
  const appfolioConnected =
    property.backendPlatform != null && property.backendPlatform !== "NONE";
  const isEmpty =
    (listingCounts?._count.listings ?? 0) === 0 &&
    (listingCounts?._count.leads ?? 0) === 0 &&
    !cursiveIntegration?.cursivePixelId &&
    !googleAdCampaign &&
    !metaAdCampaign &&
    (seoIntegrations?.length ?? 0) === 0;

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
        reputationMentions={reputationMentionTotal}
        reputationUnreviewed={reputationUnreviewedCount}
        reputationLastAt={latestReputationScan?.completedAt ?? null}
      />

      {isEmpty ? (
        // Bug #41 — Single onboarding panel for brand-new properties.
        // All supporting surfaces re-appear the moment any data lands.
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
      />

      {/* Top KPI strip — funnel-shaped (Leads → Tours → Apps → Spend → Organic) */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <KpiTile
          label="Leads (28d)"
          value={kpis.leads28d}
          delta={leadsDelta}
          spark={kpis.leadsSparkline}
        />
        <KpiTile
          label="Tours (28d)"
          value={kpis.tours28d}
          hint={kpis.leads28d > 0 ? `${tourRate}% of leads` : "No leads yet"}
        />
        <KpiTile
          label="Applications (28d)"
          value={kpis.applications28d}
          hint={kpis.tours28d > 0 ? `${appRate}% of tours` : "—"}
        />
        <KpiTile
          label="Ad spend (28d)"
          value={centsToUsdShort(kpis.adSpendCents28d)}
          hint="Attributed to this property"
        />
        <KpiTile
          label="Organic (28d)"
          value={
            kpis.organicMapped
              ? kpis.organicSessions28d == null
                ? "—"
                : kpis.organicSessions28d.toLocaleString()
              : "—"
          }
          hint={
            kpis.organicMapped
              ? "Sessions on matching URLs"
              : "No URL mapping"
          }
        />
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
          description="Visit-to-lease progression. Drop-off rates show where the funnel leaks."
        >
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
        </DashboardSection>

        <DashboardSection
          title="Lead sources"
          eyebrow="28-day"
          description={
            sourceTotal === 0
              ? "No leads in this window."
              : `${sourceTotal} leads across ${sourceSlices.length} channels`
          }
        >
          {sourceTotal === 0 ? (
            <div className="h-32 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
              Once leads flow in, you&apos;ll see the channel mix here.
            </div>
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
              ? "No leases expiring in the window."
              : `${expiringTotal} ${expiringTotal === 1 ? "lease" : "leases"} up for renewal`
          }
          className="lg:col-span-2"
        >
          <RenewalBars buckets={buckets} max={maxBucket} />
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
            {/* Bug #34 — always-visible reconciliation when occupancy
                (unit-level) and active-lease count (lease-row level)
                disagree. Brand-aligned treatment: subtle muted card,
                no amber/red signalling — this is informational, not a
                warning. */}
            {leasedUnits != null && Math.abs(leasedUnits - activeResidents) >= 1 ? (
              <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Why these numbers differ
                </p>
                <p className="text-[11px] text-foreground/80 leading-snug mt-1">
                  <span className="font-semibold tabular-nums text-foreground">
                    {leasedUnits} units
                  </span>{" "}
                  show as occupied (the physical-unit roll-up from
                  AppFolio), but only{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {activeResidents} lease records
                  </span>{" "}
                  have synced as ACTIVE. The rest are residents whose
                  lease rows haven&apos;t propagated yet (new move-ins,
                  pending renewals, or month-to-month rolls AppFolio
                  hasn&apos;t reissued). Avg rent is calculated against
                  the {leasedUnits}-unit denominator so it stays stable
                  while sync catches up.
                </p>
                <a
                  href="?tab=residents"
                  className="inline-block mt-1.5 text-[10px] font-semibold text-primary underline underline-offset-2 hover:no-underline"
                >
                  Open Residents tab →
                </a>
              </div>
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
      detail: pixelFiring
        ? "Firing"
        : pixelInstalled
          ? "Installed but no recent events"
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
    // Bug #37 — Reputation was sitting in the Active Features strip
    // even though it's a passive monitoring surface, not an active
    // marketing channel. We've removed it here and trigger a
    // background scan when the operator visits the reputation tab
    // instead, so the data feels live without forcing them through
    // a separate setup state.
  ];

  const liveCount = chips.filter((c) => c.connected).length;

  return (
    <section className="rounded-xl border border-border bg-card p-3 md:p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Active features
          </p>
          <p className="text-xs text-foreground/70 mt-0.5">
            {liveCount} of {chips.length} marketing channels live
          </p>
        </div>
      </div>
      {/* Brand-aligned chip treatment. Connected = subtle blue tint +
          brand-blue dot; not connected = neutral muted. No green/amber
          status colours so the strip reads as a single product surface
          consistent with the rest of the LeaseStack canvas. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
        {chips.map((chip) => (
          <a
            key={chip.label}
            href={chip.href}
            className={`group rounded-lg border px-2.5 py-2 transition-colors ${
              chip.connected
                ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                : "border-border bg-muted/30 hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  chip.connected ? "bg-primary" : "bg-muted-foreground/40"
                }`}
              />
              <span className="text-[11px] font-semibold text-foreground truncate">
                {chip.label}
              </span>
            </div>
            <p
              className={`text-[10px] mt-0.5 truncate ${
                chip.connected ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {chip.detail}
            </p>
          </a>
        ))}
      </div>
    </section>
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
              {
                tab: "ads",
                label: "Ad performance",
                metric: adMetric,
              },
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
        `Sitting at ${args.occupancyPct}% occupancy — effectively full.`,
      );
    } else if (args.occupancyPct >= 85) {
      parts.push(
        `Occupancy is healthy at ${args.occupancyPct}% with ${args.availableUnits} unit${args.availableUnits === 1 ? "" : "s"} available.`,
      );
    } else {
      parts.push(
        `Occupancy is ${args.occupancyPct}% — ${args.availableUnits} unit${args.availableUnits === 1 ? "" : "s"} sitting and worth attention.`,
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
      `${args.noticeGiven} resident${args.noticeGiven === 1 ? " has" : "s have"} given notice — campaigns should already be live.`,
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
      headline: `Occupancy at ${args.occupancyPct}% — ${args.availableUnits} units sitting`,
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
      className={`rounded-lg border px-3 py-2 flex items-start gap-2.5 ${tone}`}
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
  const total = slices.reduce((s, x) => s + x.value, 0);
  const size = 120;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circ = 2 * Math.PI * radius;
  let cumulative = 0;
  const arcs = slices.map((s, i) => {
    const frac = s.value / total;
    const offset = -cumulative * circ;
    cumulative += frac;
    return {
      ...s,
      color: CHART_COLORS[i % CHART_COLORS.length],
      dasharray: `${frac * circ} ${circ}`,
      offset,
    };
  });
  const dominant = slices[0];
  const dominantPct = Math.round((dominant.value / total) * 100);
  return (
    <div className="grid grid-cols-[auto,1fr] gap-3 items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeDasharray={arc.dasharray}
              strokeDashoffset={arc.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-base font-semibold leading-none tabular-nums">
            {dominantPct}%
          </p>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1 px-2">
            {dominant.label}
          </p>
        </div>
      </div>
      <ul className="space-y-1 min-w-0">
        {arcs.slice(0, 5).map((arc) => {
          const pct = Math.round((arc.value / total) * 100);
          return (
            <li
              key={arc.label}
              className="flex items-center justify-between gap-2 text-[11px] min-w-0"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: arc.color }}
                />
                <span className="truncate text-foreground">{arc.label}</span>
              </span>
              <span className="tabular-nums text-muted-foreground shrink-0">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
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
