"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import * as rentCastCache from "@/lib/rentcast/cache";
import { computeCalculations, type CalculationOutputs } from "@/lib/zillow/calculations";
import { normalizeAddress } from "@/lib/rentcast/insights";
import { checkRateLimit } from "@/lib/rate-limit";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { MarketStatsResponse, RentAvmResponse, ValueAvmResponse } from "@/lib/rentcast/client";

// ---------------------------------------------------------------------------
// Building Evaluator server action (Tier S #3 — Acquisitions pipeline).
//
// Single entry point: `evaluateAddress`. Takes an address + optional
// property attrs + asking price; fires three RentCast endpoints in
// parallel (value AVM, rent AVM, market stats), runs the investor math
// from lib/zillow/calculations, and persists a PropertyEvaluation row
// so the operator can come back to the report without re-spending
// credits.
//
// Tenancy: requireScope() — no client-supplied orgId trusted.
// Budget gate: handled inside the cache layer (returns ok:false with
// `OVER_HARD_CAP` when the workspace is past the hard cap). We surface
// that as a typed error so the UI can render the upgrade prompt.
// Rate limit: 5 evaluations / hour / org (in-memory soft fallback). The
// page is deliberate-action so this is generous — a user evaluating 6
// buildings in 60 minutes is unusual and probably benefits from being
// nudged to slow down (preserves quota).
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  address: z.string().trim().min(4, "Address is required").max(240),
  propertyType: z.string().trim().max(40).nullable().optional(),
  bedrooms: z.coerce.number().int().min(0).max(20).nullable().optional(),
  bathrooms: z.coerce.number().min(0).max(20).nullable().optional(),
  squareFootage: z.coerce.number().int().min(1).max(200_000).nullable().optional(),
  askingPrice: z.coerce.number().min(1).max(500_000_000).nullable().optional(),
});

export type EvaluateAddressInput = z.input<typeof inputSchema>;

export type EvaluationResult = {
  evaluationId: string;
  address: string;
  addressDisplay: string;
  askingPriceCents: number | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  value: ValueAvmResponse | null;
  rent: RentAvmResponse | null;
  market: MarketStatsResponse | null;
  calculations: CalculationOutputs;
  freshness: {
    valueFetchedAt: Date | null;
    rentFetchedAt: Date | null;
    marketFetchedAt: Date | null;
  };
  partialFailures: Array<{ source: "value" | "rent" | "market"; reason: string; message: string }>;
};

export type EvaluateActionResult =
  | { ok: true; data: EvaluationResult }
  | {
      ok: false;
      error: string;
      code:
        | "VALIDATION"
        | "RATE_LIMIT"
        | "OVER_HARD_CAP"
        | "MISSING_KEY"
        | "NO_DATA"
        | "UPSTREAM"
        | "INTERNAL";
    };

// Eager-init in module scope so a single lambda warmup pays the cost
// once. Redis is optional; the limiter falls back to in-memory when env
// vars are missing (acceptable for low-stakes operator tools).
const evalRedis = (() => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
})();

const evaluationLimiter = evalRedis
  ? new Ratelimit({
      redis: evalRedis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      analytics: false,
    })
  : null;

// Extract a ZIP from a free-text address. RentCast's /markets endpoint
// is ZIP-keyed, not address-keyed, so we pull the trailing 5-digit token
// (US-only; the evaluator is US-only for now). Returns null when the
// operator typed a non-US format — caller surfaces "market temperature
// unavailable" but the value + rent cards still render.
function extractZip(addr: string): string | null {
  const match = addr.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match?.[1] ?? null;
}

export async function evaluateAddress(input: EvaluateAddressInput): Promise<EvaluateActionResult> {
  const scope = await requireScope();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return {
      ok: false,
      error: first?.message ?? "Invalid input",
      code: "VALIDATION",
    };
  }
  const data = parsed.data;

  // Per-org rate limit. Soft fallback to in-memory when Redis is absent
  // so dev environments don't 100% block.
  const limited = await checkRateLimit(evaluationLimiter, `value-tool:${scope.orgId}`, {
    softFallback: { requests: 5, windowMs: 60 * 60_000 },
  });
  if (!limited.allowed) {
    return {
      ok: false,
      error: "Too many evaluations this hour. Try again in a few minutes — credits are still safe.",
      code: "RATE_LIMIT",
    };
  }

  const addressDisplay = data.address.trim();
  const addressNorm = normalizeAddress(addressDisplay);
  const zip = extractZip(addressDisplay);

  // Fire all three endpoints in parallel via the cache layer. We use
  // allSettled so one upstream blip (e.g. /markets has no data for a
  // rural ZIP) doesn't kill the whole report.
  const [valueRes, rentRes, marketRes] = await Promise.allSettled([
    rentCastCache.getValueAvm({
      orgId: scope.orgId,
      address: addressDisplay,
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      squareFootage: data.squareFootage ?? null,
      propertyType: data.propertyType ?? null,
    }),
    rentCastCache.getRentAvm({
      orgId: scope.orgId,
      address: addressDisplay,
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      propertyType: data.propertyType ?? null,
    }),
    zip
      ? rentCastCache.getMarketStats({ orgId: scope.orgId, zipCode: zip })
      : Promise.resolve<Awaited<ReturnType<typeof rentCastCache.getMarketStats>>>({
          ok: false,
          reason: "NO_DATA",
          message: "ZIP code not detected in the supplied address.",
        }),
  ]);

  // Promote settled outcomes into typed buckets + collect partial failures.
  const partialFailures: EvaluationResult["partialFailures"] = [];
  let value: ValueAvmResponse | null = null;
  let valueFetchedAt: Date | null = null;
  let rent: RentAvmResponse | null = null;
  let rentFetchedAt: Date | null = null;
  let market: MarketStatsResponse | null = null;
  let marketFetchedAt: Date | null = null;

  // Hard-cap check: if EVERY call came back OVER_HARD_CAP we should
  // surface the upsell prompt instead of an empty report. A single
  // call hitting the cap is fine — we degrade gracefully to whatever
  // came back fresh.
  let overCapCount = 0;
  let missingKeyHit = false;

  if (valueRes.status === "fulfilled") {
    const r = valueRes.value;
    if (r.ok) {
      value = r.data;
      valueFetchedAt = r.fetchedAt;
    } else if (r.stale) {
      value = r.stale.data;
      valueFetchedAt = r.stale.fetchedAt;
      partialFailures.push({ source: "value", reason: r.reason, message: r.message });
    } else {
      partialFailures.push({ source: "value", reason: r.reason, message: r.message });
      if (r.reason === "OVER_HARD_CAP") overCapCount += 1;
      if (r.reason === "MISSING_KEY") missingKeyHit = true;
    }
  } else {
    partialFailures.push({ source: "value", reason: "UPSTREAM", message: String(valueRes.reason) });
  }

  if (rentRes.status === "fulfilled") {
    const r = rentRes.value;
    if (r.ok) {
      rent = r.data;
      rentFetchedAt = r.fetchedAt;
    } else if (r.stale) {
      rent = r.stale.data;
      rentFetchedAt = r.stale.fetchedAt;
      partialFailures.push({ source: "rent", reason: r.reason, message: r.message });
    } else {
      partialFailures.push({ source: "rent", reason: r.reason, message: r.message });
      if (r.reason === "OVER_HARD_CAP") overCapCount += 1;
      if (r.reason === "MISSING_KEY") missingKeyHit = true;
    }
  } else {
    partialFailures.push({ source: "rent", reason: "UPSTREAM", message: String(rentRes.reason) });
  }

  if (marketRes.status === "fulfilled") {
    const r = marketRes.value;
    if (r.ok) {
      market = r.data;
      marketFetchedAt = r.fetchedAt;
    } else if (r.stale) {
      market = r.stale.data;
      marketFetchedAt = r.stale.fetchedAt;
      partialFailures.push({ source: "market", reason: r.reason, message: r.message });
    } else {
      partialFailures.push({ source: "market", reason: r.reason, message: r.message });
      if (r.reason === "OVER_HARD_CAP") overCapCount += 1;
      if (r.reason === "MISSING_KEY") missingKeyHit = true;
    }
  } else {
    partialFailures.push({ source: "market", reason: "UPSTREAM", message: String(marketRes.reason) });
  }

  // Hard-error short-circuits — surface the most relevant typed code so
  // the UI can show the right prompt.
  if (missingKeyHit && !value && !rent && !market) {
    return {
      ok: false,
      error: "RentCast isn't configured for this workspace yet. Contact your admin.",
      code: "MISSING_KEY",
    };
  }
  if (overCapCount >= 2 && !value && !rent) {
    return {
      ok: false,
      error: "You're over your RentCast budget for the month. Upgrade or wait for the next billing window.",
      code: "OVER_HARD_CAP",
    };
  }
  if (!value && !rent) {
    return {
      ok: false,
      error: "RentCast returned no data for that address. Double-check the spelling or try a nearby unit.",
      code: "NO_DATA",
    };
  }

  // Investor math: prefer the operator's asking price; else fall back to
  // the value AVM mid-point so the card still has something to show.
  // Skip silently if neither is available (no listPrice → null outputs).
  const askingDollars = data.askingPrice ?? null;
  const listPrice = askingDollars ?? value?.price ?? 0;
  const rentZestimate = rent?.rent ?? null;
  const calculations = computeCalculations({
    listPrice,
    rentZestimate,
  });

  // Persist the evaluation. We store the raw payload bags as JSON so the
  // recent-evaluations list can re-render without spending credits.
  const created = await prisma.propertyEvaluation.create({
    data: {
      orgId: scope.orgId,
      userId: scope.userId,
      address: addressNorm,
      addressDisplay,
      askingPriceCents: askingDollars != null ? Math.round(askingDollars * 100) : null,
      propertyType: data.propertyType ?? null,
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      squareFootageInt: data.squareFootage ?? null,
      valuePayload: (value ?? {}) as object,
      rentPayload: (rent ?? {}) as object,
      marketPayload: (market ?? {}) as object,
      calculations: calculations as unknown as object,
    },
    select: { id: true },
  });

  revalidatePath("/portal/tools/value");

  return {
    ok: true,
    data: {
      evaluationId: created.id,
      address: addressNorm,
      addressDisplay,
      askingPriceCents: askingDollars != null ? Math.round(askingDollars * 100) : null,
      propertyType: data.propertyType ?? null,
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      squareFootage: data.squareFootage ?? null,
      value,
      rent,
      market,
      calculations,
      freshness: { valueFetchedAt, rentFetchedAt, marketFetchedAt },
      partialFailures,
    },
  };
}

// ---------------------------------------------------------------------------
// archiveEvaluation — soft-delete an evaluation off the recent list.
// ---------------------------------------------------------------------------
export async function archiveEvaluation(
  evaluationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const scope = await requireScope();
  const existing = await prisma.propertyEvaluation.findFirst({
    where: { id: evaluationId, orgId: scope.orgId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Evaluation not found" };
  await prisma.propertyEvaluation.update({
    where: { id: existing.id },
    data: { archived: true },
  });
  revalidatePath("/portal/tools/value");
  return { ok: true };
}
