// ---------------------------------------------------------------------------
// CSV column auto-mapping. Given a parsed CSV's header row + first N rows of
// sample data, infer the most likely mapping from source-column-name to
// marketplace field. The seller-import wizard shows the inferred mapping in
// step 3 and lets the user override any row before continuing.
//
// Two signals drive detection, in order of precedence:
//
//   1. NAME MATCH — direct synonym lookup against SYNONYMS below. Handles the
//      80% case: "First Name" / "firstName" / "fname" / "first_name" all map
//      to firstName.
//
//   2. SAMPLE DETECT — when name match fails, inspect up to 25 sample values
//      and classify by shape (looks-like-email, looks-like-phone, looks-like-
//      zip, looks-like-state, etc.). Only fires when the sample is reasonably
//      uniform (≥60% of non-empty values match the heuristic).
//
// Returned ColumnMapping rows are { sourceHeader, marketplaceField, confidence,
// sampleValues }. confidence is 'name-match' | 'sample-detect' | 'unmapped'.
// ---------------------------------------------------------------------------

/** Every marketplace field a CSV column can map to. Mirrors CsvRow in
 *  lib/marketplace/csv-client.ts. */
export const MARKETPLACE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "city",
  "state",
  "postalCode",
  "propertyType",
  "budgetMinCents",
  "budgetMaxCents",
  "budgetUnit",
  "signal",
  "timeline",
  "listingsViewed7d",
  "hasMortgagePreApp",
  "hasScheduledTour",
  "hasCashBuyerSignal",
  "isRelocating",
  "isDistressed",
] as const;

export type MarketplaceField = (typeof MARKETPLACE_FIELDS)[number];

export type MappingConfidence = "name-match" | "sample-detect" | "unmapped";

export interface ColumnMapping {
  /** The header from the CSV (preserved as-is for UI display). */
  sourceHeader: string;
  /** Marketplace field this column maps to, or null to skip the column. */
  marketplaceField: MarketplaceField | null;
  /** How we arrived at this mapping. UI uses this for the 'auto' badge. */
  confidence: MappingConfidence;
  /** First 3 non-empty values from this column (for sample-data preview). */
  sampleValues: string[];
}

// ---------------------------------------------------------------------------
// Synonym dictionary — maps a NORMALIZED source header to a marketplace field.
// Normalization: lowercase, strip non-alphanumerics, collapse whitespace.
// "First Name", "first_name", "FNAME", "First-Name" all normalize to "firstname".
// ---------------------------------------------------------------------------

const SYNONYMS: Record<string, MarketplaceField> = {
  // firstName
  firstname: "firstName",
  fname: "firstName",
  givenname: "firstName",
  first: "firstName",
  contactfirstname: "firstName",
  // lastName
  lastname: "lastName",
  lname: "lastName",
  surname: "lastName",
  familyname: "lastName",
  last: "lastName",
  contactlastname: "lastName",
  // email
  email: "email",
  emailaddress: "email",
  contactemail: "email",
  primaryemail: "email",
  mail: "email",
  // phone
  phone: "phone",
  phonenumber: "phone",
  mobile: "phone",
  mobilenumber: "phone",
  cell: "phone",
  cellphone: "phone",
  primaryphone: "phone",
  contactphone: "phone",
  tel: "phone",
  telephone: "phone",
  // city
  city: "city",
  town: "city",
  locality: "city",
  // state
  state: "state",
  province: "state",
  region: "state",
  administrativeregion: "state",
  // postalCode
  postalcode: "postalCode",
  zip: "postalCode",
  zipcode: "postalCode",
  postcode: "postalCode",
  postal: "postalCode",
  // propertyType
  propertytype: "propertyType",
  listingtype: "propertyType",
  type: "propertyType",
  category: "propertyType",
  // budget
  budgetmincents: "budgetMinCents",
  budgetmaxcents: "budgetMaxCents",
  budgetmin: "budgetMinCents",
  budgetmax: "budgetMaxCents",
  minbudget: "budgetMinCents",
  maxbudget: "budgetMaxCents",
  budgetunit: "budgetUnit",
  // signal / timeline
  signal: "signal",
  intent: "signal",
  notes: "signal",
  comment: "signal",
  description: "signal",
  timeline: "timeline",
  movetimeline: "timeline",
  movein: "timeline",
  // behavioural overlays
  listingsviewed7d: "listingsViewed7d",
  listingsviewed: "listingsViewed7d",
  viewcount: "listingsViewed7d",
  hasmortgagepreapp: "hasMortgagePreApp",
  preapproved: "hasMortgagePreApp",
  mortgagepreapp: "hasMortgagePreApp",
  hasscheduledtour: "hasScheduledTour",
  scheduledtour: "hasScheduledTour",
  hascashbuyersignal: "hasCashBuyerSignal",
  cashbuyer: "hasCashBuyerSignal",
  isrelocating: "isRelocating",
  relocating: "isRelocating",
  isdistressed: "isDistressed",
  distressed: "isDistressed",
};

function normalizeHeader(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Sample-data detectors — only consulted when name match fails. Each returns
// a field if ≥60% of non-empty sample values match its shape, otherwise null.
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s().\-]{6,}\d$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const STATE_RE = /^[A-Za-z]{2}$/;
// 50 US states + DC — used to disambiguate state column from a city named "OR"
const US_STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
  "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);

function detectFromSamples(values: string[]): MarketplaceField | null {
  const samples = values.filter((v) => v.length > 0);
  if (samples.length === 0) return null;

  const ratio = (pred: (s: string) => boolean) =>
    samples.filter(pred).length / samples.length;

  if (ratio((s) => EMAIL_RE.test(s)) >= 0.6) return "email";
  if (ratio((s) => PHONE_RE.test(s)) >= 0.6) return "phone";
  if (ratio((s) => ZIP_RE.test(s)) >= 0.6) return "postalCode";
  if (ratio((s) => STATE_RE.test(s) && US_STATES.has(s.toUpperCase())) >= 0.6)
    return "state";
  // We don't sample-detect firstName/lastName/city — too ambiguous without
  // a header hint, and a false-positive there is worse than leaving it
  // unmapped and asking the user.
  return null;
}

// ---------------------------------------------------------------------------
// Main entry point — given the parsed header row + the parsed data rows,
// produce one ColumnMapping per header.
// ---------------------------------------------------------------------------

export interface AutoMapInput {
  headers: string[];
  /** Each row is an array of cell values in the same order as headers. Pass the first 25 rows max. */
  sampleRows: string[][];
}

export interface AutoMapResult {
  mappings: ColumnMapping[];
  /** Marketplace fields that aren't mapped to any source column. */
  unmappedFields: MarketplaceField[];
  mappedCount: number;
  skippedCount: number;
}

export function autoMapColumns(input: AutoMapInput): AutoMapResult {
  const { headers, sampleRows } = input;

  // Track which marketplace fields are already claimed so a duplicate-name
  // header (e.g. two "email" columns) doesn't double-bind.
  const claimed = new Set<MarketplaceField>();
  const mappings: ColumnMapping[] = headers.map((header, colIdx) => {
    const samples = sampleRows
      .slice(0, 25)
      .map((row) => (row[colIdx] ?? "").trim())
      .filter((v) => v.length > 0)
      .slice(0, 3);

    // 1. Name match
    const normalized = normalizeHeader(header);
    const nameMatched = SYNONYMS[normalized];
    if (nameMatched && !claimed.has(nameMatched)) {
      claimed.add(nameMatched);
      return {
        sourceHeader: header,
        marketplaceField: nameMatched,
        confidence: "name-match",
        sampleValues: samples,
      };
    }

    // 2. Sample detect
    const allSamples = sampleRows
      .slice(0, 25)
      .map((row) => (row[colIdx] ?? "").trim());
    const sampleDetected = detectFromSamples(allSamples);
    if (sampleDetected && !claimed.has(sampleDetected)) {
      claimed.add(sampleDetected);
      return {
        sourceHeader: header,
        marketplaceField: sampleDetected,
        confidence: "sample-detect",
        sampleValues: samples,
      };
    }

    // 3. Unmapped
    return {
      sourceHeader: header,
      marketplaceField: null,
      confidence: "unmapped",
      sampleValues: samples,
    };
  });

  const unmappedFields = MARKETPLACE_FIELDS.filter((f) => !claimed.has(f));
  const mappedCount = mappings.filter((m) => m.marketplaceField !== null).length;
  const skippedCount = mappings.length - mappedCount;

  return { mappings, unmappedFields, mappedCount, skippedCount };
}

// ---------------------------------------------------------------------------
// Apply an (already auto-mapped, possibly user-edited) mapping to the raw CSV
// rows to produce the CsvRow[] the existing ingestCsvLeads() expects.
// ---------------------------------------------------------------------------

import type { CsvRow } from "@/lib/marketplace/csv-client";

export function applyMapping(
  mappings: ColumnMapping[],
  rows: string[][],
): CsvRow[] {
  const out: CsvRow[] = [];

  for (const row of rows) {
    const draft: Record<string, string> = {};
    mappings.forEach((m, idx) => {
      if (!m.marketplaceField) return;
      const v = (row[idx] ?? "").trim();
      if (v.length > 0) draft[m.marketplaceField] = v;
    });
    const normalized = normalizeRowToCsvRow(draft);
    if (normalized) out.push(normalized);
  }
  return out;
}

function normalizeRowToCsvRow(draft: Record<string, string>): CsvRow | null {
  const out: CsvRow = {};

  // String passthroughs.
  if (draft.firstName) out.firstName = draft.firstName;
  if (draft.lastName) out.lastName = draft.lastName;
  if (draft.email) out.email = draft.email;
  if (draft.phone) out.phone = draft.phone;
  if (draft.city) out.city = draft.city;
  if (draft.state) out.state = draft.state;
  if (draft.postalCode) out.postalCode = draft.postalCode;
  if (draft.signal) out.signal = draft.signal;
  if (draft.timeline) out.timeline = draft.timeline;

  // Enum coercion.
  const pt = draft.propertyType?.toUpperCase();
  if (pt === "RENTAL" || pt === "SALE" || pt === "INVESTMENT" || pt === "COMMERCIAL") {
    out.propertyType = pt;
  }
  const bu = draft.budgetUnit?.toUpperCase();
  if (bu === "ABS" || bu === "MONTHLY") out.budgetUnit = bu;

  // Numerics.
  const num = (s: string | undefined) => {
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };
  out.budgetMinCents = num(draft.budgetMinCents);
  out.budgetMaxCents = num(draft.budgetMaxCents);
  out.listingsViewed7d = num(draft.listingsViewed7d);

  // Booleans.
  const bool = (s: string | undefined) => {
    if (!s) return undefined;
    const t = s.toLowerCase().trim();
    if (["true", "yes", "1", "y", "t"].includes(t)) return true;
    if (["false", "no", "0", "n", "f"].includes(t)) return false;
    return undefined;
  };
  out.hasMortgagePreApp = bool(draft.hasMortgagePreApp);
  out.hasScheduledTour = bool(draft.hasScheduledTour);
  out.hasCashBuyerSignal = bool(draft.hasCashBuyerSignal);
  out.isRelocating = bool(draft.isRelocating);
  out.isDistressed = bool(draft.isDistressed);

  // Drop rows with no identity anchor — the server-side ingester does the
  // same so we mirror it here to keep the dedup preview numbers honest.
  if (!out.email && !out.phone) return null;
  return out;
}

// ---------------------------------------------------------------------------
// Parse a CSV string into rows of raw cell arrays (no field normalization).
// Re-exported here so the wizard can parse client-side then auto-map.
// ---------------------------------------------------------------------------

export interface RawCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsvRaw(text: string): RawCsv {
  const lines = splitLines(text);
  if (lines.length < 1) return { headers: [], rows: [] };
  const headers = splitRow(lines[0]).map((h) => h.trim());
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    rows.push(splitRow(line));
  }
  return { headers, rows };
}

function splitLines(text: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (current.length > 0 || out.length === 0) out.push(current);
      current = "";
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
    } else {
      current += ch;
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

function splitRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}
