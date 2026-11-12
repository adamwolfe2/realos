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
    /** Set when the source came from a system's own record (AppFolio's lead source), not our tracking. */
    reportedBy?: "appfolio";
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

// Our own / PMS / scheduling hops are never a traffic source (mirrors the embeds).
const IGNORED_REFERRER = /(^|\.)(appfolio\.com|leasestack\.co|calendly\.com|vercel\.app)$/;
function usableReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    return IGNORED_REFERRER.test(host) ? null : referrer;
  } catch {
    return null; // not a URL: no usable referrer
  }
}

function build(first: Touch, last: Touch | null): ResolvedAttribution {
  const utm = effectiveUtm(first);
  const source = classifySource(utm.source, usableReferrer(first.referrer), utm.medium);
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

/** A lead older than this was acquired before this visit; today's source is not its origin. */
export const ATTRIBUTION_FILL_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Same, for an update. Fills ONLY a row that has no source yet AND was
 * created within the last 24h (the pre-chat form → chat twin, a quick
 * resubmit). An older lead coming back today keeps "Not tracked": crediting
 * its original acquisition to today's channel would be a false attribution.
 */
export function attributionFill(
  existing: { trafficSource: string | null; createdAt: Date },
  a: ResolvedAttribution | null,
  now: Date = new Date(),
): { trafficSource?: string; attribution?: Prisma.InputJsonValue } {
  if (existing.trafficSource) return {};
  // Unknown age → don't guess; leaving it untracked is never a false credit.
  if (!(existing.createdAt instanceof Date)) return {};
  if (now.getTime() - existing.createdAt.getTime() > ATTRIBUTION_FILL_WINDOW_MS) return {};
  return attributionColumns(a);
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
  const base =
    stored && typeof stored.sourceLabel === "string" && stored.sourceLabel
      ? stored.sourceLabel.slice(0, 120)
      : getSource(row.trafficSource).label;
  // Never let a PMS-reported source read as our own tracking.
  return attributionReportedBy(row.attribution) === "appfolio" ? `${base} (per AppFolio)` : base;
}

// Canonical ids that name a real marketing platform. A PMS "source" value that
// only resolves to a capture surface (chatbot, web form, an emailed inquiry), a generic bucket
// (referral, manual, other) or "direct" says nothing about the channel.
const NON_CHANNEL_IDS = new Set(["direct", "other", "referral", "manual", "chatbot", "web_form", "appfolio", "email"]);

/**
 * Attribution from a lead source a PMS recorded itself (AppFolio guest card
 * "source": "Zillow", "Apartments.com"...). Only a value that names a real
 * platform is used; "Website", "Walk-in", "Phone" and unknown text return
 * null (stays "Not tracked") rather than being guessed into a channel.
 */
export function attributionFromReportedSource(
  raw: string | null | undefined,
  reportedBy: "appfolio",
): ResolvedAttribution | null {
  const value = raw?.trim().slice(0, 200);
  if (!value) return null;
  const source = classifySource(value, null, null);
  if (NON_CHANNEL_IDS.has(source.id)) return null;
  return {
    trafficSource: source.id,
    attribution: { sourceLabel: source.label, first: { utmSource: value }, last: null, reportedBy },
  };
}

/** True when the stored attribution came from a PMS record, not our tracking. */
export function attributionReportedBy(attribution: unknown): "appfolio" | null {
  const a = attribution as { reportedBy?: unknown } | null;
  return a && a.reportedBy === "appfolio" ? "appfolio" : null;
}
