import "server-only";
import { prisma } from "@/lib/db";
import { AdPlatform, IntegrationRequestStatus } from "@prisma/client";
import { INTEGRATIONS, type IntegrationDefinition } from "./catalog";
import { FRESHNESS_BUDGET, type IntegrationKey } from "@/lib/sync/freshness";
import { realAdAccountWhere } from "./real-ad-account";

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
  | "stale" // connected, no errors, but last sync is past the staleness budget
  | "error" // connected but last sync failed — honest signal vs lying green
  | "available"
  | "requested"
  | "managed"
  | "plan_locked"
  | "coming_soon";

// Internal helper: given a freshness budget key + lastSyncAt + error flag,
// classify into the three honest states the pill needs:
//   - error  → RED (auth/quota failure, credentials invalid, or sync errored)
//   - stale  → YELLOW (no errors but last sync is older than the budget)
//   - connected → GREEN (fresh + no errors + credentials valid)
//
// Pre-fix the pill flipped to green any time an integration row existed —
// even if the last 10 cron ticks errored or hadn't run in days. Operators
// only learned the integration was broken by opening the page and noticing
// no fresh data. This helper unifies the three signals so every connected
// integration goes through the same RED/YELLOW/GREEN gate.
function classifyHealth(
  key: IntegrationKey,
  lastSyncAt: Date | null,
  hasError: boolean,
): "connected" | "stale" | "error" {
  if (hasError) return "error";
  if (lastSyncAt == null) {
    // No successful sync ever, but no recorded error either. Surfacing
    // this as "stale" is more honest than "connected" — the operator
    // shouldn't trust green when there's literally no data yet.
    return "stale";
  }
  const budget = FRESHNESS_BUDGET[key];
  const ageMs = Date.now() - lastSyncAt.getTime();
  if (ageMs > budget.staleAfterMs) return "stale";
  return "connected";
}

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
    funnel,
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
          // Surface sync error state so the marketplace pill can flip
          // to "error" instead of falsely showing "connected" when
          // every recent cron run has failed.
          syncStatus: true,
          lastError: true,
        },
      })
      .catch(() => null),
    prisma.funnelIntegration
      .findUnique({
        where: { orgId },
        select: {
          enabled: true,
          apiKeyEncrypted: true,
          apiBaseUrl: true,
          groupId: true,
          lastPushAt: true,
          lastError: true,
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
        // Pull status + lastSyncError so the pill can degrade from
        // "connected" to "error" honestly. Pre-fix the marketplace
        // showed green "Connected" any time a row existed, even
        // after 10 failed syncs in a row — operators had no signal
        // that something was wrong until they opened the SEO page.
        select: {
          provider: true,
          lastSyncAt: true,
          status: true,
          lastSyncError: true,
        },
      })
      .catch(() => []),
    realAdAccountWhere(orgId)
      .then((realFilter) =>
        prisma.adAccount.findMany({
          where: { orgId, ...realFilter },
          select: {
            platform: true,
            lastSyncAt: true,
            lastSyncError: true,
          },
        }),
      )
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

  // SEO can have multiple integrations per provider (one GSC/GA4 row
  // per property for multi-property tenants). The pill needs to OR
  // hasError across all of them and report the freshest lastSyncAt
  // — pre-fix the Map.set call overwrote previous rows, so iteration
  // order determined whether the pill showed "Connected" or "Sync
  // error" for a tenant with one healthy + one broken row.
  const seoBySlug = new Map<
    string,
    { lastSyncAt: Date | null; hasError: boolean }
  >();
  for (const s of seoIntegrations) {
    const slug = s.provider === "GSC" ? "gsc" : "ga4";
    const rowHasError = s.status === "ERROR" || !!s.lastSyncError;
    const existing = seoBySlug.get(slug);
    if (!existing) {
      seoBySlug.set(slug, { lastSyncAt: s.lastSyncAt ?? null, hasError: rowHasError });
    } else {
      seoBySlug.set(slug, {
        // Surface the most-recent successful sync across all rows.
        lastSyncAt:
          existing.lastSyncAt && s.lastSyncAt
            ? (existing.lastSyncAt > s.lastSyncAt ? existing.lastSyncAt : s.lastSyncAt)
            : (existing.lastSyncAt ?? s.lastSyncAt ?? null),
        // ANY row erroring flips the pill to "Sync error".
        hasError: existing.hasError || rowHasError,
      });
    }
  }

  const adsBySlug = new Map<
    string,
    { lastSyncAt: Date | null; hasError: boolean }
  >();
  for (const a of adAccounts) {
    const slug = a.platform === AdPlatform.GOOGLE_ADS ? "google-ads" : a.platform === AdPlatform.META ? "meta-ads" : null;
    if (!slug) continue;
    // Same OR-across-accounts logic as SEO above. A tenant with two
    // Google Ads accounts where one is broken must surface the error
    // — silently hiding it behind a green pill on the working account
    // is exactly the "lying status" failure the audit caught.
    const rowHasError = !!a.lastSyncError;
    const existing = adsBySlug.get(slug);
    if (!existing) {
      adsBySlug.set(slug, {
        lastSyncAt: a.lastSyncAt ?? null,
        hasError: rowHasError,
      });
    } else {
      adsBySlug.set(slug, {
        lastSyncAt:
          existing.lastSyncAt && a.lastSyncAt
            ? (existing.lastSyncAt > a.lastSyncAt ? existing.lastSyncAt : a.lastSyncAt)
            : (existing.lastSyncAt ?? a.lastSyncAt ?? null),
        hasError: existing.hasError || rowHasError,
      });
    }
  }

  return INTEGRATIONS.map((i) => resolveOne(i, {
    org,
    cursive,
    appfolio,
    funnel,
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
      syncStatus: string | null;
      lastError: string | null;
    } | null;
    funnel: {
      enabled: boolean;
      apiKeyEncrypted: string | null;
      apiBaseUrl: string | null;
      groupId: number | null;
      lastPushAt: Date | null;
      lastError: string | null;
    } | null;
    seoBySlug: Map<string, { lastSyncAt: Date | null; hasError: boolean }>;
    adsBySlug: Map<string, { lastSyncAt: Date | null; hasError: boolean }>;
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
    if (!connected) return { slug: def.slug, state: "available" };
    // hard failure (no phases completed): rose "Sync error"
    // partial success (some phases failed): handled via the layout
    //   banner — pill stays green so operators see what actually works
    //   and the drawer banner tells them which phase is broken
    const hasError =
      ctx.appfolio?.syncStatus === "error" || !!ctx.appfolio?.lastError;
    return {
      slug: def.slug,
      state: hasError ? "error" : "connected",
      lastEventAt: ctx.appfolio?.lastSyncAt ?? null,
    };
  }

  if (def.slug === "funnel") {
    // Fully-configured-but-disconnected until the operator enables it with a
    // key + base URL + group id. "connected" here means "enabled and wired",
    // "error" surfaces the last failed push, otherwise "available".
    const f = ctx.funnel;
    const wired =
      !!f?.enabled &&
      !!f?.apiKeyEncrypted &&
      !!f?.apiBaseUrl &&
      f?.groupId != null;
    if (!wired) return { slug: def.slug, state: "available" };
    return {
      slug: def.slug,
      state: f?.lastError ? "error" : "connected",
      lastEventAt: f?.lastPushAt ?? null,
    };
  }

  if (def.slug === "gsc" || def.slug === "ga4") {
    const seo = ctx.seoBySlug.get(def.slug);
    if (!seo) return { slug: def.slug, state: "available" };
    // Honest 3-way classifier (audit BUG: "lying pill"):
    //   GREEN   = last sync ≤ stale budget AND no errors
    //   YELLOW  = stale but no errors
    //   RED     = ANY recent error / invalid creds / disconnected
    // Same logic applied to BOTH GA4 and GSC.
    return {
      slug: def.slug,
      state: classifyHealth(
        def.slug === "gsc" ? "gsc" : "ga4",
        seo.lastSyncAt,
        seo.hasError,
      ),
      lastEventAt: seo.lastSyncAt,
    };
  }

  if (def.slug === "google-ads" || def.slug === "meta-ads") {
    const ads = ctx.adsBySlug.get(def.slug);
    if (!ads) return { slug: def.slug, state: "available" };
    return {
      slug: def.slug,
      state: ads.hasError ? "error" : "connected",
      lastEventAt: ads.lastSyncAt,
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
    case "stale":
      return "Stale";
    case "error":
      return "Sync error";
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
