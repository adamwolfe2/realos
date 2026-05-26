import "server-only";

import { prisma } from "@/lib/db";
import type { CsvRow } from "@/lib/marketplace/csv-client";
import type { MarketplaceSeller } from "@prisma/client";

// ---------------------------------------------------------------------------
// Marketplace import dedup — categorizes each incoming CSV row into one of:
//
//   "new"           → no existing seller lead matches
//   "exact-match"   → same email or normalized-phone as an existing seller lead
//   "possible-dup"  → fuzzy-match warning that needs human review
//
// Three signals drive the buckets, in strict precedence order:
//
//   1. EXACT MATCH on identity → email (lowercase trim) OR normalized phone
//      (digits only, last 10) shared with an existing seller lead.
//      Confidence: high. UI default action: skip the import for this row.
//
//   2. POSSIBLE-DUP on near-identity → name + city/state Levenshtein < 2, OR
//      same email-domain + name Levenshtein < 2, OR same last-7-phone-digits.
//      Confidence: medium. UI shows side-by-side comparison, user toggles
//      'import anyway' vs 'skip' per row.
//
//   3. NEW → fall-through. Will be inserted on commit.
//
// The dedup pass runs on the SELLER's existing leads only (we don't dedupe
// against other sellers — same lead from two sellers is treated as two
// rows, scored independently, priced independently).
// ---------------------------------------------------------------------------

export type DedupBucket = "new" | "exact-match" | "possible-dup";

export interface ExistingLeadRef {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
}

export interface DedupRowResult {
  /** Index into the original CSV rows array. */
  rowIndex: number;
  bucket: DedupBucket;
  /** Why the row landed in this bucket. UI surfaces this verbatim. */
  reason: string;
  /** Existing leads that matched (only populated for exact-match + possible-dup). */
  matches: ExistingLeadRef[];
  /** The incoming row payload — repeated here so the wizard doesn't have to re-key. */
  row: CsvRow;
}

export interface DedupPreviewSummary {
  total: number;
  newCount: number;
  exactMatchCount: number;
  possibleDupCount: number;
  results: DedupRowResult[];
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function normEmail(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  return t.length > 0 && t.includes("@") ? t : null;
}

function normPhone(s: string | null | undefined): string | null {
  if (!s) return null;
  // Keep digits only, then take the last 10 (handles +1, country codes, etc.)
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits.length > 0 ? digits : null;
}

function emailDomain(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  return at > 0 && at < email.length - 1 ? email.slice(at + 1) : null;
}

function last7Phone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.length >= 7 ? phone.slice(-7) : null;
}

function fullName(first: string | null | undefined, last: string | null | undefined): string {
  return `${(first ?? "").trim().toLowerCase()} ${(last ?? "").trim().toLowerCase()}`.trim();
}

function cityState(city: string | null | undefined, state: string | null | undefined): string {
  return `${(city ?? "").trim().toLowerCase()}|${(state ?? "").trim().toLowerCase()}`;
}

// Levenshtein distance — small string optimization. Bails early once we
// exceed maxDistance (caller doesn't care about exact value past the
// threshold, only pass/fail). Iterative DP — no recursion overhead.
export function levenshtein(a: string, b: string, maxDistance = 3): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

// ---------------------------------------------------------------------------
// Existing-leads index — built once per dedup pass, used by every row check.
// Keeps the work O(N + M) instead of O(N×M).
// ---------------------------------------------------------------------------

interface ExistingIndex {
  byEmail: Map<string, ExistingLeadRef>;
  byPhone10: Map<string, ExistingLeadRef>;
  byPhone7: Map<string, ExistingLeadRef[]>;
  byEmailDomain: Map<string, ExistingLeadRef[]>;
  byCityState: Map<string, ExistingLeadRef[]>;
  all: ExistingLeadRef[];
}

function buildIndex(leads: ExistingLeadRef[]): ExistingIndex {
  const byEmail = new Map<string, ExistingLeadRef>();
  const byPhone10 = new Map<string, ExistingLeadRef>();
  const byPhone7 = new Map<string, ExistingLeadRef[]>();
  const byEmailDomain = new Map<string, ExistingLeadRef[]>();
  const byCityState = new Map<string, ExistingLeadRef[]>();

  for (const lead of leads) {
    const e = normEmail(lead.email);
    if (e) byEmail.set(e, lead);

    const p = normPhone(lead.phone);
    if (p && p.length === 10) byPhone10.set(p, lead);
    const p7 = last7Phone(p);
    if (p7) {
      const bucket = byPhone7.get(p7) ?? [];
      bucket.push(lead);
      byPhone7.set(p7, bucket);
    }

    const dom = emailDomain(e);
    if (dom) {
      const bucket = byEmailDomain.get(dom) ?? [];
      bucket.push(lead);
      byEmailDomain.set(dom, bucket);
    }

    const cs = cityState(lead.city, lead.state);
    if (cs.length > 1) {
      const bucket = byCityState.get(cs) ?? [];
      bucket.push(lead);
      byCityState.set(cs, bucket);
    }
  }

  return { byEmail, byPhone10, byPhone7, byEmailDomain, byCityState, all: leads };
}

// ---------------------------------------------------------------------------
// Single-row classification — runs all three checks in precedence order and
// returns the first match.
// ---------------------------------------------------------------------------

function classifyRow(
  row: CsvRow,
  index: ExistingIndex,
): { bucket: DedupBucket; reason: string; matches: ExistingLeadRef[] } {
  const incomingEmail = normEmail(row.email);
  const incomingPhone = normPhone(row.phone);
  const incomingName = fullName(row.firstName, row.lastName);
  const incomingCityState = cityState(row.city, row.state);
  const incomingDomain = emailDomain(incomingEmail);
  const incomingPhone7 = last7Phone(incomingPhone);

  // 1. EXACT MATCH — email
  if (incomingEmail) {
    const hit = index.byEmail.get(incomingEmail);
    if (hit) {
      return {
        bucket: "exact-match",
        reason: `Same email (${incomingEmail}) as existing lead`,
        matches: [hit],
      };
    }
  }

  // 1. EXACT MATCH — full 10-digit phone
  if (incomingPhone && incomingPhone.length === 10) {
    const hit = index.byPhone10.get(incomingPhone);
    if (hit) {
      return {
        bucket: "exact-match",
        reason: `Same phone (${formatPhone(incomingPhone)}) as existing lead`,
        matches: [hit],
      };
    }
  }

  // 2. POSSIBLE DUP — name + city/state Levenshtein
  if (incomingName && incomingCityState !== "|") {
    const csBucket = index.byCityState.get(incomingCityState);
    if (csBucket) {
      const fuzzyNameHit = csBucket.find((lead) => {
        const existingName = fullName(lead.firstName, lead.lastName);
        if (!existingName) return false;
        return levenshtein(incomingName, existingName, 2) <= 2;
      });
      if (fuzzyNameHit) {
        return {
          bucket: "possible-dup",
          reason: `Same name + city/state as existing lead "${fullName(fuzzyNameHit.firstName, fuzzyNameHit.lastName)}"`,
          matches: [fuzzyNameHit],
        };
      }
    }
  }

  // 2. POSSIBLE DUP — same email domain + similar name
  if (incomingDomain && incomingName) {
    const domBucket = index.byEmailDomain.get(incomingDomain);
    if (domBucket) {
      const fuzzyDomHit = domBucket.find((lead) => {
        const existingName = fullName(lead.firstName, lead.lastName);
        if (!existingName) return false;
        return levenshtein(incomingName, existingName, 2) <= 2;
      });
      if (fuzzyDomHit) {
        return {
          bucket: "possible-dup",
          reason: `Same email domain (${incomingDomain}) + similar name to "${fullName(fuzzyDomHit.firstName, fuzzyDomHit.lastName)}"`,
          matches: [fuzzyDomHit],
        };
      }
    }
  }

  // 2. POSSIBLE DUP — last-7 phone match (catches local-number duplicates
  // where one record stored +1 country code and the other didn't).
  if (incomingPhone7) {
    const p7Bucket = index.byPhone7.get(incomingPhone7);
    if (p7Bucket && p7Bucket.length > 0) {
      const first = p7Bucket[0];
      return {
        bucket: "possible-dup",
        reason: `Last 7 digits of phone match existing lead`,
        matches: [first],
      };
    }
  }

  // 3. NEW
  return {
    bucket: "new",
    reason: "No matching existing lead — will be created on import",
    matches: [],
  };
}

function formatPhone(p10: string): string {
  if (p10.length !== 10) return p10;
  return `(${p10.slice(0, 3)}) ${p10.slice(3, 6)}-${p10.slice(6)}`;
}

// ---------------------------------------------------------------------------
// Public API — fetch the seller's existing leads + classify every row.
// ---------------------------------------------------------------------------

export async function previewDedup(
  seller: MarketplaceSeller,
  rows: CsvRow[],
): Promise<DedupPreviewSummary> {
  // Pull every existing lead for this seller. Cap at 50K to keep the dedup
  // pass under ~1 second of work even for the biggest sellers; sellers past
  // that scale will need the dedup moved to a background job.
  const existing = await prisma.marketplaceLead.findMany({
    where: { sellerId: seller.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      city: true,
      state: true,
    },
    take: 50_000,
  });

  const index = buildIndex(existing);

  const results: DedupRowResult[] = rows.map((row, rowIndex) => {
    const { bucket, reason, matches } = classifyRow(row, index);
    return { rowIndex, bucket, reason, matches, row };
  });

  return {
    total: results.length,
    newCount: results.filter((r) => r.bucket === "new").length,
    exactMatchCount: results.filter((r) => r.bucket === "exact-match").length,
    possibleDupCount: results.filter((r) => r.bucket === "possible-dup").length,
    results,
  };
}

// Same as previewDedup but takes a pre-fetched existing-leads array. Used by
// tests + the import endpoint when it already has the seller's leads loaded.
export function classifyRows(
  rows: CsvRow[],
  existing: ExistingLeadRef[],
): DedupPreviewSummary {
  const index = buildIndex(existing);
  const results: DedupRowResult[] = rows.map((row, rowIndex) => {
    const { bucket, reason, matches } = classifyRow(row, index);
    return { rowIndex, bucket, reason, matches, row };
  });
  return {
    total: results.length,
    newCount: results.filter((r) => r.bucket === "new").length,
    exactMatchCount: results.filter((r) => r.bucket === "exact-match").length,
    possibleDupCount: results.filter((r) => r.bucket === "possible-dup").length,
    results,
  };
}
