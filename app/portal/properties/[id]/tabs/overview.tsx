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
import { Sparkles } from "lucide-react";
import { AnimatedNumber } from "@/components/portal/ui/animated-number";

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

  return (
    <div className="space-y-3">
      {/* AI Insight banner */}
      <AiInsightCard insight={aiInsight} />

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
              <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                <AnimatedNumber value={activeResidents} />
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                Avg rent / unit
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                <AnimatedNumber
                  value={
                    activeResidents > 0
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

      {/* Property details + Marketing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <DashboardSection title="Property details" eyebrow="Basics">
          <dl className="space-y-1 text-xs">
            <Row k="Type" v={property.propertyType} />
            <Row
              k="Subtype"
              v={
                property.residentialSubtype ??
                property.commercialSubtype ??
                "—"
              }
            />
            <Row k="Total units" v={property.totalUnits?.toString() ?? "—"} />
            <Row k="Year built" v={property.yearBuilt?.toString() ?? "—"} />
            <Row k="Backend" v={property.backendPlatform} />
            <Row
              k="Property group"
              v={property.backendPropertyGroup ?? "—"}
            />
            <Row
              k="Last synced"
              v={
                property.lastSyncedAt
                  ? new Date(property.lastSyncedAt).toLocaleString()
                  : "Never"
              }
            />
          </dl>
        </DashboardSection>

        <DashboardSection title="Marketing" eyebrow="SEO & listings">
          <dl className="space-y-1 text-xs">
            <Row k="Meta title" v={property.metaTitle ?? "—"} />
            <Row
              k="Meta description"
              v={property.metaDescription ?? "—"}
            />
            <Row k="Virtual tour" v={property.virtualTourUrl ?? "—"} />
            <Row k="Price range" v={priceRange} />
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
    </div>
  );
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
  const tone =
    insight.severity === "alert"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : insight.severity === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : insight.severity === "ok"
          ? "border-primary/30 bg-primary/10 text-primary"
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
