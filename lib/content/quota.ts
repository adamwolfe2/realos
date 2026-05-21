// ---------------------------------------------------------------------------
// Monthly content quota — read + enforce + record helpers.
//
// Quotas are stored on MonthlyContentQuota (one row per orgId + UTC month
// start). Limits per plan tier live as constants below; per-client bumps
// come from Organization.contentQuotaOverride (Json). Override values win
// over plan defaults.
//
// Contract:
//   * getQuotaForOrg(orgId)      → resolve current period + limits + used.
//   * assertQuota({orgId,format}) → throws QuotaExceededError if over.
//   * recordQuotaUsage({orgId,format}) → atomic +1 increment.
//
// recordQuotaUsage MUST NOT run before assertQuota in the same flow —
// the API route handler owns the check + increment ordering. The library
// keeps the two operations distinct so a caller can audit a draft without
// burning quota.
// ---------------------------------------------------------------------------

import { Prisma, type ContentFormat } from "@prisma/client";
import { prisma } from "@/lib/db";

export type PlanTier = "TRIAL" | "STARTER" | "PRO" | "AGENCY";

export type QuotaLimits = Record<ContentFormat, number>;
export type QuotaUsage = Record<ContentFormat, number>;

const UNLIMITED = 999;

// ---------------------------------------------------------------------------
// Plan defaults
// ---------------------------------------------------------------------------

const PLAN_DEFAULTS: Record<PlanTier, QuotaLimits> = {
  TRIAL: {
    BLOG_POST: 3,
    NEIGHBORHOOD_PAGE: 2,
    PROPERTY_DESCRIPTION: UNLIMITED,
    META_REWRITE: UNLIMITED,
    FAQ_BLOCK: UNLIMITED,
    AD_COPY: UNLIMITED,
  },
  STARTER: {
    BLOG_POST: 5,
    NEIGHBORHOOD_PAGE: 5,
    PROPERTY_DESCRIPTION: UNLIMITED,
    META_REWRITE: UNLIMITED,
    FAQ_BLOCK: UNLIMITED,
    AD_COPY: UNLIMITED,
  },
  PRO: {
    BLOG_POST: 25,
    NEIGHBORHOOD_PAGE: 15,
    PROPERTY_DESCRIPTION: UNLIMITED,
    META_REWRITE: UNLIMITED,
    FAQ_BLOCK: UNLIMITED,
    AD_COPY: UNLIMITED,
  },
  AGENCY: {
    BLOG_POST: UNLIMITED,
    NEIGHBORHOOD_PAGE: UNLIMITED,
    PROPERTY_DESCRIPTION: UNLIMITED,
    META_REWRITE: UNLIMITED,
    FAQ_BLOCK: UNLIMITED,
    AD_COPY: UNLIMITED,
  },
};

export const QUOTA_UNLIMITED = UNLIMITED;

// ---------------------------------------------------------------------------
// Format → MonthlyContentQuota column map
//
// Centralised so assertQuota + recordQuotaUsage agree on which Int column
// represents which ContentFormat. Adding a new format = one schema column
// + one entry here.
// ---------------------------------------------------------------------------

type QuotaUsageColumn =
  | "blogPostsUsed"
  | "neighborhoodPagesUsed"
  | "propertyDescriptionsUsed"
  | "metaRewritesUsed"
  | "faqBlocksUsed"
  | "adCopiesUsed";

const FORMAT_TO_COLUMN: Record<ContentFormat, QuotaUsageColumn> = {
  BLOG_POST: "blogPostsUsed",
  NEIGHBORHOOD_PAGE: "neighborhoodPagesUsed",
  PROPERTY_DESCRIPTION: "propertyDescriptionsUsed",
  META_REWRITE: "metaRewritesUsed",
  FAQ_BLOCK: "faqBlocksUsed",
  AD_COPY: "adCopiesUsed",
};

const ALL_FORMATS: ContentFormat[] = [
  "BLOG_POST",
  "NEIGHBORHOOD_PAGE",
  "PROPERTY_DESCRIPTION",
  "META_REWRITE",
  "FAQ_BLOCK",
  "AD_COPY",
];

// ---------------------------------------------------------------------------
// QuotaExceededError — thrown from assertQuota, carries HTTP 429 hint.
// ---------------------------------------------------------------------------

export class QuotaExceededError extends Error {
  readonly status = 429;
  readonly format: ContentFormat;
  readonly limit: number;
  readonly used: number;
  readonly periodStart: Date;

  constructor(args: {
    format: ContentFormat;
    limit: number;
    used: number;
    periodStart: Date;
  }) {
    super(
      `Monthly quota exceeded for ${args.format}: ${args.used}/${args.limit}`,
    );
    this.name = "QuotaExceededError";
    this.format = args.format;
    this.limit = args.limit;
    this.used = args.used;
    this.periodStart = args.periodStart;
  }
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

// First day of the current UTC month at 00:00:00.000.
export function getCurrentPeriodStart(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

// First day of the next UTC month — used by the meter UI for the "Resets"
// label. Pure, deterministic, no DB read.
export function getNextPeriodStart(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}

// ---------------------------------------------------------------------------
// Plan tier resolution
//
// Reads Organization.subscriptionStatus + subscriptionTier and maps to
// the quota PlanTier set:
//   subscriptionStatus === TRIALING                       → TRIAL
//   subscriptionTier   === STARTER                        → STARTER
//   subscriptionTier   === GROWTH                         → PRO
//   subscriptionTier   === SCALE | CUSTOM                 → AGENCY
//   anything else (null/unknown)                          → TRIAL (safe default)
// ---------------------------------------------------------------------------

function resolvePlanTier(args: {
  subscriptionStatus: string | null;
  subscriptionTier: string | null;
}): PlanTier {
  if (args.subscriptionStatus === "TRIALING") return "TRIAL";
  switch (args.subscriptionTier) {
    case "STARTER":
      return "STARTER";
    case "GROWTH":
      return "PRO";
    case "SCALE":
    case "CUSTOM":
      return "AGENCY";
    default:
      return "TRIAL";
  }
}

// Override JSON shape is loose by design — the admin endpoint validates
// before persisting, but consumers should still defend against garbage.
function parseOverride(raw: unknown): Partial<QuotaLimits> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<QuotaLimits> = {};
  for (const format of ALL_FORMATS) {
    const val = (raw as Record<string, unknown>)[format];
    if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
      out[format] = Math.floor(val);
    }
  }
  return out;
}

function mergeLimits(
  base: QuotaLimits,
  override: Partial<QuotaLimits>,
): QuotaLimits {
  return ALL_FORMATS.reduce<QuotaLimits>(
    (acc, format) => {
      acc[format] = override[format] ?? base[format];
      return acc;
    },
    {} as QuotaLimits,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type QuotaSnapshot = {
  limits: QuotaLimits;
  used: QuotaUsage;
  periodStart: Date;
  nextPeriodStart: Date;
  planTier: PlanTier;
};

/**
 * Resolve the current month's quota for an org.
 *
 * Single Prisma query — selects only the columns we need from Organization
 * and uses a related-row select to pull the current-month counter row in
 * the same round trip. Returns zero-usage when no row exists yet (creation
 * is deferred to the first recordQuotaUsage call so reads never write).
 */
export async function getQuotaForOrg(orgId: string): Promise<QuotaSnapshot> {
  const periodStart = getCurrentPeriodStart();
  const nextPeriodStart = getNextPeriodStart();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      subscriptionStatus: true,
      subscriptionTier: true,
      contentQuotaOverride: true,
      contentQuotas: {
        where: { periodStart },
        select: {
          blogPostsUsed: true,
          neighborhoodPagesUsed: true,
          propertyDescriptionsUsed: true,
          metaRewritesUsed: true,
          faqBlocksUsed: true,
          adCopiesUsed: true,
        },
        take: 1,
      },
    },
  });

  if (!org) {
    throw new Error(`Organization not found: ${orgId}`);
  }

  const planTier = resolvePlanTier({
    subscriptionStatus: org.subscriptionStatus,
    subscriptionTier: org.subscriptionTier,
  });
  const limits = mergeLimits(
    PLAN_DEFAULTS[planTier],
    parseOverride(org.contentQuotaOverride),
  );

  const row = org.contentQuotas[0];
  const used: QuotaUsage = {
    BLOG_POST: row?.blogPostsUsed ?? 0,
    NEIGHBORHOOD_PAGE: row?.neighborhoodPagesUsed ?? 0,
    PROPERTY_DESCRIPTION: row?.propertyDescriptionsUsed ?? 0,
    META_REWRITE: row?.metaRewritesUsed ?? 0,
    FAQ_BLOCK: row?.faqBlocksUsed ?? 0,
    AD_COPY: row?.adCopiesUsed ?? 0,
  };

  return { limits, used, periodStart, nextPeriodStart, planTier };
}

/**
 * Throw QuotaExceededError when the format's used >= limit. Returns the
 * fresh snapshot on success so the caller doesn't re-read.
 *
 * Does NOT mutate state — pair with recordQuotaUsage AFTER the underlying
 * work succeeds (i.e. after the draft row is created).
 */
export async function assertQuota(args: {
  orgId: string;
  format: ContentFormat;
}): Promise<QuotaSnapshot> {
  const snapshot = await getQuotaForOrg(args.orgId);
  const limit = snapshot.limits[args.format];
  const used = snapshot.used[args.format];
  if (used >= limit) {
    throw new QuotaExceededError({
      format: args.format,
      limit,
      used,
      periodStart: snapshot.periodStart,
    });
  }
  return snapshot;
}

/**
 * Atomic +1 increment on the right format column for the current UTC
 * month. Uses Prisma's upsert with `{ increment: 1 }` so concurrent
 * draft creations cannot lose writes.
 */
export async function recordQuotaUsage(args: {
  orgId: string;
  format: ContentFormat;
}): Promise<void> {
  const periodStart = getCurrentPeriodStart();
  const column = FORMAT_TO_COLUMN[args.format];

  await prisma.monthlyContentQuota.upsert({
    where: {
      orgId_periodStart: { orgId: args.orgId, periodStart },
    },
    create: {
      orgId: args.orgId,
      periodStart,
      [column]: 1,
    } as Prisma.MonthlyContentQuotaUncheckedCreateInput,
    update: {
      [column]: { increment: 1 },
    } as Prisma.MonthlyContentQuotaUncheckedUpdateInput,
  });
}

// Re-export ALL_FORMATS so the meter UI doesn't have to redeclare the
// canonical iteration order.
export { ALL_FORMATS };
