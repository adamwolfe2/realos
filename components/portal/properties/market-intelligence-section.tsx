import "server-only";
import { prisma } from "@/lib/db";
import { SectionCard } from "@/components/admin/page-header";
import { getMarketStats, getRentAvm } from "@/lib/rentcast/cache";
import { getUsageSummary } from "@/lib/rentcast/budget";
import {
  computeRentGap,
  freshnessCopy,
  marketTemperature,
} from "@/lib/rentcast/insights";
import type { MarketStatsResponse, RentAvmResponse } from "@/lib/rentcast/client";
import { MarketIntelligenceClient } from "./market-intelligence-client";

// ---------------------------------------------------------------------------
// MarketIntelligenceSection — the ONE flagship surface for Phase 1.
//
// Pulls a fresh (or cached) RentCast rent AVM + market stats snapshot for
// the property, then renders the premium-feel intelligence card stack:
//
//   * Hero rent AVM card with confidence band + freshness chip
//   * Optional rent-gap bar (only when the property has a baseline rent)
//   * Market temperature pill (HOT / WARM / COOL)
//   * Comparables strip (3 horizontally-scrollable cards)
//   * Refresh control (rate-limited 1/property/day)
//
// Lives below the page header but above the operational tabs on
// /portal/properties/[id]. See app/portal/properties/[id]/page.tsx for
// the insertion point.
// ---------------------------------------------------------------------------

type Props = {
  propertyId: string;
};

export async function MarketIntelligenceSection({ propertyId }: Props) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      orgId: true,
      addressLine1: true,
      city: true,
      state: true,
      postalCode: true,
      propertyType: true,
      priceMin: true,
    },
  });
  if (!property) return null;

  // Hard guard: the page-level loader already enforces tenancy on the
  // property record, so we trust property.orgId here for the lookup.
  // Cards still render an empty state on any missing data.

  if (!process.env.RENTCAST_API_KEY) {
    return (
      <SectionCard
        label="Market intelligence"
        description="RentCast isn't configured for this environment yet."
      >
        <div className="text-sm text-muted-foreground">
          Add <code className="text-xs px-1 py-0.5 rounded bg-muted">RENTCAST_API_KEY</code>{" "}
          to the workspace environment to enable rent AVM, comparables, and submarket trend
          intelligence on this property.
        </div>
      </SectionCard>
    );
  }

  if (!property.addressLine1 || !property.postalCode) {
    return (
      <SectionCard
        label="Market intelligence"
        description="Add an address + zip code to unlock market intelligence."
      >
        <div className="text-sm text-muted-foreground">
          RentCast needs a street address and zip to return a rent AVM. Fill those in on the
          Overview tab and the section will populate.
        </div>
      </SectionCard>
    );
  }

  const address = [
    property.addressLine1,
    property.city,
    property.state,
    property.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  // First-view fetch — both calls share the per-org budget gate. Cache
  // hits return without spending a credit. Hard-cap orgs land in
  // `ok:false / reason:OVER_HARD_CAP` and we render the upsell card.
  const [rent, market, usage] = await Promise.all([
    getRentAvm({
      orgId: property.orgId,
      propertyId: property.id,
      address,
      propertyType: rentcastPropertyType(property.propertyType),
    }),
    getMarketStats({
      orgId: property.orgId,
      propertyId: property.id,
      zipCode: property.postalCode,
    }),
    getUsageSummary(property.orgId),
  ]);

  const overCap =
    (rent.ok === false && rent.reason === "OVER_HARD_CAP") ||
    (market.ok === false && market.reason === "OVER_HARD_CAP");

  if (overCap) {
    return <UpsellCard used={usage.used} budget={usage.budget} />;
  }

  const rentData = rent.ok ? rent.data : rent.stale?.data ?? null;
  const rentFetchedAt = rent.ok ? rent.fetchedAt : rent.stale?.fetchedAt ?? null;
  const marketData = market.ok ? market.data : market.stale?.data ?? null;

  if (!rentData) {
    return (
      <SectionCard label="Market intelligence">
        <div className="text-sm text-muted-foreground">
          {rent.ok === false
            ? rent.message
            : "RentCast doesn't have data for this property's exact attributes — try refreshing manually."}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      label="Market intelligence"
      description="Live submarket rent, comparables, and temperature for this property."
      action={
        <MarketIntelligenceClient
          propertyId={property.id}
          freshnessLabel={rentFetchedAt ? freshnessCopy(rentFetchedAt) : "Just now"}
        />
      }
    >
      <div className="space-y-6">
        <HeroRentAvmCard
          rent={rentData}
          fetchedAt={rentFetchedAt}
        />
        <RentGapBar
          currentRentCents={property.priceMin}
          marketMid={rentData.rent}
          rentRangeLow={rentData.rentRangeLow}
          rentRangeHigh={rentData.rentRangeHigh}
        />
        <MarketTemperatureRow
          market={marketData}
          zipCode={property.postalCode}
        />
        <ComparablesStrip comparables={rentData.comparables.slice(0, 3)} />
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Hero rent AVM card
// ---------------------------------------------------------------------------

function HeroRentAvmCard({
  rent,
  fetchedAt,
}: {
  rent: RentAvmResponse;
  fetchedAt: Date | null;
}) {
  return (
    <div className="rounded-xl border border-[var(--hair)] bg-card p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <div
            className="ls-eyebrow text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--terracotta, #1e3a8a)" }}
          >
            Estimated market rent
          </div>
          <div className="mt-1 text-[42px] md:text-[48px] leading-none font-semibold tracking-tight text-foreground">
            ${Math.round(rent.rent).toLocaleString()}
            <span className="text-[18px] md:text-[20px] text-muted-foreground font-medium align-baseline ml-1">
              /mo
            </span>
          </div>
          <div className="mt-2 text-[13px] text-muted-foreground">
            Range: ${Math.round(rent.rentRangeLow).toLocaleString()} – ${Math.round(
              rent.rentRangeHigh,
            ).toLocaleString()}/mo
          </div>
        </div>
        <div className="shrink-0 inline-flex items-center gap-1.5 self-start md:self-end rounded-full border border-[var(--hair)] bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--terracotta, #1e3a8a)" }}
            aria-hidden
          />
          {fetchedAt ? freshnessCopy(fetchedAt) : "Just now"} · via RentCast Intelligence
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rent gap bar — only renders when the property has a baseline rent
// (priceMin used as the operator's "current asking rent" proxy).
// ---------------------------------------------------------------------------

function RentGapBar({
  currentRentCents,
  marketMid,
  rentRangeLow,
  rentRangeHigh,
}: {
  currentRentCents: number | null;
  marketMid: number;
  rentRangeLow: number;
  rentRangeHigh: number;
}) {
  if (currentRentCents == null) return null;

  const currentRent = Math.round(currentRentCents / 100);
  const gap = computeRentGap(currentRentCents, marketMid);

  // Position on the bar: clamp to the [low, high] visible range.
  const lo = Math.min(rentRangeLow, currentRent);
  const hi = Math.max(rentRangeHigh, currentRent);
  const denom = hi - lo;
  const safe = (v: number) => (denom <= 0 ? 50 : ((v - lo) / denom) * 100);
  const currentPct = safe(currentRent);
  const midPct = safe(marketMid);

  const directionTone =
    gap.direction === "below"
      ? "text-emerald-700"
      : gap.direction === "above"
        ? "text-rose-700"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-[var(--hair)] bg-card p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-[13px] font-semibold text-foreground">Your rent vs. market</h3>
        <div className="text-[11px] text-muted-foreground">
          Current ${currentRent.toLocaleString()}/mo
        </div>
      </div>
      <div className="relative h-3 rounded-full bg-muted/50 overflow-hidden">
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-amber-400"
          style={{ left: `${midPct}%` }}
          aria-hidden
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-foreground bg-background"
          style={{ left: `calc(${currentPct}% - 6px)` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-muted-foreground">
        <span>${Math.round(rentRangeLow).toLocaleString()}</span>
        <span>Market mid ${Math.round(marketMid).toLocaleString()}</span>
        <span>${Math.round(rentRangeHigh).toLocaleString()}</span>
      </div>
      <p className={`mt-3 text-[13px] ${directionTone}`}>{gap.copy}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Market temperature pill
// ---------------------------------------------------------------------------

function MarketTemperatureRow({
  market,
  zipCode,
}: {
  market: MarketStatsResponse | null;
  zipCode: string;
}) {
  if (!market) {
    return (
      <div className="text-[12px] text-muted-foreground">
        Submarket stats unavailable for {zipCode}.
      </div>
    );
  }
  const dom = market.rentalData.medianDaysOnMarket;
  const temp = marketTemperature(dom);
  const styles =
    temp === "HOT"
      ? "bg-gradient-to-r from-rose-500 to-orange-400 text-white"
      : temp === "WARM"
        ? "bg-amber-100 text-amber-900 border border-amber-200"
        : "bg-blue-100 text-blue-900 border border-blue-200";
  const label =
    temp === "HOT"
      ? "Hot market"
      : temp === "WARM"
        ? "Warm market"
        : "Cool market";
  const median = market.rentalData.medianRent;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${styles}`}
      >
        {label}
      </span>
      <span className="text-[12px] text-muted-foreground">
        {dom != null ? `${dom}-day median time on market in ${zipCode}` : `Median DOM unavailable for ${zipCode}`}
        {median != null ? ` · Submarket median rent $${Math.round(median).toLocaleString()}/mo` : ""}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comparables strip — horizontally-scrollable card row, 3 visible at a time.
// ---------------------------------------------------------------------------

function ComparablesStrip({
  comparables,
}: {
  comparables: RentAvmResponse["comparables"];
}) {
  if (comparables.length === 0) {
    return (
      <div className="text-[12px] text-muted-foreground">
        RentCast didn't return any nearby comparables for this property — try refreshing
        manually after operator edits to attributes.
      </div>
    );
  }
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-foreground mb-3">Nearby comparables</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {comparables.map((c, idx) => (
          <article
            key={`${c.formattedAddress ?? "comp"}-${idx}`}
            className="snap-start shrink-0 w-[260px] md:w-[280px] rounded-lg border border-[var(--hair)] bg-card p-4 hover:border-foreground/30 transition-colors"
          >
            <div className="text-[12px] font-medium text-foreground line-clamp-2 leading-snug">
              {c.formattedAddress ?? "Address withheld"}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              {c.bedrooms != null ? <span>{c.bedrooms}br</span> : null}
              {c.bathrooms != null ? <span>· {c.bathrooms}ba</span> : null}
              {c.squareFootage != null ? <span>· {c.squareFootage} sqft</span> : null}
            </div>
            <div className="mt-3 text-[20px] font-semibold tracking-tight text-foreground">
              {c.price != null ? `$${Math.round(c.price).toLocaleString()}/mo` : "—"}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
              <span>
                {c.distance != null ? `${c.distance.toFixed(2)} mi` : ""}
              </span>
              <span>
                {c.daysOld != null
                  ? c.daysOld === 0
                    ? "listed today"
                    : `listed ${c.daysOld}d ago`
                  : ""}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upsell card — shown when org is over `monthlyBudget * hardCapMultiplier`.
// ---------------------------------------------------------------------------

function UpsellCard({ used, budget }: { used: number; budget: number }) {
  return (
    <SectionCard label="Market intelligence">
      <div className="rounded-xl border border-[var(--hair)] bg-gradient-to-br from-amber-50 to-orange-50 p-6">
        <div className="ls-eyebrow text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
          Upgrade to keep refreshing
        </div>
        <p className="mt-2 text-[20px] md:text-[22px] font-semibold tracking-tight text-foreground">
          You've used {used}/{budget} RentCast Intelligence credits this month.
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Upgrade to Foundation for 1,000 calls/month and unlimited refresh.
        </p>
        <a
          href="/portal/billing?intent=upgrade"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background hover:opacity-90 transition-opacity"
        >
          Upgrade plan
        </a>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function rentcastPropertyType(t: string | null | undefined): string | undefined {
  if (!t) return undefined;
  if (t === "RESIDENTIAL") return "Apartment";
  return undefined;
}
