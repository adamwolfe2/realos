import "server-only";
import { prisma } from "@/lib/db";
import { TourStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Portfolio funnel — a dead-simple, manager-facing roll-up across every
// property: Traffic → Leads (by source) → Tours → Applications, with the
// step-down conversion rate between each stage. Pure aggregation over existing
// models (Visitor / Lead / Tour / Application); no schema change.
//
// Scoping: when `propertyIds` is null the report is portfolio-wide (org scope,
// including rows the pixel hasn't attributed to a property yet — important so
// the Traffic number isn't silently undercounted). When `propertyIds` is an
// array (a property filter is active, or the viewer only has access to a
// subset) every stage is scoped to those properties so totals == sum of rows.
// ---------------------------------------------------------------------------

export type FunnelStage = {
  key: "traffic" | "leads" | "tours" | "applications";
  label: string;
  value: number;
  /** Conversion % from the previous stage (undefined for the first stage). */
  conversionFromPrev?: number;
};

export type PortfolioFunnel = {
  periodDays: number;
  stages: FunnelStage[];
  toursCompleted: number;
  sources: Array<{ source: string; count: number }>;
  appStatus: Array<{ status: string; count: number }>;
  byProperty: Array<{
    propertyId: string;
    name: string;
    visitors: number;
    leads: number;
    tours: number;
    applications: number;
  }>;
};

const SOURCE_LABEL: Record<string, string> = {
  CHATBOT: "Chatbot",
  FORM: "Web form",
  PIXEL_OUTREACH: "Pixel outreach",
  REFERRAL: "Referral",
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  ORGANIC: "Organic",
  DIRECT: "Direct",
  EMAIL_CAMPAIGN: "Email",
  COLD_EMAIL: "Cold email",
  MANUAL: "Manual",
  OTHER: "Other",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

// Step-down conversion %: numerator over the prior stage, guarded against
// division by zero and capped at 100 (a later stage can exceed an earlier one
// when records arrive out of order within the window — don't show >100%).
export function conversionPct(value: number, prev: number): number | undefined {
  if (prev <= 0) return undefined;
  return Math.min(100, Math.round((value / prev) * 100));
}

export async function getPortfolioFunnel(params: {
  orgId: string;
  /** null = portfolio-wide (org scope); array = restrict to these properties. */
  propertyIds: string[] | null;
  periodDays?: number;
}): Promise<PortfolioFunnel> {
  const periodDays = params.periodDays ?? 30;
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const { orgId, propertyIds } = params;
  const scoped = propertyIds !== null;

  // Per-model where clauses. Visitor/Lead carry orgId directly; Tour/Application
  // reach the org through their property relation.
  const orgScoped = { gte: since };
  const visitorWhere = scoped
    ? { orgId, propertyId: { in: propertyIds }, firstSeenAt: orgScoped }
    : { orgId, firstSeenAt: orgScoped };
  const leadWhere = scoped
    ? { orgId, propertyId: { in: propertyIds }, createdAt: orgScoped }
    : { orgId, createdAt: orgScoped };
  const tourWhere = scoped
    ? { propertyId: { in: propertyIds }, createdAt: orgScoped }
    : { property: { orgId }, createdAt: orgScoped };
  const appWhere = scoped
    ? { propertyId: { in: propertyIds }, createdAt: orgScoped }
    : { property: { orgId }, createdAt: orgScoped };

  const [
    visitors,
    leadsBySource,
    tours,
    toursCompleted,
    appsByStatus,
    visitorsByProp,
    leadsByProp,
    toursByProp,
    appsByProp,
    properties,
  ] = await Promise.all([
    prisma.visitor.count({ where: visitorWhere }),
    prisma.lead.groupBy({ by: ["source"], where: leadWhere, _count: { _all: true } }),
    prisma.tour.count({ where: { ...tourWhere, status: { not: TourStatus.CANCELLED } } }),
    prisma.tour.count({ where: { ...tourWhere, status: TourStatus.COMPLETED } }),
    prisma.application.groupBy({ by: ["status"], where: appWhere, _count: { _all: true } }),
    prisma.visitor.groupBy({
      by: ["propertyId"],
      where: { ...visitorWhere, propertyId: scoped ? { in: propertyIds } : { not: null } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: { ...leadWhere, propertyId: scoped ? { in: propertyIds } : { not: null } },
      _count: { _all: true },
    }),
    prisma.tour.groupBy({
      by: ["propertyId"],
      where: { ...tourWhere, status: { not: TourStatus.CANCELLED } },
      _count: { _all: true },
    }),
    prisma.application.groupBy({ by: ["propertyId"], where: appWhere, _count: { _all: true } }),
    prisma.property.findMany({
      where: scoped ? { orgId, id: { in: propertyIds } } : { orgId },
      select: { id: true, name: true },
    }),
  ]);

  const leads = leadsBySource.reduce((s, r) => s + r._count._all, 0);
  const applications = appsByStatus.reduce((s, r) => s + r._count._all, 0);

  const stages: FunnelStage[] = [
    { key: "traffic", label: "Traffic", value: visitors },
    { key: "leads", label: "Leads", value: leads, conversionFromPrev: conversionPct(leads, visitors) },
    { key: "tours", label: "Tours", value: tours, conversionFromPrev: conversionPct(tours, leads) },
    {
      key: "applications",
      label: "Applications",
      value: applications,
      conversionFromPrev: conversionPct(applications, tours),
    },
  ];

  const sources = leadsBySource
    .map((r) => ({ source: r.source, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
  const appStatus = appsByStatus
    .map((r) => ({ status: r.status, count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  // Assemble the per-property table. Only properties with any activity show.
  const nameById = new Map(properties.map((p) => [p.id, p.name]));
  const countBy = (
    rows: Array<{ propertyId: string | null; _count: { _all: number } }>,
  ) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.propertyId) m.set(r.propertyId, r._count._all);
    return m;
  };
  const vMap = countBy(visitorsByProp);
  const lMap = countBy(leadsByProp);
  const tMap = countBy(toursByProp);
  const aMap = countBy(appsByProp);
  const propIds = new Set<string>([
    ...vMap.keys(),
    ...lMap.keys(),
    ...tMap.keys(),
    ...aMap.keys(),
  ]);
  const byProperty = [...propIds]
    .map((id) => ({
      propertyId: id,
      name: nameById.get(id) ?? "Unknown property",
      visitors: vMap.get(id) ?? 0,
      leads: lMap.get(id) ?? 0,
      tours: tMap.get(id) ?? 0,
      applications: aMap.get(id) ?? 0,
    }))
    .sort((a, b) => b.applications - a.applications || b.leads - a.leads);

  return { periodDays, stages, toursCompleted, sources, appStatus, byProperty };
}
