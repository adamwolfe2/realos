import "server-only";
import { prisma } from "@/lib/db";
import * as client from "./client";
import { canSpendCredit, recordCredit } from "./budget";
import {
  marketStatsCacheKey,
  rentAvmCacheKey,
} from "./insights";
import {
  RentCastError,
  type MarketStatsResponse,
  type RentAvmResponse,
} from "./client";

// ---------------------------------------------------------------------------
// RentCast cache — get-or-fetch entry points for the two endpoints used by
// the Property Detail Market Intelligence surface.
//
// Each endpoint has its own TTL (see plan doc):
//   * rent AVM     → 30 days
//   * market stats → 14 days
//
// Cache hit:    return the existing snapshot's payload (no fetch, no credit)
// Cache miss:   consult the per-org budget gate → fetch → persist → return
// Force=true:   bypass the cache lookup but STILL respect the budget gate
//
// `mode: "live"` vs `"cache-only"` lets the caller display a different UI
// when budget is exhausted: instead of a hard error, we return the most
// recent (possibly expired) snapshot so the operator can still see the
// last-known numbers + an upsell prompt.
// ---------------------------------------------------------------------------

const RENT_AVM_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
const MARKET_STATS_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14d

export type CacheOutcome<T> =
  | {
      ok: true;
      mode: "fresh" | "cached" | "stale";
      data: T;
      fetchedAt: Date;
      expiresAt: Date;
      snapshotId: string;
    }
  | {
      ok: false;
      reason:
        | "MISSING_KEY"
        | "OVER_HARD_CAP"
        | "NO_DATA"
        | "AUTH"
        | "QUOTA"
        | "RATE_LIMIT"
        | "TIMEOUT"
        | "UPSTREAM";
      message: string;
      // When we fall back to an expired snapshot due to hard cap, include
      // it so the UI can render stale data + upsell side-by-side.
      stale?: {
        data: T;
        fetchedAt: Date;
        expiresAt: Date;
      };
    };

// ---------------------------------------------------------------------------
// Rent AVM
// ---------------------------------------------------------------------------

export type GetRentAvmCacheInput = {
  orgId: string;
  propertyId?: string | null;
  address: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  propertyType?: string | null;
  force?: boolean;
};

export async function getRentAvm(
  input: GetRentAvmCacheInput,
): Promise<CacheOutcome<RentAvmResponse>> {
  const cacheKey = rentAvmCacheKey({
    address: input.address,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    propertyType: input.propertyType,
  });

  return runCached<RentAvmResponse>({
    orgId: input.orgId,
    propertyId: input.propertyId ?? null,
    endpoint: "RENT_LONG_TERM",
    cacheKey,
    ttlMs: RENT_AVM_TTL_MS,
    force: input.force ?? false,
    fetcher: () =>
      client.getRentAvm({
        address: input.address,
        propertyType: input.propertyType ?? undefined,
        bedrooms: input.bedrooms ?? undefined,
        bathrooms: input.bathrooms ?? undefined,
      }),
  });
}

// ---------------------------------------------------------------------------
// Market stats
// ---------------------------------------------------------------------------

export type GetMarketStatsCacheInput = {
  orgId: string;
  propertyId?: string | null;
  zipCode: string;
  historyRange?: number;
  force?: boolean;
};

export async function getMarketStats(
  input: GetMarketStatsCacheInput,
): Promise<CacheOutcome<MarketStatsResponse>> {
  const cacheKey = marketStatsCacheKey({
    zipCode: input.zipCode,
    historyRange: input.historyRange,
  });

  return runCached<MarketStatsResponse>({
    orgId: input.orgId,
    propertyId: input.propertyId ?? null,
    endpoint: "MARKET_STATS",
    cacheKey,
    ttlMs: MARKET_STATS_TTL_MS,
    force: input.force ?? false,
    fetcher: () =>
      client.getMarketStats({
        zipCode: input.zipCode,
        historyRange: input.historyRange,
      }),
  });
}

// ---------------------------------------------------------------------------
// Internal runner. Centralizes the cache lookup → budget gate → fetch →
// persist pipeline so each endpoint stays a thin wrapper.
// ---------------------------------------------------------------------------

type RunCachedInput<T> = {
  orgId: string;
  propertyId: string | null;
  endpoint: string;
  cacheKey: string;
  ttlMs: number;
  force: boolean;
  fetcher: () => Promise<T>;
};

async function runCached<T>(args: RunCachedInput<T>): Promise<CacheOutcome<T>> {
  const now = new Date();

  const existing = await prisma.rentCastSnapshot.findUnique({
    where: { orgId_cacheKey: { orgId: args.orgId, cacheKey: args.cacheKey } },
  });

  // Fresh cache hit — return as-is, no credit spent.
  if (existing && !args.force && existing.expiresAt > now) {
    return {
      ok: true,
      mode: "cached",
      data: existing.payload as unknown as T,
      fetchedAt: existing.fetchedAt,
      expiresAt: existing.expiresAt,
      snapshotId: existing.id,
    };
  }

  // Budget gate — refuse to fetch when over hard cap, but if we have an
  // existing snapshot return it as `stale` so the UI degrades gracefully.
  const budget = await canSpendCredit(args.orgId);
  if (!budget.allowed) {
    if (existing) {
      return {
        ok: false,
        reason: "OVER_HARD_CAP",
        message: `Over RentCast credit hard cap (${budget.used}/${budget.budget}). Showing last cached value.`,
        stale: {
          data: existing.payload as unknown as T,
          fetchedAt: existing.fetchedAt,
          expiresAt: existing.expiresAt,
        },
      };
    }
    return {
      ok: false,
      reason: "OVER_HARD_CAP",
      message: `Over RentCast credit hard cap (${budget.used}/${budget.budget}). Upgrade to refresh market intelligence.`,
    };
  }

  // Cache miss / expired / forced refresh — fetch from RentCast.
  let fresh: T;
  try {
    fresh = await args.fetcher();
  } catch (err) {
    const reason = err instanceof RentCastError ? err.code : "UPSTREAM";
    const message = err instanceof Error ? err.message : String(err);

    // On failure, surface the typed reason + fall back to the stored
    // snapshot if we have one (even if expired) so the page still has
    // SOMETHING to render.
    const fallback = existing
      ? {
          data: existing.payload as unknown as T,
          fetchedAt: existing.fetchedAt,
          expiresAt: existing.expiresAt,
        }
      : undefined;

    const mapped =
      reason === "MISSING_KEY"
        ? "MISSING_KEY"
        : reason === "AUTH"
          ? "AUTH"
          : reason === "QUOTA"
            ? "QUOTA"
            : reason === "RATE_LIMIT"
              ? "RATE_LIMIT"
              : reason === "TIMEOUT"
                ? "TIMEOUT"
                : reason === "NOT_FOUND"
                  ? "NO_DATA"
                  : "UPSTREAM";

    return {
      ok: false,
      reason: mapped,
      message,
      stale: fallback,
    };
  }

  const expiresAt = new Date(now.getTime() + args.ttlMs);
  const saved = await prisma.rentCastSnapshot.upsert({
    where: { orgId_cacheKey: { orgId: args.orgId, cacheKey: args.cacheKey } },
    create: {
      orgId: args.orgId,
      propertyId: args.propertyId,
      endpoint: args.endpoint,
      cacheKey: args.cacheKey,
      payload: fresh as unknown as object,
      fetchedAt: now,
      expiresAt,
      requestCost: 1,
    },
    update: {
      propertyId: args.propertyId,
      endpoint: args.endpoint,
      payload: fresh as unknown as object,
      fetchedAt: now,
      expiresAt,
      requestCost: 1,
    },
  });

  await recordCredit(args.orgId, 1);

  return {
    ok: true,
    mode: "fresh",
    data: fresh,
    fetchedAt: saved.fetchedAt,
    expiresAt: saved.expiresAt,
    snapshotId: saved.id,
  };
}
