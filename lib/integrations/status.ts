import "server-only";
import { prisma } from "@/lib/db";
import { IntegrationRequestStatus } from "@prisma/client";
import { INTEGRATIONS, type IntegrationDefinition } from "./catalog";

// ---------------------------------------------------------------------------
// Tenant-scoped integration status.
//
// For a given orgId, resolve the current connection state of every
// integration in the catalog. The portal marketplace reads from this to
// render tile badges. Cursive + AppFolio get a real status from their own
// integration tables; everything else reports "connected" only if a recent
// IntegrationRequest has been resolved, otherwise "available" or "pending
// request" depending on whether a request is already in flight.
// ---------------------------------------------------------------------------

export type IntegrationState =
  | "connected"
  | "available"
  | "requested"
  | "managed"
  | "coming_soon";

export type IntegrationStatus = {
  slug: string;
  state: IntegrationState;
  lastEventAt?: Date | null;
  requestId?: string | null;
};

export async function resolveIntegrationStatuses(
  orgId: string
): Promise<IntegrationStatus[]> {
  const [cursive, appfolio, pendingRequests, resolvedRequests] =
    await Promise.all([
      prisma.cursiveIntegration
        .findUnique({
          where: { orgId },
          select: { cursivePixelId: true, lastEventAt: true },
        })
        .catch(() => null),
      prisma.appFolioIntegration
        .findUnique({
          where: { orgId },
          select: {
            instanceSubdomain: true,
            clientIdEncrypted: true,
            apiKeyEncrypted: true,
            lastSyncAt: true,
          },
        })
        .catch(() => null),
      prisma.integrationRequest
        .findMany({
          where: {
            orgId,
            status: {
              in: [
                IntegrationRequestStatus.PENDING,
                IntegrationRequestStatus.IN_PROGRESS,
              ],
            },
          },
          select: { id: true, integrationSlug: true },
        })
        .catch(() => []),
      prisma.integrationRequest
        .findMany({
          where: {
            orgId,
            status: IntegrationRequestStatus.RESOLVED,
          },
          select: { integrationSlug: true, resolvedAt: true },
        })
        .catch(() => []),
    ]);

  const pendingBySlug = new Map<string, string>();
  for (const r of pendingRequests) pendingBySlug.set(r.integrationSlug, r.id);
  const resolvedSlugs = new Set(resolvedRequests.map((r) => r.integrationSlug));

  return INTEGRATIONS.map((i) => resolveOne(i, {
    cursive,
    appfolio,
    pendingBySlug,
    resolvedSlugs,
  }));
}

function resolveOne(
  def: IntegrationDefinition,
  ctx: {
    cursive: { cursivePixelId: string | null; lastEventAt: Date | null } | null;
    appfolio: {
      instanceSubdomain: string | null;
      clientIdEncrypted: string | null;
      apiKeyEncrypted: string | null;
      lastSyncAt: Date | null;
    } | null;
    pendingBySlug: Map<string, string>;
    resolvedSlugs: Set<string>;
  }
): IntegrationStatus {
  if (def.comingSoon) {
    return { slug: def.slug, state: "coming_soon" };
  }

  if (def.slug === "visitor-identification") {
    return {
      slug: def.slug,
      state: ctx.cursive?.cursivePixelId ? "connected" : "managed",
      lastEventAt: ctx.cursive?.lastEventAt ?? null,
    };
  }

  if (def.slug === "appfolio") {
    const connected =
      !!ctx.appfolio?.instanceSubdomain &&
      (!!ctx.appfolio?.clientIdEncrypted || !!ctx.appfolio?.apiKeyEncrypted);
    return {
      slug: def.slug,
      state: connected ? "connected" : "available",
      lastEventAt: ctx.appfolio?.lastSyncAt ?? null,
    };
  }

  // API-key integrations (Zapier, Make, custom webhook) are always reachable
  // once the tenant has an API key. We render them as "available" and the
  // drawer explains how to connect; there's no "connected" state tracked at
  // the catalog level because any number of external systems can be wired.
  if (def.auth === "api_key") {
    return { slug: def.slug, state: "available" };
  }

  // Request-gated integrations flip through available → requested → connected
  // as the agency resolves the request.
  if (ctx.resolvedSlugs.has(def.slug)) {
    return { slug: def.slug, state: "connected" };
  }
  if (ctx.pendingBySlug.has(def.slug)) {
    return {
      slug: def.slug,
      state: "requested",
      requestId: ctx.pendingBySlug.get(def.slug) ?? null,
    };
  }
  return { slug: def.slug, state: "available" };
}

export function stateLabel(state: IntegrationState): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "managed":
      return "Managed by agency";
    case "requested":
      return "Activation requested";
    case "available":
      return "Available";
    case "coming_soon":
      return "Coming soon";
  }
}
