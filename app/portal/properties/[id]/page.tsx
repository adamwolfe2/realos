import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PropertyHeroBanner } from "@/components/portal/properties/property-hero-banner";
import { PropertyIntelligencePanel } from "@/components/portal/properties/property-intelligence-panel";
import { getPropertyRecommendations } from "@/lib/intelligence/property-recommendations";
import { MarketIntelligenceSection } from "@/components/portal/properties/market-intelligence-section";
import { PropertyTabs } from "./property-tabs";
import { OverviewTab } from "./tabs/overview";
import { OnboardingTab } from "./tabs/onboarding";
import { TrafficTab } from "./tabs/traffic";
import { LeadsTab } from "./tabs/leads";
import { AdsTab } from "./tabs/ads";
import { ChatbotTab } from "./tabs/chatbot";
import { OccupancyTab } from "./tabs/occupancy";
import { ReputationTab } from "./tabs/reputation";
import { ResidentsTab } from "./tabs/residents";
import { RenewalsTab } from "./tabs/renewals";
import { WorkOrdersTab } from "./tabs/work-orders";

export const metadata: Metadata = { title: "Property detail" };
export const dynamic = "force-dynamic";

export default async function PropertyDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;
  const { tab, view } = await searchParams;

  // Market Intelligence section is gated behind moduleInsights. For
  // student-housing tenants like Telegraph Commons (renting per-bed)
  // the RentCast per-unit AVM is misleading — they already know what
  // they charge. Only render the section when an operator explicitly
  // turns on the Insights module in /admin/clients/[id]. Multifamily
  // landlords with whole-unit pricing get value from it; everyone else
  // sees zero noise.
  //
  // We also pull moduleGoogleAds / moduleMetaAds here so the property
  // tab nav can decide whether to surface the Ads sub-tab at all. An
  // operator with both ad modules off (SG Real Estate at launch) gets
  // a 2-item Acquisition group (Leads, Traffic) instead of a 3-item
  // group where the third is permanently empty.
  const orgInsights = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: {
      moduleInsights: true,
      moduleMarketIntelligence: true,
      moduleGoogleAds: true,
      moduleMetaAds: true,
    },
  });
  // Market intelligence (RentCast comparables + submarket median rent +
  // hot/cold market badge) is gated behind its own opt-in flag now —
  // moduleInsights enables the analytics nav group, moduleMarketIntelligence
  // is a second gate that has to ALSO be true for this specific panel to
  // render. Norman feedback (May 22): residential operators don't want
  // rent-comp data surfaced alongside digital-marketing dashboards (same
  // direction as bugs #71/#77/#97). Defaulted false; agency admins can
  // flip it on per tenant from /admin/clients/[id] when it's wanted.
  const showMarketIntelligence =
    orgInsights?.moduleInsights === true &&
    orgInsights?.moduleMarketIntelligence === true;
  const showAdsTab =
    (orgInsights?.moduleGoogleAds ?? false) ||
    (orgInsights?.moduleMetaAds ?? false);

  // Property gate: a restricted user (UserPropertyAccess) must NEVER
  // be able to load a sibling property's detail page, even by URL
  // hacking. 404 if the requested id isn't in their allowed set.
  if (
    scope.allowedPropertyIds &&
    !scope.allowedPropertyIds.includes(id)
  ) {
    notFound();
  }

  const property = await prisma.property.findFirst({
    where: { id, ...tenantWhere(scope) },
    select: {
      id: true,
      name: true,
      slug: true,
      propertyType: true,
      residentialSubtype: true,
      commercialSubtype: true,
      addressLine1: true,
      city: true,
      state: true,
      postalCode: true,
      totalUnits: true,
      yearBuilt: true,
      lifecycle: true,
      launchStatus: true,
      backendPlatform: true,
      backendPropertyGroup: true,
      lastSyncedAt: true,
      metaTitle: true,
      metaDescription: true,
      virtualTourUrl: true,
      priceMin: true,
      priceMax: true,
      description: true,
      heroImageUrl: true,
      heroImageOffsetX: true,
      heroImageOffsetY: true,
      heroImageScale: true,
      logoUrl: true,
      photoUrls: true,
      // Operator-editable attributes (#68) — surfaced in the overview
      // sidebar via the AttributesEditor so operators can actually
      // assign categories + tags that the filter chips on
      // /portal/properties query against.
      assetCategory: true,
      profileTags: true,
    },
  });
  if (!property) notFound();

  const meta = { slug: property.slug, name: property.name };
  // Occupancy tab visibility is driven solely by whether the property has
  // any units configured. Previously we also force-showed it for properties
  // whose name contained "telegraph" because of a demo override; that
  // override has been removed so Telegraph Commons (and every other real
  // tenant) goes through the same Prisma-backed query path as everyone
  // else. NO MORE FAKE DATA IN PRODUCTION.
  const showOccupancyTab = (property.totalUnits ?? 0) > 0;

  const fullAddress = property.addressLine1
    ? [
        property.addressLine1,
        property.city ? `, ${property.city}` : "",
        property.state ? `, ${property.state}` : "",
        property.postalCode ? ` ${property.postalCode}` : "",
      ].join("")
    : null;

  // Pick the best available image for the header avatar. Mirrors the
  // dashboard leaderboard / properties list picker so the same identity
  // visual follows the property everywhere it surfaces.
  const photoFallback = (() => {
    const arr = property.photoUrls;
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0];
      return typeof first === "string" && first.length > 0 ? first : null;
    }
    return null;
  })();
  const avatarSrc = property.heroImageUrl ?? photoFallback;

  // Cheap headline-stat queries for the new hero banner. We grab counts
  // for the trailing 30d and prior 30d so the banner can show meaningful
  // delta context — empty windows render as "—" so the operator never
  // sees "0% / 0%" noise. Wrapped in catch so a Prisma hiccup never
  // blocks the page render.
  const now = new Date();
  const thirty = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixty = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [
    leadsCurrent,
    leadsPrior,
    convosCurrent,
    convosPrior,
    rating,
  ] = await Promise.all([
    prisma.lead
      .count({
        where: {
          orgId: scope.orgId,
          propertyId: property.id,
          createdAt: { gte: thirty, lte: now },
        },
      })
      .catch(() => 0),
    prisma.lead
      .count({
        where: {
          orgId: scope.orgId,
          propertyId: property.id,
          createdAt: { gte: sixty, lt: thirty },
        },
      })
      .catch(() => 0),
    prisma.chatbotConversation
      .count({
        where: {
          orgId: scope.orgId,
          propertyId: property.id,
          createdAt: { gte: thirty, lte: now },
        },
      })
      .catch(() => 0),
    prisma.chatbotConversation
      .count({
        where: {
          orgId: scope.orgId,
          propertyId: property.id,
          createdAt: { gte: sixty, lt: thirty },
        },
      })
      .catch(() => 0),
    prisma.property
      .findUnique({
        where: { id: property.id },
        select: { googleAggRating: true, googleAggReviewCount: true },
      })
      .catch(() => null),
  ]);

  const fmtDelta = (cur: number, prior: number): {
    delta?: string;
    tone?: "positive" | "negative" | "neutral";
  } => {
    if (cur === 0 && prior === 0) return {};
    if (prior === 0) return { delta: "New", tone: "positive" };
    const pct = Math.round(((cur - prior) / prior) * 100);
    if (pct === 0) return { delta: "Flat", tone: "neutral" };
    return {
      delta: `${pct > 0 ? "+" : ""}${pct}% vs prior`,
      tone: pct > 0 ? "positive" : "negative",
    };
  };

  const subtitleParts: string[] = [];
  if (property.city) subtitleParts.push(property.city);
  if (property.residentialSubtype) {
    subtitleParts.push(
      property.residentialSubtype
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    );
  } else if (property.commercialSubtype) {
    subtitleParts.push(
      property.commercialSubtype
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    );
  } else if (property.propertyType) {
    subtitleParts.push(
      property.propertyType
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    );
  }

  // Hide-zero on the hero stat row. Pre-cleanup (2026-06-04) every
  // tile rendered as "—" when its signal was unset, so a brand-new
  // tenant saw four em-dashes. Now we only render tiles whose data
  // is real; the row narrows naturally to surface live metrics.
  const allHeroStats: Array<{
    label: string;
    value: string;
    delta?: string;
    tone?: "positive" | "negative" | "neutral";
    hasData: boolean;
  }> = [
    {
      label: "Leads · 30d",
      value: leadsCurrent > 0 ? leadsCurrent.toLocaleString("en-US") : "—",
      ...fmtDelta(leadsCurrent, leadsPrior),
      hasData: leadsCurrent > 0,
    },
    {
      label: "Conversations · 30d",
      value:
        convosCurrent > 0 ? convosCurrent.toLocaleString("en-US") : "—",
      ...fmtDelta(convosCurrent, convosPrior),
      hasData: convosCurrent > 0,
    },
    {
      label: "Units",
      value:
        property.totalUnits != null && property.totalUnits > 0
          ? property.totalUnits.toLocaleString("en-US")
          : "—",
      hasData: (property.totalUnits ?? 0) > 0,
    },
    {
      label: "Reputation",
      value:
        rating?.googleAggRating != null
          ? `${rating.googleAggRating.toFixed(1)}★`
          : "—",
      delta:
        rating?.googleAggReviewCount != null && rating.googleAggReviewCount > 0
          ? `${rating.googleAggReviewCount} reviews`
          : undefined,
      tone: "neutral" as const,
      hasData: rating?.googleAggRating != null,
    },
  ];
  const heroStats = allHeroStats
    .filter((s) => s.hasData)
    .map(({ hasData: _hd, ...rest }) => rest);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/portal/properties"
          className="inline-flex items-center text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All properties
        </Link>
        <Link
          href={`/portal/properties/${property.id}/snapshot`}
          className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          Marketing snapshot →
        </Link>
      </div>

      {/* Premium "profile picture" hero. Replaces the previous flat
          PageHeader + PropertyAvatar combo so featured properties like
          Telegraph Commons read as a brand with real metrics, not a row
          in a table. Image floats above a soft ground shadow + brand
          gradient — drag-and-drop or click "Replace" to upload. */}
      <PropertyHeroBanner
        propertyId={property.id}
        propertyName={property.name}
        subtitle={
          subtitleParts.length > 0
            ? `${subtitleParts.join(" · ")}${fullAddress ? ` — ${fullAddress}` : ""}`
            : fullAddress
        }
        heroImageUrl={avatarSrc}
        stats={heroStats}
        imageOffsetX={property.heroImageOffsetX}
        imageOffsetY={property.heroImageOffsetY}
        imageScale={property.heroImageScale}
      />

      {/* Intelligence panel — proactive recommendations synthesized
          from real-time signals (reputation, SEO, AEO, listing
          hygiene, content freshness). Streamed via Suspense so a
          slow Prisma query never blocks the hero render. */}
      <Suspense fallback={<IntelligenceSkeleton />}>
        <IntelligenceSection
          orgId={scope.orgId}
          propertyId={property.id}
          propertyName={property.name}
        />
      </Suspense>

      {/* Score history + Recent activity removed (May 28 2026) — operator
          feedback: the trend chart and 14-day rec-status feed weren't
          surfacing anything actionable. The Intelligence section above
          and the property tabs below carry the load. */}

      {showMarketIntelligence ? (
        <Suspense fallback={<MarketIntelligenceSkeleton />}>
          <MarketIntelligenceSection propertyId={property.id} />
        </Suspense>
      ) : null}

      <Suspense fallback={<PropertyTabsSkeleton />}>
      <PropertyTabs
        initialTab={tab ?? "overview"}
        showOccupancy={showOccupancyTab}
        showAds={showAdsTab}
        panels={{
          onboarding: (
            <OnboardingTab orgId={scope.orgId} propertyId={property.id} />
          ),
          overview: (
            <OverviewTab
              orgId={scope.orgId}
              propertyId={property.id}
              propertyMeta={meta}
              property={{
                propertyType: property.propertyType,
                residentialSubtype: property.residentialSubtype,
                commercialSubtype: property.commercialSubtype,
                totalUnits: property.totalUnits,
                yearBuilt: property.yearBuilt,
                lifecycle: property.lifecycle,
                launchStatus: property.launchStatus,
                backendPlatform: property.backendPlatform,
                backendPropertyGroup: property.backendPropertyGroup,
                lastSyncedAt: property.lastSyncedAt,
                metaTitle: property.metaTitle,
                metaDescription: property.metaDescription,
                virtualTourUrl: property.virtualTourUrl,
                priceMinCents: property.priceMin ?? null,
                priceMaxCents: property.priceMax ?? null,
                heroImageUrl: property.heroImageUrl,
                description: property.description,
                orgHasAdsModule: showAdsTab,
                assetCategory: property.assetCategory,
                profileTags: property.profileTags ?? [],
              }}
            />
          ),
          traffic: (
            <TrafficTab
              orgId={scope.orgId}
              propertyId={property.id}
              propertyMeta={meta}
            />
          ),
          leads: (
            <LeadsTab
              orgId={scope.orgId}
              propertyId={property.id}
              propertyMeta={meta}
            />
          ),
          ads: (
            <AdsTab
              orgId={scope.orgId}
              propertyId={property.id}
            />
          ),
          chatbot: (
            <ChatbotTab
              orgId={scope.orgId}
              propertyId={property.id}
              propertyName={property.name}
            />
          ),
          reputation: (
            <ReputationTab
              orgId={scope.orgId}
              propertyId={property.id}
              propertyName={property.name}
              propertyAddress={[
                property.addressLine1,
                property.city,
                property.state,
                property.postalCode,
              ]
                .filter(Boolean)
                .join(", ") || null}
            />
          ),
          occupancy: showOccupancyTab ? (
            <OccupancyTab
              orgId={scope.orgId}
              propertyId={property.id}
            />
          ) : null,
          residents: (
            <ResidentsTab
              orgId={scope.orgId}
              propertyId={property.id}
              view={
                (["all", "active", "notice", "past", "evicted"] as const).includes(
                  view as never,
                )
                  ? (view as "all" | "active" | "notice" | "past" | "evicted")
                  : "active"
              }
            />
          ),
          renewals: (
            <RenewalsTab
              orgId={scope.orgId}
              propertyId={property.id}
            />
          ),
          "work-orders": (
            <WorkOrdersTab
              orgId={scope.orgId}
              propertyId={property.id}
            />
          ),
        }}
      />
      </Suspense>
    </div>
  );
}

// Streamed-tab skeleton. Renders immediately under the property header
// while the heavy per-tab Prisma queries resolve, so the page never looks
// blank between the header and the tab content. Matches the dimensions
// of the real tab bar + KPI strip closely enough that there's no layout
// shift when content arrives.
// Market intelligence first-load skeleton. Matches the SectionCard width
// + a hero card silhouette so the section reserves vertical space while
// RentCast fetches the snapshot (cache hit ~5ms, cold ~600-900ms).
function MarketIntelligenceSkeleton() {
  return (
    <div className="ls-card p-5 animate-pulse" aria-label="Loading market intelligence">
      <div className="h-3 w-32 bg-muted/60 rounded mb-4" />
      <div className="rounded-xl border border-[var(--hair)] p-5 space-y-3">
        <div className="h-2.5 w-28 bg-muted/60 rounded" />
        <div className="h-10 w-44 bg-muted rounded" />
        <div className="h-3 w-56 bg-muted/40 rounded" />
      </div>
    </div>
  );
}

function PropertyTabsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading property data">
      <div className="flex gap-1.5 border-b border-border pb-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-muted/60 rounded-t" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 space-y-2"
          >
            <div className="h-3 w-20 bg-muted/60 rounded" />
            <div className="h-7 w-16 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted/40 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-3"
          >
            <div className="h-4 w-32 bg-muted rounded" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={j}
                className="flex justify-between gap-2"
              >
                <div className="h-3 w-20 bg-muted/60 rounded" />
                <div className="h-3 w-32 bg-muted/80 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// IntelligenceSection — Suspense child that runs the recommendation
// engine off the critical path so the hero banner renders immediately
// and the recommendations stream in a moment later.
// ---------------------------------------------------------------------------
async function IntelligenceSection({
  orgId,
  propertyId,
  propertyName,
}: {
  orgId: string;
  propertyId: string;
  propertyName: string;
}) {
  // Two engines in parallel. ProactiveAction = "lib/intelligence" rules
  // (listings, reputation, ads). SeoActionRecommendation = "lib/seo"
  // rules (CTR, AEO, neighborhood pages, etc.). Merge + dedupe + sort
  // by composite score so the operator sees one ranked queue.
  const [actions, seoRows] = await Promise.all([
    getPropertyRecommendations(orgId, propertyId).catch(() => []),
    prisma.seoActionRecommendation
      .findMany({
        where: {
          orgId,
          propertyId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        orderBy: [{ severity: "asc" }, { score: "desc" }],
        take: 8,
        select: {
          id: true,
          kind: true,
          category: true,
          severity: true,
          title: true,
          detail: true,
          estimateMinutes: true,
          score: true,
          actionHref: true,
          actionLabel: true,
        },
      })
      .catch(() => []),
  ]);

  // Adapt SeoActionRecommendation rows to ProactiveAction shape so the
  // panel renders them uniformly. Category gets mapped: CTR_FIX/ONPAGE→seo,
  // AEO_*→aeo, NEIGHBORHOOD_PAGE/REFRESH/SCHEMA→content_freshness,
  // BACKLINK→competitor.
  const seoAdapted = seoRows.map((r) => ({
    id: `seo:${r.id}`,
    category:
      r.category === "CTR_FIX" || r.category === "ONPAGE_AUDIT"
        ? ("seo" as const)
        : r.category === "AEO_GAP" || r.category === "AEO_NOT_CITED"
          ? ("aeo" as const)
          : r.category === "NEIGHBORHOOD_PAGE" ||
              r.category === "CONTENT_GAP" ||
              r.category === "REFRESH" ||
              r.category === "SCHEMA_GAP"
            ? ("content_freshness" as const)
            : r.category === "BACKLINK_OPPORTUNITY"
              ? ("competitor" as const)
              : ("listing" as const),
    severity:
      r.severity === "CRITICAL"
        ? ("critical" as const)
        : r.severity === "HIGH"
          ? ("high" as const)
          : r.severity === "MEDIUM"
            ? ("medium" as const)
            : ("low" as const),
    title: r.title,
    detail: r.detail,
    estimateMinutes: r.estimateMinutes,
    score: r.score,
    actionHref: r.actionHref ?? "/portal/seo/agent",
    actionLabel: r.actionLabel ?? "Open Agent",
    icon: "Sparkles" as const,
  }));

  // Merge + sort by composite score. Cap at 8 so we don't drown the panel.
  const merged = [...actions, ...seoAdapted]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return (
    <PropertyIntelligencePanel propertyName={propertyName} actions={merged} />
  );
}

function IntelligenceSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-6 w-6 rounded-md bg-muted" />
        <div className="h-4 w-48 bg-muted rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
          >
            <div className="h-9 w-9 rounded-lg bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 bg-muted rounded" />
              <div className="h-2.5 w-1/2 bg-muted/60 rounded" />
            </div>
            <div className="h-7 w-16 bg-muted rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
