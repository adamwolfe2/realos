import "server-only";

import { prisma } from "@/lib/db";
import {
  MarketplaceLeadPropertyType,
  MarketplaceLeadStatus,
  MarketplaceSyncRunStatus,
  type MarketplaceSyncSource,
} from "@prisma/client";
import { streamAlSegmentMembers, type AlMember } from "@/lib/integrations/al-segments";
import { scoreLead, type RawIntentPayload } from "@/lib/marketplace/scoring";

// ---------------------------------------------------------------------------
// Marketplace replenishment — Cursive segment → MarketplaceLead pool
//
// One function: runSourceReplenish(source). Called by:
//   - /api/cron/marketplace-replenish (weekly Vercel cron)
//   - /api/admin/marketplace/sync-now (manual trigger for testing)
//
// Idempotency:
//   - We upsert by (sourceId, cursiveProfileId). Re-runs of the same
//     segment refresh the existing rows (lastEnrichedAt + new payload).
//   - Leads in the source that no longer appear in the latest pull are
//     left alone — they age out via the expiresAt cron pass.
//
// Score gating:
//   - Members below source.minScoreFloor are upserted with status=EXPIRED
//     so they never appear in browse. (We still write them so we have
//     a complete audit trail of what Cursive returned.)
//
// Failure handling:
//   - Individual member failures increment failedCount but don't fail
//     the whole run.
//   - A top-level exception flips the run to FAILED and bubbles up so
//     the cron logs it.
// ---------------------------------------------------------------------------

// Staleness window: leads expire 14 days after lastEnrichedAt unless the
// weekly cron refreshes them. Tunable per-source later if needed.
const STALENESS_MS = 14 * 24 * 60 * 60 * 1000;

export type ReplenishSummary = {
  runId: string;
  status: MarketplaceSyncRunStatus;
  fetchedCount: number;
  enrichedCount: number;
  upsertedCount: number;
  newCount: number;
  refreshedCount: number;
  expiredCount: number;
  failedCount: number;
  errorMessage?: string;
};

export async function runSourceReplenish(
  source: MarketplaceSyncSource,
): Promise<ReplenishSummary> {
  const run = await prisma.marketplaceSyncRun.create({
    data: {
      sourceId: source.id,
      status: MarketplaceSyncRunStatus.RUNNING,
    },
  });

  let fetchedCount = 0;
  let enrichedCount = 0;
  let upsertedCount = 0;
  let newCount = 0;
  let refreshedCount = 0;
  let expiredCount = 0;
  let failedCount = 0;

  try {
    if (!source.externalId) {
      throw new Error("source.externalId is null — set the Cursive segment id");
    }

    // Pull every member from the Cursive segment.
    const result = await streamAlSegmentMembers(source.externalId, {
      apiKey: source.cursiveApiKeyEnc ?? undefined,
      surface: source.kind === "CURSIVE_AUDIENCE" ? "audiences" : "segments",
      maxMembers: 10_000,
    });
    if (!result.ok) {
      throw new Error(`Cursive fetch failed: ${result.message}`);
    }
    const members = result.data;
    fetchedCount = members.length;

    // Process each member: enrich → score → upsert.
    for (const member of members) {
      try {
        const payload = toIntentPayload(member);
        const rawOutcome = scoreLead(payload);

        // Identity-only segments (verified email + phone but no behavioural
        // signals) get a baseline floor so they still surface. The source
        // operator sets this — high-quality vetted segments get a higher
        // baseline (e.g. 70 for a "high-intent buyers" audience).
        const intentScore = Math.max(rawOutcome.intentScore, source.baselineScore);
        const outcome = { ...rawOutcome, intentScore };
        enrichedCount += 1;

        const profileId = pickProfileId(member);
        if (!profileId) {
          failedCount += 1;
          continue;
        }

        const market = resolveMarket(payload, source);
        const tieredPriceCents = tierPrice(source.defaultPriceCents, intentScore);
        const passesFloor = intentScore >= source.minScoreFloor;
        const expiresAt = new Date(Date.now() + STALENESS_MS);

        const existing = await prisma.marketplaceLead.findUnique({
          where: {
            sourceId_cursiveProfileId: {
              sourceId: source.id,
              cursiveProfileId: profileId,
            },
          },
          select: { id: true, status: true },
        });

        await prisma.marketplaceLead.upsert({
          where: {
            sourceId_cursiveProfileId: {
              sourceId: source.id,
              cursiveProfileId: profileId,
            },
          },
          create: {
            sourceId: source.id,
            cursiveProfileId: profileId,
            firstName: payload.firstName ?? null,
            lastName: payload.lastName ?? null,
            email: payload.email ?? null,
            phone: payload.phone ?? null,
            age: payload.age ?? null,
            photoUrl: photoFor(profileId),
            city: payload.city ?? null,
            state: payload.state ?? null,
            postalCode: payload.postalCode ?? null,
            market,
            propertyType: source.defaultPropertyType,
            intentScore: outcome.intentScore,
            budgetLabel: outcome.budgetLabel,
            budgetMinCents: payload.budgetMinCents ?? null,
            budgetMaxCents: payload.budgetMaxCents ?? null,
            signal: outcome.signal,
            timeline: outcome.timeline,
            intentPayload: payload as object,
            priceCents: tieredPriceCents,
            status: passesFloor
              ? MarketplaceLeadStatus.AVAILABLE
              : MarketplaceLeadStatus.EXPIRED,
            expiresAt,
          },
          update: {
            // Refresh enrichment. Do NOT overwrite status if the lead is
            // RESERVED or SOLD — we never want a replenish run to put a
            // sold lead back on the market.
            firstName: payload.firstName ?? null,
            lastName: payload.lastName ?? null,
            email: payload.email ?? null,
            phone: payload.phone ?? null,
            age: payload.age ?? null,
            city: payload.city ?? null,
            state: payload.state ?? null,
            postalCode: payload.postalCode ?? null,
            market,
            intentScore: outcome.intentScore,
            budgetLabel: outcome.budgetLabel,
            budgetMinCents: payload.budgetMinCents ?? null,
            budgetMaxCents: payload.budgetMaxCents ?? null,
            signal: outcome.signal,
            timeline: outcome.timeline,
            intentPayload: payload as object,
            priceCents: tieredPriceCents,
            lastEnrichedAt: new Date(),
            expiresAt,
            // Status transitions safe to apply on refresh:
            //   AVAILABLE / EXPIRED  → re-evaluate against floor
            //   RESERVED / SOLD       → leave alone (no key in update)
            ...(existing?.status === MarketplaceLeadStatus.AVAILABLE ||
            existing?.status === MarketplaceLeadStatus.EXPIRED
              ? {
                  status: passesFloor
                    ? MarketplaceLeadStatus.AVAILABLE
                    : MarketplaceLeadStatus.EXPIRED,
                }
              : {}),
          },
        });

        upsertedCount += 1;
        if (existing) {
          refreshedCount += 1;
        } else {
          newCount += 1;
        }
      } catch (err) {
        console.error("marketplace replenish — member failed", err);
        failedCount += 1;
      }
    }

    // Reap leads that have aged past expiresAt. Only flip AVAILABLE rows;
    // RESERVED / SOLD are untouched.
    const reaped = await prisma.marketplaceLead.updateMany({
      where: {
        sourceId: source.id,
        status: MarketplaceLeadStatus.AVAILABLE,
        expiresAt: { lte: new Date() },
      },
      data: { status: MarketplaceLeadStatus.EXPIRED },
    });
    expiredCount = reaped.count;

    // Finalize the run.
    await prisma.marketplaceSyncRun.update({
      where: { id: run.id },
      data: {
        status: MarketplaceSyncRunStatus.SUCCESS,
        finishedAt: new Date(),
        fetchedCount,
        enrichedCount,
        upsertedCount,
        newCount,
        refreshedCount,
        expiredCount,
        failedCount,
      },
    });
    await prisma.marketplaceSyncSource.update({
      where: { id: source.id },
      data: {
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        lastIngestedCount: fetchedCount,
        lastEnrichedCount: enrichedCount,
        lastExpiredCount: expiredCount,
      },
    });

    return {
      runId: run.id,
      status: MarketplaceSyncRunStatus.SUCCESS,
      fetchedCount,
      enrichedCount,
      upsertedCount,
      newCount,
      refreshedCount,
      expiredCount,
      failedCount,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.marketplaceSyncRun.update({
      where: { id: run.id },
      data: {
        status: MarketplaceSyncRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage,
        fetchedCount,
        enrichedCount,
        upsertedCount,
        newCount,
        refreshedCount,
        expiredCount,
        failedCount,
      },
    });
    await prisma.marketplaceSyncSource.update({
      where: { id: source.id },
      data: { lastRunAt: new Date() },
    });
    return {
      runId: run.id,
      status: MarketplaceSyncRunStatus.FAILED,
      fetchedCount,
      enrichedCount,
      upsertedCount,
      newCount,
      refreshedCount,
      expiredCount,
      failedCount,
      errorMessage,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers

// Coerce a Cursive segment-member payload into the RawIntentPayload our
// scorer understands. We're tolerant to missing fields — the scorer is
// designed to degrade gracefully.
function toIntentPayload(m: AlMember): RawIntentPayload {
  const raw = m.raw ?? {};
  return {
    profileId:
      m.profileId ??
      m.uid ??
      m.cookieId ??
      m.hemSha256 ??
      String(raw.PROFILE_ID ?? raw.UID ?? ""),
    email: m.email,
    phone: m.phone,
    firstName: m.firstName,
    lastName: m.lastName,
    age: numberOrUndef(raw.AGE),
    city: m.city,
    state: m.state,
    postalCode: m.postalCode,

    segments: stringArrayOrUndef(raw.SEGMENTS) ?? stringArrayOrUndef(raw.SEGMENT_NAMES),
    listingsViewed7d: numberOrUndef(raw.LISTINGS_VIEWED_7D),
    lastSeenAt: stringOrUndef(raw.LAST_SEEN_AT) ?? stringOrUndef(raw.LAST_SEEN),
    searchRadius: stringOrUndef(raw.SEARCH_RADIUS),

    hasMortgagePreApp: boolOrUndef(raw.HAS_MORTGAGE_PREAPP),
    hasScheduledTour: boolOrUndef(raw.HAS_SCHEDULED_TOUR),
    hasCashBuyerSignal: boolOrUndef(raw.HAS_CASH_BUYER_SIGNAL),
    isRelocating: boolOrUndef(raw.IS_RELOCATING),
    isDistressed: boolOrUndef(raw.IS_DISTRESSED),
    isLeaseEndingSoon: boolOrUndef(raw.IS_LEASE_ENDING_SOON),
    toursScheduled: numberOrUndef(raw.TOURS_SCHEDULED),

    budgetMinCents: numberOrUndef(raw.BUDGET_MIN_CENTS),
    budgetMaxCents: numberOrUndef(raw.BUDGET_MAX_CENTS),
    budgetUnit:
      stringOrUndef(raw.BUDGET_UNIT) === "MONTHLY" ? "MONTHLY" : "ABS",

    emailVerified: boolOrUndef(raw.EMAIL_VERIFIED) ?? Boolean(m.email),
    phoneVerified: boolOrUndef(raw.PHONE_VERIFIED) ?? Boolean(m.phone),
    addressVerified: boolOrUndef(raw.ADDRESS_VERIFIED) ?? Boolean(m.postalCode),
  };
}

function pickProfileId(m: AlMember): string | null {
  return (
    m.profileId ?? m.uid ?? m.cookieId ?? m.hemSha256 ?? null
  );
}

// Deterministic avatar URL from the profile id so the marketplace shows a
// face on every card without making real PII visible. Swap to a real
// headshot-from-identity provider later if we want.
function photoFor(profileId: string): string {
  // randomuser.me has stable URLs for /portraits/{men|women}/{0..99}.jpg.
  // We hash the profileId into the [0..99] range and split gender on
  // even/odd. Deterministic + diverse.
  let h = 5381;
  for (let i = 0; i < profileId.length; i++) {
    h = (h * 33) ^ profileId.charCodeAt(i);
  }
  const n = Math.abs(h) % 100;
  const gender = n % 2 === 0 ? "men" : "women";
  return `https://randomuser.me/api/portraits/${gender}/${n}.jpg`;
}

function numberOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function stringOrUndef(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function boolOrUndef(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v.toLowerCase() === "true") return true;
    if (v.toLowerCase() === "false") return false;
  }
  return undefined;
}

function stringArrayOrUndef(v: unknown): string[] | undefined {
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
    return v as string[];
  }
  return undefined;
}

// Suppress unused-import warning — the type is part of the contract above.
export type { MarketplaceLeadPropertyType };

// ---------------------------------------------------------------------------
// Market resolution
//
// Pick the most specific market label we have. Cursive identity payloads
// usually carry city + state + postal code. We prefer the city when it's
// non-trivial; fall back to the state abbreviation expanded to a full name;
// then to the source default; finally to "Unspecified".
//
// This makes the marketplace filter sidebar more usable — TX 49.8K
// members all roll up to "Texas" instead of fragmenting across hundreds of
// city labels. Callers that want per-zip granularity can hit the
// intentPayload JSON column on the lead row.
function resolveMarket(
  payload: RawIntentPayload,
  source: MarketplaceSyncSource,
): string {
  const city = (payload.city ?? "").trim();
  const state = (payload.state ?? "").trim().toUpperCase();
  // Use city only if it looks like a real city name (>2 chars, not a number).
  if (city.length > 2 && !/^\d+$/.test(city)) {
    const stateLabel = STATE_NAMES[state];
    return stateLabel ? `${city}, ${stateLabel}` : city;
  }
  if (state.length === 2 && STATE_NAMES[state]) {
    return STATE_NAMES[state];
  }
  return source.defaultMarket ?? "Unspecified";
}

// US state abbreviation → display name. Used for market labels.
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "Washington, DC",
};

// ---------------------------------------------------------------------------
// Tiered pricing
//
// Adjusts the source's defaultPriceCents up for high-intent leads and down
// for cooler ones. Buyers get clear value signals (a $145 lead obviously
// looks hotter than a $35 one) and we extract more revenue from the leads
// most likely to close.
//
//   intent ≥ 90  → 2.0x  (premium tier — mortgage pre-app, cash buyer, etc.)
//   intent ≥ 80  → 1.5x  (hot tier)
//   intent ≥ 70  → 1.2x  (warm tier)
//   intent ≥ 60  → 1.0x  (base — verified identity, mild signal)
//   intent  < 60 → 0.7x  (cool tier — verified-only)
function tierPrice(basePriceCents: number, intentScore: number): number {
  let multiplier = 1.0;
  if (intentScore >= 90) multiplier = 2.0;
  else if (intentScore >= 80) multiplier = 1.5;
  else if (intentScore >= 70) multiplier = 1.2;
  else if (intentScore >= 60) multiplier = 1.0;
  else multiplier = 0.7;
  // Round to nearest $5 to keep prices clean.
  const cents = Math.round((basePriceCents * multiplier) / 500) * 500;
  return Math.max(500, cents); // never below $5
}
