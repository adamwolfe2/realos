import type { Visitor } from "@prisma/client";

// ---------------------------------------------------------------------------
// Visitor enrichment helpers.
//
// The `enrichedData` column on Visitor is a JSON blob mirroring the
// AudienceLab / Cursive `resolution` payload. Keys are UPPER_SNAKE:
//   FIRST_NAME, LAST_NAME, JOB_TITLE, COMPANY_NAME, COMPANY_DOMAIN,
//   PERSONAL_CITY, STATE, PERSONAL_EMAIL, ...
//
// These helpers narrow the unknown JSON safely so the feed page stays clean.
// ---------------------------------------------------------------------------

export type VisitorIdentity = {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  initials: string;
  companyName: string | null;
  companyDomain: string | null;
  jobTitle: string | null;
  city: string | null;
  state: string | null;
  location: string | null;
  logoUrl: string | null;
  lastPagePath: string | null;
  lastPageUrl: string | null;
  isAnonymous: boolean;
};

type Json = unknown;

function asRecord(value: Json): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readString(
  source: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!source) return null;
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
}

function readPagePath(pages: Json): { path: string | null; url: string | null } {
  if (!Array.isArray(pages) || pages.length === 0) {
    return { path: null, url: null };
  }
  // Take the last entry — the most recent page view.
  const last = pages[pages.length - 1];
  if (!last || typeof last !== "object") return { path: null, url: null };
  const record = last as Record<string, unknown>;
  const urlRaw = record.url;
  if (typeof urlRaw !== "string" || urlRaw.trim().length === 0) {
    return { path: null, url: null };
  }
  const url = urlRaw.trim();
  try {
    const parsed = new URL(url);
    const path =
      parsed.pathname + (parsed.search ? parsed.search : "") || "/";
    return { path, url };
  } catch {
    // Not a full URL — treat as a path.
    return { path: url, url };
  }
}

function buildInitials(first: string | null, last: string | null): string {
  const a = first?.charAt(0).toUpperCase() ?? "";
  const b = last?.charAt(0).toUpperCase() ?? "";
  const combined = `${a}${b}`.trim();
  return combined.length > 0 ? combined : "?";
}

// Deterministic color bucket for the fallback avatar. Same visitor always gets
// the same bucket so the feed doesn't flicker between renders.
const AVATAR_PALETTE = [
  "bg-blue-500/15 text-blue-700",
  "bg-emerald-500/15 text-emerald-700",
  "bg-amber-500/15 text-amber-700",
  "bg-rose-500/15 text-rose-700",
  "bg-violet-500/15 text-violet-700",
  "bg-sky-500/15 text-sky-700",
  "bg-teal-500/15 text-teal-700",
  "bg-fuchsia-500/15 text-fuchsia-700",
];

export function avatarPaletteFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function extractIdentity(visitor: Visitor): VisitorIdentity {
  const enriched = asRecord(visitor.enrichedData as Json);

  const firstName =
    visitor.firstName ?? readString(enriched, "FIRST_NAME", "first_name");
  const lastName =
    visitor.lastName ?? readString(enriched, "LAST_NAME", "last_name");

  const companyName = readString(
    enriched,
    "COMPANY_NAME",
    "COMPANY",
    "company_name"
  );
  const companyDomain = readString(
    enriched,
    "COMPANY_DOMAIN",
    "company_domain"
  );
  const jobTitle = readString(enriched, "JOB_TITLE", "job_title", "TITLE");
  const city = readString(enriched, "PERSONAL_CITY", "CITY", "city");
  const state = readString(enriched, "STATE", "PERSONAL_STATE", "state");

  const location = [city, state].filter(Boolean).join(", ") || null;

  const { path: lastPagePath, url: lastPageUrl } = readPagePath(
    visitor.pagesViewed as Json
  );

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    visitor.email ||
    "Anonymous visitor";

  const initials = buildInitials(firstName, lastName);

  const logoUrl = companyDomain
    ? `https://logo.clearbit.com/${companyDomain}`
    : null;

  const isAnonymous =
    !firstName && !lastName && !visitor.email;

  return {
    displayName,
    firstName,
    lastName,
    initials,
    companyName,
    companyDomain,
    jobTitle,
    city,
    state,
    location,
    logoUrl,
    lastPagePath,
    lastPageUrl,
    isAnonymous,
  };
}
