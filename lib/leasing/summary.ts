import "server-only";
import { LeadSource, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentLeaseWhere } from "@/lib/leases/current";

const DAY = 86_400_000;

// Months a lease runs (fractional: an Aug 15 - Jul 31 term is ~11.5);
// falls back to the stored term, else 12.
export function leaseMonths(l: { startDate: Date | null; endDate: Date | null; termMonths: number | null }): number {
  if (l.startDate && l.endDate && l.endDate > l.startDate) {
    return Math.max(1, (l.endDate.getTime() - l.startDate.getTime()) / (30.44 * DAY));
  }
  return l.termMonths && l.termMonths > 0 ? l.termMonths : 12;
}

export type SignedLease = {
  id: string;
  name: string;
  unit: string | null;
  property: string;
  monthlyRentCents: number | null;
  startDate: Date | null;
  endDate: Date | null;
  fromChatbot: boolean;
};

export type LeasingSummary = {
  units: number;
  currentLeases: number;
  occupancyPct: number;
  monthlyRentCents: number;
  leaseValueCents: number;
  endingSoon: number;
  chatbotSigned: number;
  chatbotLeaseValueCents: number;
  recent: SignedLease[];
};

const unitOf = (raw: Prisma.JsonValue): string | null => {
  const u = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>).unit : null;
  return typeof u === "string" && u.trim() ? u.trim() : null;
};

// Leasing outcomes for the overview: occupancy, rent under lease, total
// lease value and who signed. Scoped to ACTIVE properties (or the user's
// allowed ones), same gate as the rest of the overview.
export async function getLeasingSummary(orgId: string, allowedPropertyIds: string[] | null): Promise<LeasingSummary | null> {
  const propertyWhere: Prisma.PropertyWhereInput = allowedPropertyIds
    ? { orgId, id: { in: allowedPropertyIds } }
    : { orgId, lifecycle: "ACTIVE" };
  const now = new Date();
  const where: Prisma.LeaseWhereInput = { orgId, property: propertyWhere, ...currentLeaseWhere(now) };

  const [props, leases] = await Promise.all([
    prisma.property.findMany({ where: propertyWhere, select: { totalUnits: true } }),
    prisma.lease.findMany({
      where,
      orderBy: [{ startDate: { sort: "desc", nulls: "last" } }],
      select: {
        id: true, startDate: true, endDate: true, termMonths: true, monthlyRentCents: true, status: true, raw: true,
        property: { select: { name: true } },
        listing: { select: { unitNumber: true } },
        resident: { select: { firstName: true, lastName: true, lead: { select: { source: true } } } },
      },
    }),
  ]);
  if (!leases.length) return null;

  const units = props.reduce((n, p) => n + (p.totalUnits ?? 0), 0);
  const value = (l: (typeof leases)[number]) => (l.monthlyRentCents ?? 0) * leaseMonths(l);
  const chatbot = leases.filter((l) => l.resident?.lead?.source === LeadSource.CHATBOT);
  const soon = now.getTime() + 60 * DAY;

  return {
    units,
    currentLeases: leases.length,
    occupancyPct: units ? Math.min(100, Math.round((leases.length / units) * 100)) : 0,
    monthlyRentCents: leases.reduce((n, l) => n + (l.monthlyRentCents ?? 0), 0),
    leaseValueCents: leases.reduce((n, l) => n + value(l), 0),
    endingSoon: leases.filter((l) => l.endDate && l.endDate.getTime() <= soon).length,
    chatbotSigned: chatbot.length,
    chatbotLeaseValueCents: chatbot.reduce((n, l) => n + value(l), 0),
    recent: leases.slice(0, 8).map((l) => ({
      id: l.id,
      name: [l.resident?.firstName, l.resident?.lastName].filter(Boolean).join(" ") || "Resident",
      unit: l.listing?.unitNumber ?? unitOf(l.raw),
      property: l.property.name,
      monthlyRentCents: l.monthlyRentCents,
      startDate: l.startDate,
      endDate: l.endDate,
      fromChatbot: l.resident?.lead?.source === LeadSource.CHATBOT,
    })),
  };
}
