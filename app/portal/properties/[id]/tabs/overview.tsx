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

// Single muted accent palette so the source list reads as data, not as a rainbow.
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
    noticeResidents,
    rentRoll,
    // Onboarding-shell detection still relies on these. Kept lean —
    // the heavy "active features" / quick-actions rail data was cut.
    cursiveIntegration,
    seoIntegrations,
    googleAdCampaign,
    metaAdCampaign,
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
        select: { cursivePixelId: true },
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
        select: { id: true },
      })
      .catch(() => null),
    prisma.adCampaign
      .findFirst({
        where: { orgId, propertyId, platform: "META" },
        select: { id: true },
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
  const singleSourceLabel =
    sourceSlices.length === 1 ? sourceSlices[0].label : null;

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
      : "—";

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

  // Sparse-data threshold for the funnel viz.
  const FUNNEL_MIN = 5;
  const showCompactFunnel = kpis.leads28d < FUNNEL_MIN;

  // Leads KPI hint — be honest about channel mix and ad coverage.
  const leadsHint =
    kpis.leads28d === 0
      ? "First lead lands here"
      : !property.orgHasAdsModule && singleSourceLabel
        ? `All from ${singleSourceLabel} · No paid spend`
        : singleSourceLabel
          ? `All from ${singleSourceLabel}`
          : !property.orgHasAdsModule
            ? "No paid spend"
            : `${kpis.tours28d} tours · ${kpis.applications28d} apps`;

  const renewalsHint =
    expiringTotal === 0
      ? "No leases up in 120d"
      : renewalsNext30Rent > 0
        ? `$${Math.round(renewalsNext30Rent / 100 / 1000).toLocaleString()}K of monthly rent`
        : `${expiringTotal} in next 120d`;

  return (
    <div className="space-y-4 ls-page-fade">
      {/* 1. Hero strip — name, address, photo, fact row. No ring, no briefing,
            no quick-actions rail. */}
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
        <>
          {/* 2. Insights hero — top 3 ranked insights for this property. */}
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

          {/* 3. KPI strip — four equal tiles. One occupancy display per page. */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <KpiTile
              label="Occupancy"
              value={occupancyPct != null ? `${occupancyPct}%` : <DimZero />}
              hint={
                totalUnits != null && leasedUnits != null
                  ? `${leasedUnits} of ${totalUnits} units leased`
                  : "Connect AppFolio for live occupancy"
              }
            />
            <KpiTile
              label="Monthly rent"
              value={monthlyRentRoll > 0 ? monthlyRentRollDisplay : <DimZero />}
              hint={
                leasedUnits != null && leasedUnits > 0
                  ? `From ${leasedUnits} leased units`
                  : "From active leases"
              }
            />
            <KpiTile
              label="Leads (28d)"
              value={kpis.leads28d > 0 ? kpis.leads28d : <DimZero />}
              delta={leadsDelta}
              hint={leadsHint}
            />
            <KpiTile
              label="Renewals (next 30d)"
              value={buckets[0].count > 0 ? buckets[0].count : <DimZero />}
              hint={renewalsHint}
            />
          </section>

          {/* 4. Lead funnel + Renewal pipeline (50/50). */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <DashboardSection
              title="Lead funnel"
              eyebrow="28-day"
              description={
                kpis.leads28d === 0
                  ? "Funnel data unlocks at first lead."
                  : showCompactFunnel
                    ? "Visit → lead → tour → application. Needs more volume to read as a chart."
                    : "Visit-to-lease progression. Drop-off rates show where the funnel leaks."
              }
            >
              {kpis.leads28d === 0 ? null : showCompactFunnel ? (
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
                  tourRate={tourRate}
                  appRate={appRate}
                />
              )}
            </DashboardSection>

            <DashboardSection
              title="Renewal pipeline"
              eyebrow="Next 120 days"
              description={
                expiringTotal === 0
                  ? "No leases up for renewal in the window."
                  : `${expiringTotal} ${expiringTotal === 1 ? "lease" : "leases"} up for renewal`
              }
            >
              {expiringTotal === 0 ? (
                <RenewalEmpty />
              ) : (
                <RenewalsList buckets={buckets} />
              )}
            </DashboardSection>
          </section>

          {/* 5. Property details + Marketing (50/50). */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <DashboardSection title="Property details" eyebrow="Basics">
              <dl className="space-y-1 text-xs">
                {property.propertyType ? (
                  <Row k="Type" v={property.propertyType} />
                ) : null}
                {property.residentialSubtype || property.commercialSubtype ? (
                  <Row
                    k="Subtype"
                    v={
                      property.residentialSubtype ??
                      property.commercialSubtype ??
                      ""
                    }
                  />
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
              </dl>
            </DashboardSection>

            <DashboardSection title="Marketing" eyebrow="SEO & listings">
              <dl className="space-y-1 text-xs">
                {property.metaDescription ? (
                  <Row k="Meta description" v={property.metaDescription} />
                ) : null}
                {property.metaTitle ? (
                  <Row k="Meta title" v={property.metaTitle} />
                ) : null}
                {priceRange !== "—" ? (
                  <Row k="Price range" v={priceRange} />
                ) : null}
                <Row
                  k="Listings configured"
                  v={(listingCounts?._count.listings ?? 0).toString()}
                />
              </dl>
              {sourceSlices.length > 0 ? (
                <div className="pt-2 mt-2 border-t border-border">
                  <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground mb-1.5">
                    Top lead sources (28d)
                  </div>
                  <SourceMix slices={sourceSlices} total={sourceTotal} />
                </div>
              ) : null}
            </DashboardSection>
          </section>
        </>
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
            <p className="mt-1.5 text-[12.5px] text-muted-foreground tabular-nums leading-snug">
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
// Visualizations — pure SVG / divs, server-renderable.
// ---------------------------------------------------------------------------

function FunnelBars({
  stages,
  tourRate,
  appRate,
}: {
  stages: Array<{ label: string; value: number; color: string }>;
  tourRate: number;
  appRate: number;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  const rates = [null, tourRate, appRate] as Array<number | null>;
  return (
    <ul className="space-y-2">
      {stages.map((s, i) => {
        const widthPct = Math.max(6, Math.round((s.value / max) * 100));
        const rate = rates[i];
        return (
          <li key={s.label} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="font-medium text-foreground">{s.label}</span>
              <span className="tabular-nums">
                <span className="text-foreground font-semibold">
                  {s.value.toLocaleString()}
                </span>
                {rate != null && rate > 0 ? (
                  <span className="ml-1.5 text-muted-foreground">
                    {rate}% conv
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
  total,
}: {
  slices: Array<{ label: string; value: number }>;
  total: number;
}) {
  const max = slices.reduce((m, s) => Math.max(m, s.value), 0) || 1;
  const rows = slices.slice(0, 5).map((s, i) => ({
    ...s,
    color: CHART_COLORS[i % CHART_COLORS.length],
    pct: total > 0 ? Math.round((s.value / total) * 100) : 0,
    barPct: Math.max(2, (s.value / max) * 100),
  }));

  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.label} className="space-y-0.5">
          <div className="flex items-center justify-between gap-2 text-[11.5px] min-w-0">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate font-medium text-foreground">
                {row.label}
              </span>
            </span>
            <span className="tabular-nums text-muted-foreground shrink-0 text-[11px]">
              <span className="font-semibold text-foreground">{row.value}</span>
              <span className="ml-1">&middot; {row.pct}%</span>
            </span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: "rgba(37,99,235,0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${row.barPct}%`,
                backgroundColor: row.color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Compact renewals list — one row per 30-day bucket. Replaces the 4-bar
// chart (which ate ~180px of vertical space for 4 numbers).
function RenewalsList({
  buckets,
}: {
  buckets: Array<{ label: string; count: number; rentCents: number }>;
}) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
      {buckets.map((b) => (
        <li
          key={b.label}
          className="flex items-baseline justify-between gap-3 px-3 py-2"
        >
          <span className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
            {b.label}
          </span>
          <span className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[13px] font-semibold text-foreground">
              {b.count.toLocaleString()}
              <span className="ml-1 text-[10.5px] font-normal text-muted-foreground">
                {b.count === 1 ? "lease" : "leases"}
              </span>
            </span>
            {b.rentCents > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                · ${Math.round(b.rentCents / 100).toLocaleString()}/mo
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
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
// Sparse-data primitives.
// ---------------------------------------------------------------------------

function DimZero() {
  return <span className="text-muted-foreground/40 tabular-nums">—</span>;
}

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
