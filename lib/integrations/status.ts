import "server-only";
import { prisma } from "@/lib/db";
import { AdPlatform, IntegrationRequestStatus } from "@prisma/client";
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
  | "plan_locked"
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
  const [
    org,
    cursive,
    appfolio,
    seoIntegrations,
    adAccounts,
    pendingRequests,
    resolvedRequests,
  ] = await Promise.all([
    prisma.organization
      .findUnique({
        where: { id: orgId },
        select: {
          modulePixel: true,
          moduleChatbot: true,
          moduleSEO: true,
          moduleGoogleAds: true,
          moduleMetaAds: true,
        },
      })
      .catch(() => null),
    // Integration-status badges are an org-level summary so they look
    // at "any pixel connected anywhere" rather than per-property
    // detail. findFirst with cursivePixelId set surfaces the most
    // recent active pixel — could be the legacy org-wide row OR any
    // per-property row.
    prisma.cursiveIntegration
      .findFirst({
        where: { orgId, cursivePixelId: { not: null } },
        select: { cursivePixelId: true, lastEventAt: true },
        orderBy: { lastEventAt: "desc" },
      })
      .catch(() => null),
    prisma.appFolioIntegration
      .findUnique({
        where: { orgId },
        select: {
          instanceSubdomain: true,
          clientIdEncrypted: true,
          apiKeyEncrypted: true,
          useEmbedFallback: true,
          lastSyncAt: true,
        },
      })
      .catch(() => null),
    prisma.seoIntegration
      .findMany({
        // Demo-seeded SEO rows store the literal string "DEMO_SEED"
        // for the encrypted JSON. Filter them out so the marketplace
        // tile reflects "Available" instead of falsely "Connected".
        where: {
          orgId,
          serviceAccountJsonEncrypted: { not: "DEMO_SEED" },
        },
        select: { provider: true, lastSyncAt: true },
      })
      .catch(() => []),
    prisma.adAccount
      .findMany({
        where: { orgId, credentialsEncrypted: { not: null } },
        select: { platform: true, lastSyncAt: true },
      })
      .catch(() => []),
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

  const seoBySlug = new Map<
    string,
    { lastSyncAt: Date | null }
  >();
  for (const s of seoIntegrations) {
    const slug = s.provider === "GSC" ? "gsc" : "ga4";
    seoBySlug.set(slug, { lastSyncAt: s.lastSyncAt ?? null });
  }

  const adsBySlug = new Map<string, { lastSyncAt: Date | null }>();
  for (const a of adAccounts) {
    const slug = a.platform === AdPlatform.GOOGLE_ADS ? "google-ads" : a.platform === AdPlatform.META ? "meta-ads" : null;
    if (!slug) continue;
    // First account wins for badge purposes; the manage drawer renders all of them.
    if (!adsBySlug.has(slug)) {
      adsBySlug.set(slug, { lastSyncAt: a.lastSyncAt ?? null });
    }
  }

  return INTEGRATIONS.map((i) => resolveOne(i, {
    org,
    cursive,
    appfolio,
    seoBySlug,
    adsBySlug,
    pendingBySlug,
    resolvedSlugs,
  }));
}

function resolveOne(
  def: IntegrationDefinition,
  ctx: {
    org: {
      modulePixel: boolean;
      moduleChatbot: boolean;
      moduleSEO: boolean;
      moduleGoogleAds: boolean;
      moduleMetaAds: boolean;
    } | null;
    cursive: { cursivePixelId: string | null; lastEventAt: Date | null } | null;
    appfolio: {
      instanceSubdomain: string | null;
      clientIdEncrypted: string | null;
      apiKeyEncrypted: string | null;
      useEmbedFallback: boolean;
      lastSyncAt: Date | null;
    } | null;
    seoBySlug: Map<string, { lastSyncAt: Date | null }>;
    adsBySlug: Map<string, { lastSyncAt: Date | null }>;
    pendingBySlug: Map<string, string>;
    resolvedSlugs: Set<string>;
  }
): IntegrationStatus {
  if (def.comingSoon) {
    return { slug: def.slug, state: "coming_soon" };
  }

  if (def.slug === "visitor-identification") {
    // Three-way state, in priority order:
    //   - connected: pixel ID provisioned + present
    //   - plan_locked: org's plan doesn't include the pixel module — show
    //     "Upgrade required" instead of the misleading "Active" badge
    //     (audit BUG #1)
    //   - managed: pixel module on plan, awaiting agency provisioning
    if (ctx.cursive?.cursivePixelId) {
      return {
        slug: def.slug,
        state: "connected",
        lastEventAt: ctx.cursive.lastEventAt ?? null,
      };
    }
    const onPlan = !!ctx.org?.modulePixel || !!ctx.org?.moduleChatbot;
    return {
      slug: def.slug,
      state: onPlan ? "managed" : "plan_locked",
      lastEventAt: ctx.cursive?.lastEventAt ?? null,
    };
  }

  if (def.slug === "appfolio") {
    const connected =
      !!ctx.appfolio?.instanceSubdomain &&
      (!!ctx.appfolio?.clientIdEncrypted || !!ctx.appfolio?.apiKeyEncrypted || !!ctx.appfolio?.useEmbedFallback);
    return {
      slug: def.slug,
      state: connected ? "connected" : "available",
      lastEventAt: ctx.appfolio?.lastSyncAt ?? null,
    };
  }

  if (def.slug === "gsc" || def.slug === "ga4") {
    const seo = ctx.seoBySlug.get(def.slug);
    return {
      slug: def.slug,
      state: seo ? "connected" : "available",
      lastEventAt: seo?.lastSyncAt ?? null,
    };
  }

  if (def.slug === "google-ads" || def.slug === "meta-ads") {
    const ads = ctx.adsBySlug.get(def.slug);
    return {
      slug: def.slug,
      state: ads ? "connected" : "available",
      lastEventAt: ads?.lastSyncAt ?? null,
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
    case "plan_locked":
      return "Plan upgrade required";
    case "coming_soon":
      return "Coming soon";
  }
}
