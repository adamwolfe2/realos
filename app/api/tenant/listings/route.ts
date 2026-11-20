import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readTenantHeaders } from "@/lib/tenancy/resolve";
import { marketablePropertyWhere } from "@/lib/properties/marketable";

// Public listings endpoint for tenant marketing sites. Reads
// x-tenant-org-id header set by middleware. No auth; rate limits live at
// the middleware edge. Only returns AVAILABLE listings by default; callers
// can pass ?all=1 to include unavailable.
const PUBLIC_LISTING_SELECT = {
  id: true,
  unitType: true,
  unitNumber: true,
  bedrooms: true,
  bathrooms: true,
  squareFeet: true,
  priceCents: true,
  amenityFeeCents: true,
  leaseTermMonths: true,
  isAvailable: true,
  availableFrom: true,
  availableTo: true,
  photoUrls: true,
  description: true,
} satisfies Prisma.ListingSelect;

function publicPropertySelect(all: boolean) {
  return {
    id: true,
    name: true,
    slug: true,
    addressLine1: true,
    city: true,
    state: true,
    postalCode: true,
    heroImageUrl: true,
    priceMin: true,
    priceMax: true,
    listings: {
      where: all ? {} : { isAvailable: true },
      orderBy: [{ priceCents: "asc" as const }, { unitType: "asc" as const }],
      select: PUBLIC_LISTING_SELECT,
    },
  } satisfies Prisma.PropertySelect;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "1";

  const { orgId } = readTenantHeaders(await headers());
  if (!orgId) {
    return NextResponse.json({ error: "Tenant not resolved" }, { status: 404 });
  }

  const properties = await prisma.property.findMany({
    // Enabled (ACTIVE) properties only. `{ orgId }` also returned every
    // EXCLUDED / IMPORTED address-only row an AppFolio sync created, so a
    // multi-property org's public site listed buildings it never enabled.
    where: marketablePropertyWhere(orgId),
    // Explicit public field list. `include` returned every Property column
    // and each Listing's raw AppFolio payload to anonymous callers. No
    // in-repo caller exists (SECURITY_AUDIT API-24 calls it dead), so this
    // keeps what a marketing site renders: identity, address, photo,
    // price band, and unit availability.
    select: publicPropertySelect(all),
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ properties });
}
