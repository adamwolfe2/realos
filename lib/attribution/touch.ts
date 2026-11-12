// ---------------------------------------------------------------------------
// touch.ts — first-touch traffic attribution for leads + chatbot conversations.
//
// The embeds (public/embed/chatbot.js + popup.js) remember where a visitor
// first arrived from (UTM tags, ad click ids, external referrer) in the site's
// localStorage and send it as `touch` with every chat / lead / popup submit.
// This module validates that untrusted payload and classifies it through the
// ONE canonical registry (source-taxonomy.ts), so "zillow" in a UTM and
// "zillow.com" as a referrer both land on the Zillow channel.
//
// Display/reporting only: nothing here may gate access, price, or ownership.
// A malformed touch degrades to "no touch"; it never fails the lead.
// ---------------------------------------------------------------------------

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { classifySource, getSource } from "@/lib/attribution/source-taxonomy";

const str = (max: number) => z.string().trim().max(max).optional().nullable();

const touchSchema = z.object({
  ts: z.number().int().nonnegative().optional().nullable(),
  landingUrl: str(2048),
  referrer: str(2048),
  utmSource: str(200),
  utmMedium: str(200),
  utmCampaign: str(300),
  utmTerm: str(300),
  utmContent: str(300),
  gclid: str(300),
  fbclid: str(500),
  msclkid: str(300),
  zgRef: str(100),
});

export const touchPayloadSchema = z.object({
  first: touchSchema.optional().nullable(),
  last: touchSchema.optional().nullable(),
});

export type Touch = z.infer<typeof touchSchema>;
export type TouchPayload = z.infer<typeof touchPayloadSchema>;

export type ResolvedAttribution = {
  /** Canonical source id from source-taxonomy (e.g. "zillow", "google_organic", "direct"). */
  trafficSource: string;
  /** Raw first/last touch + resolved label, stored as Json for drill-down. */
  attribution: {
    sourceLabel: string;
    first: Touch;
    last: Touch | null;
  };
};

/** Parse the untrusted `touch` body field. Anything invalid → null (never throws). */
export function parseTouchPayload(raw: unknown): TouchPayload | null {
  if (raw == null) return null;
  const parsed = touchPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Pull UTM / click-id params out of a page URL (fallback for old cached embeds). */
export function touchFromUrl(url: string | null | undefined): Touch | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const p = (k: string) => u.searchParams.get(k)?.trim().slice(0, 300) || null;
  const touch: Touch = {
    landingUrl: url.slice(0, 2048),
    utmSource: p("utm_source"),
    utmMedium: p("utm_medium"),
    utmCampaign: p("utm_campaign"),
    utmTerm: p("utm_term"),
    utmContent: p("utm_content"),
    gclid: p("gclid"),
    fbclid: p("fbclid"),
    msclkid: p("msclkid"),
    zgRef: p("zgRef"),
  };
  return hasSignal(touch) ? touch : null;
}

function hasSignal(t: Touch): boolean {
  return Boolean(
    t.utmSource || t.utmMedium || t.utmCampaign || t.gclid || t.fbclid || t.msclkid || t.zgRef || t.referrer,
  );
}

/** Click ids and listing-site refs stand in for a missing utm_source. */
function effectiveUtm(t: Touch): { source: string | null; medium: string | null } {
  // A Google click id is proof of a paid click, whatever utm_medium says.
  if (t.utmSource) return { source: t.utmSource, medium: t.gclid ? "cpc" : (t.utmMedium ?? null) };
  if (t.gclid) return { source: "google", medium: "cpc" };
  if (t.msclkid) return { source: "bing", medium: t.utmMedium ?? null };
  if (t.fbclid) return { source: "facebook", medium: t.utmMedium ?? null };
  if (t.zgRef) return { source: t.zgRef, medium: t.utmMedium ?? null };
  return { source: null, medium: t.utmMedium ?? null };
}

/**
 * Resolve the stored attribution for a capture.
 * - `touch` present (new embed): classify its first touch; a touch with no
 *   signal at all is a real "Direct" visit.
 * - no `touch` (old cached embed): fall back to UTM params on `pageUrl`;
 *   with none, return null (unknown, not "Direct").
 */
export function resolveAttribution(args: {
  touch: unknown;
  pageUrl?: string | null;
}): ResolvedAttribution | null {
  const payload = parseTouchPayload(args.touch);
  const first = payload?.first ?? touchFromUrl(args.pageUrl);
  if (!first) {
    if (!payload) return null;
    // Valid payload with no first touch recorded: treat as direct.
    return build({ landingUrl: args.pageUrl?.slice(0, 2048) ?? null }, payload.last ?? null);
  }
  return build(first, payload?.last ?? null);
}

function build(first: Touch, last: Touch | null): ResolvedAttribution {
  const utm = effectiveUtm(first);
  const source = classifySource(utm.source, first.referrer, utm.medium);
  return {
    trafficSource: source.id,
    attribution: { sourceLabel: source.label, first, last },
  };
}

/** Prisma columns for a create; `{}` when unknown so nothing is written. */
export function attributionColumns(
  a: ResolvedAttribution | null,
): { trafficSource?: string; attribution?: Prisma.InputJsonValue } {
  return a
    ? { trafficSource: a.trafficSource, attribution: a.attribution as unknown as Prisma.InputJsonValue }
    : {};
}

/** Same, for an update: only fills a row that has no source yet (first touch is never overwritten). */
export function attributionFill(
  existingTrafficSource: string | null | undefined,
  a: ResolvedAttribution | null,
): { trafficSource?: string; attribution?: Prisma.InputJsonValue } {
  return existingTrafficSource ? {} : attributionColumns(a);
}

/**
 * Human label for a stored lead/conversation source: "Zillow", "Google Ads",
 * "berkeley.edu" (unknown referrer keeps its host). Null when never captured.
 */
export function trafficSourceLabel(
  row: { trafficSource: string | null; attribution: unknown } | null | undefined,
): string | null {
  if (!row?.trafficSource) return null;
  const stored = row.attribution as { sourceLabel?: unknown } | null;
  if (stored && typeof stored.sourceLabel === "string" && stored.sourceLabel) {
    return stored.sourceLabel.slice(0, 120);
  }
  return getSource(row.trafficSource).label;
}
