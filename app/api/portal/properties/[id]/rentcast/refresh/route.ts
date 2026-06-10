import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireScope,
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { getMarketStats, getRentAvm } from "@/lib/rentcast/cache";
import { canSpendCredit } from "@/lib/rentcast/budget";
import { checkRateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// POST /api/portal/properties/[id]/rentcast/refresh
//
// Operator-triggered refresh of the property detail Market Intelligence
// section. Forces a fresh fetch from RentCast (bypasses TTL) but still:
//   * gates the call behind tenancy (property orgId must match scope orgId)
//   * gates the call behind the per-property daily limit (1/property/day)
//   * gates the call behind the per-org monthly budget (hard cap 1.5×)
//
// On hard-cap refusal we return 402 with the upgrade copy so the section
// can swap to the upsell card. On per-property rate-limit we return 429.
//
// Two RentCast calls per refresh (rent AVM + market stats) — the budget
// counter advances by 2.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let scope: Awaited<ReturnType<typeof requireScope>>;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Property gate: restricted users must not refresh outside their set.
  if (scope.allowedPropertyIds && !scope.allowedPropertyIds.includes(id)) {
    return NextResponse.json({ error: "Property not accessible" }, { status: 404 });
  }

  const property = await prisma.property.findFirst({
    where: { id, ...tenantWhere(scope) },
    select: {
      id: true,
      addressLine1: true,
      city: true,
      state: true,
      postalCode: true,
      propertyType: true,
      priceMin: true,
    },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  if (!property.addressLine1 || !property.postalCode) {
    return NextResponse.json(
      {
        error:
          "Property is missing an address or zip code — RentCast can't run a refresh until those are set.",
      },
      { status: 400 },
    );
  }

  // Per-property daily rate-limit. Soft-fallback so a missing Upstash deploy
  // doesn't hard-block the feature on the SG launch demo. The 1/day cap
  // shares a key with the property id so two operators on the same property
  // still observe the cap together.
  const rateKey = `rentcast:refresh:property:${id}`;
  // Pass `null` to use the soft in-memory fallback path. We don't have a
  // dedicated Upstash limiter for this endpoint yet — the in-memory bucket
  // is plenty for "1 click per property per day" since collisions across
  // regions only let through a handful of duplicate calls in the worst case.
  const rl = await checkRateLimit(null, rateKey, {
    softFallback: { requests: 1, windowMs: 24 * 60 * 60 * 1000 },
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:
          "Daily refresh limit reached. Market intelligence can be refreshed once per property per day.",
      },
      { status: 429, headers: { "Retry-After": "86400" } },
    );
  }

  // Budget pre-check so we can return 402 before firing the upstream call.
  const budget = await canSpendCredit(scope.orgId);
  if (!budget.allowed) {
    return NextResponse.json(
      {
        error: "OVER_HARD_CAP",
        upgrade: {
          headline: `You've used ${budget.used}/${budget.budget} RentCast Intelligence credits this month.`,
          body: "Upgrade to Foundation for 1,000 calls/month and unlimited refresh.",
          cta: "Upgrade",
          href: "/portal/billing?intent=upgrade",
        },
      },
      { status: 402 },
    );
  }

  const address = formatAddress({
    addressLine1: property.addressLine1,
    city: property.city,
    state: property.state,
    postalCode: property.postalCode,
  });

  const [rentResult, marketResult] = await Promise.all([
    getRentAvm({
      orgId: scope.orgId,
      propertyId: property.id,
      address,
      propertyType: rentcastPropertyType(property.propertyType),
      force: true,
    }),
    getMarketStats({
      orgId: scope.orgId,
      propertyId: property.id,
      zipCode: property.postalCode,
      force: true,
    }),
  ]);

  const after = await canSpendCredit(scope.orgId);

  return NextResponse.json({
    ok: true,
    refreshedAt: new Date().toISOString(),
    rent: rentResult,
    market: marketResult,
    budget: {
      used: after.used,
      budget: after.budget,
      remaining: after.remaining,
      overCap: after.overCap,
    },
  });
}

function formatAddress(p: {
  addressLine1: string;
  city: string | null;
  state: string | null;
  postalCode: string;
}): string {
  const parts = [p.addressLine1, p.city, p.state, p.postalCode].filter(Boolean);
  return parts.join(", ");
}

// RentCast accepts a small set of `propertyType` strings; map our Prisma
// enum onto its taxonomy. Unknown / commercial returns undefined so the
// API picks its own default.
function rentcastPropertyType(t: string | null | undefined): string | undefined {
  if (!t) return undefined;
  switch (t) {
    case "RESIDENTIAL":
      return "Apartment";
    case "COMMERCIAL":
      return undefined;
    default:
      return undefined;
  }
}
