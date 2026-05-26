import "server-only";

import { prisma } from "@/lib/db";
import {
  MarketplaceLeadPropertyType,
  MarketplaceLeadStatus,
  type Prisma,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Marketplace browse + detail queries
//
// The public browse API and the marketplace UI both hit this module. It
// hides PII by default and returns a `BrowseLead` shape that's safe to
// render without authentication.
//
// Two surfaces:
//   - listBrowseLeads(filters)        → paginated, masked, browse-ready
//   - getBrowseLead(id)               → single lead, masked
//   - getPurchasedLead(id, buyerId)   → un-masked PII, gated on purchase
//
// A future Stripe-checkout flow will swap the third one in. For phase 1
// the buyer-side flow isn't wired yet so getPurchasedLead is a stub.
// ---------------------------------------------------------------------------

export type BrowseLeadFilters = {
  market?: string;                       // "All markets" or canonical name
  propertyType?: MarketplaceLeadPropertyType | "ALL";
  minIntent?: number;                    // 0..100, defaults to 70
  minPriceCents?: number;
  maxPriceCents?: number;
  // Pagination
  page?: number;
  pageSize?: number;
};

export type BrowseLead = {
  id: string;
  // Masked PII — initials + first-name-last-initial, never full identifiers
  // until purchase. Photo is a deterministic avatar (not the real headshot
  // for now — see lib/marketplace/cursive-sync.ts photoFor).
  initials: string;
  displayName: string;       // "Marisol R."
  age: number | null;
  photoUrl: string | null;
  market: string;
  propertyType: MarketplaceLeadPropertyType;
  intentScore: number;
  budgetLabel: string | null;
  signal: string | null;
  timeline: string | null;
  priceCents: number;
};

export type BrowseLeadsResult = {
  leads: BrowseLead[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

const DEFAULT_PAGE_SIZE = 24;

export async function listBrowseLeads(
  filters: BrowseLeadFilters = {},
): Promise<BrowseLeadsResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const minIntent = Math.max(0, Math.min(100, filters.minIntent ?? 70));

  const where: Prisma.MarketplaceLeadWhereInput = {
    status: MarketplaceLeadStatus.AVAILABLE,
    intentScore: { gte: minIntent },
  };

  if (filters.market && filters.market !== "All markets") {
    where.market = filters.market;
  }
  if (filters.propertyType && filters.propertyType !== "ALL") {
    where.propertyType = filters.propertyType;
  }
  if (filters.minPriceCents != null || filters.maxPriceCents != null) {
    where.priceCents = {};
    if (filters.minPriceCents != null) {
      (where.priceCents as Prisma.IntFilter).gte = filters.minPriceCents;
    }
    if (filters.maxPriceCents != null) {
      (where.priceCents as Prisma.IntFilter).lte = filters.maxPriceCents;
    }
  }

  const [rows, total] = await Promise.all([
    prisma.marketplaceLead.findMany({
      where,
      orderBy: [{ intentScore: "desc" }, { lastEnrichedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        age: true,
        photoUrl: true,
        market: true,
        propertyType: true,
        intentScore: true,
        budgetLabel: true,
        signal: true,
        timeline: true,
        priceCents: true,
      },
    }),
    prisma.marketplaceLead.count({ where }),
  ]);

  const leads: BrowseLead[] = rows.map(toBrowseLead);
  return {
    leads,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

export async function getBrowseLead(id: string): Promise<BrowseLead | null> {
  const row = await prisma.marketplaceLead.findFirst({
    where: { id, status: MarketplaceLeadStatus.AVAILABLE },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      age: true,
      photoUrl: true,
      market: true,
      propertyType: true,
      intentScore: true,
      budgetLabel: true,
      signal: true,
      timeline: true,
      priceCents: true,
    },
  });
  return row ? toBrowseLead(row) : null;
}

// ---------------------------------------------------------------------------
// Full-PII detail — only ever returned for leads the buyer has actually
// purchased. The caller is responsible for verifying purchase ownership
// before calling this (e.g. via getBuyerPurchaseForLead).
export type FullLead = BrowseLead & {
  fullName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  intentPayload: unknown;

  // Extended enrichment fields
  gender: string | null;
  companyName: string | null;
  companyState: string | null;
  businessEmail: string | null;
  mobilePhone: string | null;
  linkedinUrl: string | null;
  incomeRange: string | null;
};

export async function getFullLead(id: string): Promise<FullLead | null> {
  const row = await prisma.marketplaceLead.findUnique({
    where: { id },
  });
  if (!row) return null;
  const browse = toBrowseLead(row);
  const fullName = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  return {
    ...browse,
    fullName: fullName || "Unknown",
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    budgetMinCents: row.budgetMinCents,
    budgetMaxCents: row.budgetMaxCents,
    intentPayload: row.intentPayload,
    gender: row.gender,
    companyName: row.companyName,
    companyState: row.companyState,
    businessEmail: row.businessEmail,
    mobilePhone: row.mobilePhone,
    linkedinUrl: row.linkedinUrl,
    incomeRange: row.incomeRange,
  };
}

// Did the given buyer already purchase this lead? Used to gate PII reveal
// and to short-circuit the checkout endpoint.
export async function getBuyerPurchaseForLead(
  buyerId: string,
  leadId: string,
) {
  return prisma.marketplacePurchase.findFirst({
    where: {
      buyerId,
      leadId,
      status: "PAID",
    },
  });
}

// ---------------------------------------------------------------------------
// Distinct market list — populates the filter sidebar dropdown. Capped to
// the markets that currently have at least one AVAILABLE lead.
export async function listMarketplaceMarkets(): Promise<string[]> {
  const rows = await prisma.marketplaceLead.groupBy({
    by: ["market"],
    where: { status: MarketplaceLeadStatus.AVAILABLE },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: 25,
  });
  return rows.map((r) => r.market);
}

// ---------------------------------------------------------------------------
// Helpers

function toBrowseLead(row: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  photoUrl: string | null;
  market: string;
  propertyType: MarketplaceLeadPropertyType;
  intentScore: number;
  budgetLabel: string | null;
  signal: string | null;
  timeline: string | null;
  priceCents: number;
}): BrowseLead {
  const initials = buildInitials(row.firstName, row.lastName);
  const displayName = buildDisplayName(row.firstName, row.lastName);
  return {
    id: row.id,
    initials,
    displayName,
    age: row.age,
    photoUrl: row.photoUrl,
    market: row.market,
    propertyType: row.propertyType,
    intentScore: row.intentScore,
    budgetLabel: row.budgetLabel,
    signal: row.signal,
    timeline: row.timeline,
    priceCents: row.priceCents,
  };
}

function buildInitials(firstName: string | null, lastName: string | null): string {
  const a = (firstName ?? "").trim().charAt(0).toUpperCase();
  const b = (lastName ?? "").trim().charAt(0).toUpperCase();
  if (a && b) return a + b;
  if (a) return a;
  return "??";
}

function buildDisplayName(firstName: string | null, lastName: string | null): string {
  const first = (firstName ?? "").trim();
  const lastInitial = (lastName ?? "").trim().charAt(0).toUpperCase();
  if (first && lastInitial) return `${first} ${lastInitial}.`;
  if (first) return first;
  return "Anonymous lead";
}
