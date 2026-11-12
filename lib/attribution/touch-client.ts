// Browser side of lib/attribution/touch.ts for LeaseStack-hosted tenant sites.
// Mirrors the capture in public/embed/chatbot.js + popup.js (same
// localStorage key, same rules) so hosted pages record the visitor's first
// touch even when the chatbot embed is disabled. Keep the two in sync.

const KEY = "ls_touch";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
// Our own / PMS / scheduling hops are not traffic sources (same list as the embeds).
const IGNORED_REFERRER = /(^|\.)(appfolio\.com|leasestack\.co|calendly\.com|vercel\.app)$/;

type ClientTouch = Record<string, string | number | null>;
type Stored = { first: ClientTouch; last: ClientTouch | null };

const SIGNAL_KEYS = ["referrer", "utmSource", "utmMedium", "utmCampaign", "gclid", "fbclid", "msclkid", "zgRef"];
const hasSignal = (t: ClientTouch | null | undefined) => Boolean(t && SIGNAL_KEYS.some((k) => t[k]));

function readStored(): Stored | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Stored | null;
    return v && typeof v === "object" && v.first ? v : null;
  } catch {
    return null; // corrupt value: start fresh
  }
}

/** Record this page view as a touch (first-signal-wins, last = latest tagged). */
export function captureTouch(): Stored | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const g = (k: string) => q.get(k)?.slice(0, 300) || null;
  let referrer: string | null = null;
  try {
    const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");
    const rh = document.referrer ? bare(new URL(document.referrer).hostname) : "";
    if (rh && rh !== bare(window.location.hostname) && !IGNORED_REFERRER.test(rh)) {
      referrer = document.referrer.slice(0, 2048);
    }
  } catch {
    referrer = null; // malformed referrer header: treat as none
  }
  const t: ClientTouch = {
    ts: Date.now(),
    landingUrl: window.location.href.slice(0, 2048),
    referrer,
    utmSource: g("utm_source"),
    utmMedium: g("utm_medium"),
    utmCampaign: g("utm_campaign"),
    utmTerm: g("utm_term"),
    utmContent: g("utm_content"),
    gclid: g("gclid"),
    fbclid: g("fbclid"),
    msclkid: g("msclkid"),
    zgRef: g("zgRef"),
  };
  const prev = readStored();
  const expired = !prev || Date.now() - Number(prev.first.ts ?? 0) > TTL_MS;
  const next: Stored = expired
    ? { first: t, last: hasSignal(t) ? t : null }
    : hasSignal(t)
      ? { first: hasSignal(prev.first) ? prev.first : t, last: t }
      : prev;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked (private mode): this page's touch is still returned
  }
  return next;
}

/** Fields to spread into a public lead/tour POST body. */
export function touchFields(): { touch?: unknown; pageUrl?: string } {
  if (typeof window === "undefined") return {};
  return { touch: readStored() ?? captureTouch() ?? undefined, pageUrl: window.location.href.slice(0, 2000) };
}
