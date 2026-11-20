import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { readTenantHeaders } from "@/lib/tenancy/resolve";
import { marketablePropertyWhere } from "@/lib/properties/marketable";

// Public listings endpoint for tenant marketing sites. Reads
// x-tenant-org-id header set by middleware. No auth; rate limits live at
// the middleware edge. Only returns AVAILABLE listings by default; callers
// can pass ?all=1 to include unavailable.
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
    include: {
      listings: {
        where: all ? {} : { isAvailable: true },
        orderBy: [{ priceCents: "asc" }, { unitType: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ properties });
}
