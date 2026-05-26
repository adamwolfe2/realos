// Client-safe CSV parser. Lightweight and deps-free.
//
// Header row is required. Recognised column names (case-insensitive):
//   firstName, lastName, email, phone, city, state, postalCode,
//   propertyType, budgetMinCents, budgetMaxCents, budgetUnit,
//   signal, timeline, listingsViewed7d, hasMortgagePreApp,
//   hasScheduledTour, hasCashBuyerSignal, isRelocating, isDistressed.
//
// Unknown columns are ignored. Numeric columns coerce; boolean columns
// accept "true"/"yes"/"1" (case-insensitive). Missing values are dropped
// rather than included as nulls so the server can fall back to defaults.

export type CsvRow = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  propertyType?: "RENTAL" | "SALE" | "INVESTMENT" | "COMMERCIAL";
  budgetMinCents?: number;
  budgetMaxCents?: number;
  budgetUnit?: "ABS" | "MONTHLY";
  signal?: string;
  timeline?: string;
  listingsViewed7d?: number;
  hasMortgagePreApp?: boolean;
  hasScheduledTour?: boolean;
  hasCashBuyerSignal?: boolean;
  isRelocating?: boolean;
  isDistressed?: boolean;
};

const PROPERTY_TYPES = new Set(["RENTAL", "SALE", "INVESTMENT", "COMMERCIAL"]);

export function parseCsv(text: string): CsvRow[] {
  const lines = splitLines(text);
  if (lines.length < 2) {
    throw new Error("CSV is empty or missing a header row.");
  }
  const headers = splitRow(lines[0]).map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const fields = splitRow(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j] ?? "";
    }
    const parsed = normalizeRow(row);
    if (parsed) rows.push(parsed);
  }
  return rows;
}

function splitLines(text: string): string[] {
  // Split on \r\n or \n. Keep quoted newlines intact by counting quotes.
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (current.length > 0 || out.length === 0) {
        out.push(current);
      }
      current = "";
      // Skip the \n of a \r\n pair
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

function normalizeRow(raw: Record<string, string>): CsvRow | null {
  // Map header name (case-insensitive) → known field.
  const lower: Record<string, string> = {};
  for (const k of Object.keys(raw)) {
    lower[k.toLowerCase()] = raw[k];
  }

  const out: CsvRow = {};
  const str = (k: string) => trimOrUndef(lower[k.toLowerCase()]);
  const num = (k: string) => numOrUndef(lower[k.toLowerCase()]);
  const bool = (k: string) => boolOrUndef(lower[k.toLowerCase()]);

  out.firstName = str("firstname");
  out.lastName = str("lastname");
  out.email = str("email");
  out.phone = str("phone");
  out.city = str("city");
  out.state = str("state");
  out.postalCode = str("postalcode") ?? str("zip");
  out.signal = str("signal");
  out.timeline = str("timeline");

  const pt = str("propertytype")?.toUpperCase();
  if (pt && PROPERTY_TYPES.has(pt)) {
    out.propertyType = pt as CsvRow["propertyType"];
  }
  const bu = str("budgetunit")?.toUpperCase();
  if (bu === "ABS" || bu === "MONTHLY") {
    out.budgetUnit = bu;
  }

  out.budgetMinCents = num("budgetmincents");
  out.budgetMaxCents = num("budgetmaxcents");
  out.listingsViewed7d = num("listingsviewed7d");
  out.hasMortgagePreApp = bool("hasmortgagepreapp");
  out.hasScheduledTour = bool("hasscheduledtour");
  out.hasCashBuyerSignal = bool("hascashbuyersignal");
  out.isRelocating = bool("isrelocating");
  out.isDistressed = bool("isdistressed");

  if (!out.email && !out.phone) return null;
  return out;
}

function trimOrUndef(s: string | undefined): string | undefined {
  if (s == null) return undefined;
  const t = s.replace(/^"|"$/g, "").trim();
  return t.length > 0 ? t : undefined;
}

function numOrUndef(s: string | undefined): number | undefined {
  if (s == null) return undefined;
  const t = s.replace(/^"|"$/g, "").trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function boolOrUndef(s: string | undefined): boolean | undefined {
  if (s == null) return undefined;
  const t = s.replace(/^"|"$/g, "").trim().toLowerCase();
  if (!t) return undefined;
  if (["true", "yes", "1"].includes(t)) return true;
  if (["false", "no", "0"].includes(t)) return false;
  return undefined;
}
