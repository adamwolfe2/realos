/**
 * Marketable Property helpers.
 *
 * Single source of truth for the question "which Property rows count?"
 *
 * Background: AppFolio's `property_directory` returns parking lots,
 * storage units, garages, model units, leasing offices, and other
 * sub-records as their own `property_id`s. The historical sync wrote
 * one Property row per AppFolio row, which inflated SG Real Estate's
 * portfolio from a real ~71 buildings to 127 dashboard "properties."
 * That made every count tile, sidebar number, and onboarding progress
 * indicator lie to the operator.
 *
 * The fix has two layers:
 *
 *   1. Lifecycle field on Property (IMPORTED / ACTIVE / EXCLUDED /
 *      ARCHIVED). New AppFolio rows land as IMPORTED. Pattern-matched
 *      sub-records auto-flip to EXCLUDED at import time. Operators
 *      review IMPORTED in a curation queue.
 *
 *   2. This module — every count site (dashboard tile, sidebar,
 *      first-run progress, demo-readiness, onboarding-drip cron) calls
 *      `marketablePropertyWhere(scope)` so the question "how many
 *      properties does this org have?" has exactly one answer.
 *
 * Consumers:
 *   - app/portal/page.tsx (dashboard tile)
 *   - app/portal/layout.tsx (sidebar count)
 *   - lib/dashboard/queries.ts (first-run progress)
 *   - lib/admin/demo-readiness.ts
 *   - app/api/cron/onboarding-drip/route.ts
 *   - app/portal/properties/page.tsx (default list view)
 */

import type { Prisma, PropertyLifecycle } from "@prisma/client";

/**
 * The set of lifecycles that count as "marketable" — i.e. show up in
 * counts, dashboards, sidebars, and onboarding progress. EXCLUDED and
 * ARCHIVED rows still exist in the DB (we never delete them so we can
 * dedupe on backendPropertyId during re-syncs) but never count.
 */
export const MARKETABLE_LIFECYCLES: PropertyLifecycle[] = ["ACTIVE"];

/**
 * Lifecycles visible in the curation queue at /portal/properties/curate.
 * IMPORTED = "AppFolio dumped these, operator review needed."
 */
export const CURATION_QUEUE_LIFECYCLES: PropertyLifecycle[] = ["IMPORTED"];

/**
 * Returns a Prisma WhereInput fragment that scopes a query to the given
 * org AND restricts to marketable properties. Use everywhere a count or
 * "real properties" list is needed.
 *
 * Pass `{ includeImported: true }` for surfaces that show the curation
 * queue alongside active rows (e.g. an admin view).
 */
export function marketablePropertyWhere(
  orgId: string,
  options: { includeImported?: boolean; includeArchived?: boolean } = {},
): Prisma.PropertyWhereInput {
  const lifecycles: PropertyLifecycle[] = [...MARKETABLE_LIFECYCLES];
  if (options.includeImported) lifecycles.push("IMPORTED");
  if (options.includeArchived) lifecycles.push("ARCHIVED");

  return {
    orgId,
    lifecycle: { in: lifecycles },
  };
}

/**
 * Same as `marketablePropertyWhere` but accepts an existing scope-
 * sourced WhereInput so callers that already build complex filters
 * (e.g. property selector, role-based access) can layer this on top
 * without losing their other clauses.
 */
export function withMarketableLifecycle(
  base: Prisma.PropertyWhereInput,
  options: { includeImported?: boolean; includeArchived?: boolean } = {},
): Prisma.PropertyWhereInput {
  const lifecycles: PropertyLifecycle[] = [...MARKETABLE_LIFECYCLES];
  if (options.includeImported) lifecycles.push("IMPORTED");
  if (options.includeArchived) lifecycles.push("ARCHIVED");

  return {
    ...base,
    lifecycle: { in: lifecycles },
  };
}

// ---------------------------------------------------------------------------
// AUTO-CLASSIFIER
// ---------------------------------------------------------------------------

/**
 * Patterns that strongly indicate a non-marketable sub-record. The
 * regex is anchored to word boundaries (`\b`) to avoid false positives
 * like a property literally named "The Carport" — but in practice
 * AppFolio never uses these strings as part of a real building name.
 *
 * If a real building gets caught in the net, the operator can manually
 * promote it to ACTIVE in the curation queue; that decision is sticky
 * (lifecycleSetBy = OPERATOR) so re-syncs won't auto-revert it.
 */
const NON_MARKETABLE_NAME_PATTERNS = [
  /\bparking\b/i,
  /\bstorage\b/i,
  /\bgarage\b/i,
  /\blocker\b/i,
  /\bcarport\b/i,
  /\blaundry\b/i,
  /\bmaintenance\b/i,
  /\bleasing[\s-]?office\b/i,
  /\bmodel[\s-]?unit\b/i,
  /\bamenit(y|ies)\b/i,
  /\bclubhouse\b/i,
  /\bpool\b/i,
  /\bgym\b/i,
];

/**
 * Patterns AppFolio commonly uses for placeholder rows that aren't
 * even sub-records — they're admin junk we never want to show.
 */
const PLACEHOLDER_NAME_PATTERNS = [
  /do not use/i,
  /^property\s/i, // AppFolio default-generated names like "Property 12345"
  /^test\s/i,
  /^delete\b/i,
  /^old\s/i,
];

export type AutoClassification = {
  lifecycle: PropertyLifecycle;
  reason: string | null;
};

/**
 * Classify a Property at import or backfill time. Conservative by
 * design: when in doubt, return IMPORTED so the operator gets to
 * decide. Only auto-flips to EXCLUDED for high-confidence sub-record
 * patterns.
 *
 * Inputs available at import (from AppFolio property_directory):
 *   - name
 *   - totalUnits (often null for parking/storage)
 *   - addressLine1 (often null/empty for sub-records)
 */
export function classifyProperty(input: {
  name: string | null;
  totalUnits: number | null;
  addressLine1: string | null;
}): AutoClassification {
  const name = (input.name ?? "").trim();

  // Empty name = nothing to classify on. Hold for review.
  if (!name) {
    return { lifecycle: "IMPORTED", reason: "no name" };
  }

  // Placeholder/admin junk → EXCLUDED
  for (const pattern of PLACEHOLDER_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return {
        lifecycle: "EXCLUDED",
        reason: `placeholder name pattern: ${pattern.source}`,
      };
    }
  }

  // Sub-record (parking/storage/etc.) → EXCLUDED
  for (const pattern of NON_MARKETABLE_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return {
        lifecycle: "EXCLUDED",
        reason: `non-marketable sub-record: ${pattern.source}`,
      };
    }
  }

  // No clear signal — let the operator decide.
  return { lifecycle: "IMPORTED", reason: null };
}
