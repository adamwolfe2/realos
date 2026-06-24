import "server-only";
import { prisma } from "@/lib/db";
import { SeoProvider } from "@prisma/client";
import {
  fetchGa4SessionsBySource,
  fetchGa4SourceLandingPages,
} from "@/lib/integrations/ga4";
import { classifySource } from "@/lib/attribution/source-taxonomy";

async function resolveGa4Integration(orgId: string) {
  const integration = await prisma.seoIntegration.findFirst({
    where: { orgId, provider: SeoProvider.GA4 },
    select: { serviceAccountJsonEncrypted: true, propertyIdentifier: true },
  });
  if (
    !integration?.serviceAccountJsonEncrypted ||
    !integration.propertyIdentifier
  ) {
    return null;
  }
  return integration;
}

// ---------------------------------------------------------------------------
// GA4 source fusion. Pulls sessions-by-source from the org's connected GA4
// property and maps each onto a canonical source id, so the flow diagram can
// fold in traffic the first-party pixel never recorded (no-JS visits, blocked
// trackers, channels that never hit a tracked page).
//
// Deliberately BEST-EFFORT: any failure (no GA4 connection, expired creds, API
// timeout) resolves to null and the caller silently degrades to pixel-only
// data. Attribution must never break because Google is slow.
// ---------------------------------------------------------------------------

/**
 * @returns Map<canonicalSourceId, sessions>, or null when GA4 is unavailable.
 */
export async function fetchGa4SourceVolumes(
  orgId: string,
  fromDate: Date,
  toDate: Date,
): Promise<Map<string, number> | null> {
  try {
    const integration = await resolveGa4Integration(orgId);
    if (!integration) return null;

    const rows = await fetchGa4SessionsBySource(
      integration.serviceAccountJsonEncrypted,
      integration.propertyIdentifier,
      fromDate,
      toDate,
    );

    const byId = new Map<string, number>();
    for (const row of rows) {
      if (row.sessions <= 0) continue;
      // GA4 sessionSource maps to a UTM-style source; sessionMedium drives the
      // paid-vs-organic split (cpc → Ads channel) via the shared taxonomy.
      const src = classifySource(row.source, null, row.medium);
      byId.set(src.id, (byId.get(src.id) ?? 0) + row.sessions);
    }
    return byId.size > 0 ? byId : null;
  } catch (err) {
    // Swallow-and-degrade is the whole point here, but leave a breadcrumb.
    console.error(
      "[attribution] GA4 source fusion failed, falling back to pixel-only:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export type Ga4SourceLanding = {
  sourceId: string; // canonical source id
  landingPath: string; // normalized path
  sessions: number;
};

/**
 * GA4 sessions by canonical source × landing page, for reverse attribution.
 * Best-effort: returns null when GA4 is unavailable.
 */
export async function fetchGa4SourceLandingVolumes(
  orgId: string,
  fromDate: Date,
  toDate: Date,
): Promise<Ga4SourceLanding[] | null> {
  try {
    const integration = await resolveGa4Integration(orgId);
    if (!integration) return null;

    const rows = await fetchGa4SourceLandingPages(
      integration.serviceAccountJsonEncrypted,
      integration.propertyIdentifier,
      fromDate,
      toDate,
    );

    const out: Ga4SourceLanding[] = [];
    for (const row of rows) {
      if (row.sessions <= 0) continue;
      const src = classifySource(row.source, null, row.medium);
      out.push({
        sourceId: src.id,
        landingPath: normalizePath(row.landingPath),
        sessions: row.sessions,
      });
    }
    return out.length > 0 ? out : null;
  } catch (err) {
    console.error(
      "[attribution] GA4 source×landing fusion failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// Strip query string + trailing slash so "/floorplans?x=1" and "/floorplans/"
// collapse to one landing node. Empty / "(not set)" → "/".
function normalizePath(raw: string): string {
  if (!raw || raw === "(not set)") return "/";
  let p = raw.split("?")[0].split("#")[0].trim();
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}
