import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// "Real" AdAccount filter.
//
// AdAccount rows can be created by three paths:
//   1. Demo seeds (scripts/seed-dashboard-data.ts) — credentialsEncrypted=NULL,
//      no OAuthConnection row. NOT real customer data.
//   2. Legacy paste form (connectGoogleAds / connectMetaAds) —
//      credentialsEncrypted IS NOT NULL.
//   3. OAuth picker (bindGoogleAdsCustomer / bindMetaAdsCustomer) —
//      credentialsEncrypted=NULL but a matching OAuthConnection row exists.
//
// The dashboard, exports, and reports must only surface paths #2 and #3 —
// never #1. This helper returns a `where` fragment that callers `...spread`
// alongside their tenant filter.
//
// Implementation: two-query approach. We fetch the org's OAuth-bound external
// IDs first (cheap — at most a few rows per org), then OR them in. Pure SQL
// `EXISTS` would be tighter but Prisma doesn't ergonomically expose
// cross-table existence checks without an `@relation` mapping, which would
// require a schema migration.
// ---------------------------------------------------------------------------

export async function realAdAccountWhere(
  orgId: string,
): Promise<Prisma.AdAccountWhereInput> {
  const bound = await prisma.oAuthConnection.findMany({
    where: {
      orgId,
      provider: { in: ["google_ads", "meta_ads"] },
      status: "active",
      externalAccountId: { not: null },
    },
    select: { provider: true, externalAccountId: true },
  });

  if (bound.length === 0) {
    return { credentialsEncrypted: { not: null } };
  }

  // Group bound IDs by platform so the OR clause is precise — an external
  // account ID under provider=google_ads shouldn't accidentally match a
  // Meta AdAccount row with the same digits.
  const googleIds = bound
    .filter((b) => b.provider === "google_ads")
    .map((b) => b.externalAccountId!)
    .filter(Boolean);
  const metaIds = bound
    .filter((b) => b.provider === "meta_ads")
    .map((b) => b.externalAccountId!)
    .filter(Boolean);

  return {
    OR: [
      { credentialsEncrypted: { not: null } },
      ...(googleIds.length > 0
        ? [{ platform: "GOOGLE_ADS" as const, externalAccountId: { in: googleIds } }]
        : []),
      ...(metaIds.length > 0
        ? [{ platform: "META" as const, externalAccountId: { in: metaIds } }]
        : []),
    ],
  };
}
