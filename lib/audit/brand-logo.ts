// Brand logo extraction from the crawled homepage (2026-08-19).
//
// The audit already has Firecrawl's rendered HTML for the prospect's
// homepage. Pulling their mark out of it and showing it beside the
// property name is the cheapest possible way to make the report read as
// theirs rather than as a template — zero extra API calls.
//
// Pure function, no network. We only ever hand the resulting URL to an
// <img src>; nothing is fetched server-side, so a hostile page can point
// us at a 404 (renders nothing) but not at anything internal.

/** Ordered best-to-worst. Earlier sources are more likely to be an
 *  actual logo rather than a hero photo or a generic favicon. */
const PATTERNS: Array<{ name: string; re: RegExp; group: number }> = [
  // schema.org Organization.logo — an explicit, self-declared logo.
  { name: "jsonld-logo", re: /"logo"\s*:\s*"([^"]{4,500})"/i, group: 1 },
  // schema.org logo as an ImageObject: "logo":{...,"url":"..."}
  {
    name: "jsonld-logo-object",
    re: /"logo"\s*:\s*\{[^{}]{0,300}?"url"\s*:\s*"([^"]{4,500})"/i,
    group: 1,
  },
  // <img> whose class/id/alt says logo. Attribute order varies, so match
  // the tag then pull src out of it separately.
  { name: "img-logo", re: /<img\b[^>]*\b(?:class|id|alt)\s*=\s*"[^"]*logo[^"]*"[^>]*>/i, group: 0 },
  { name: "img-logo-sq", re: /<img\b[^>]*\b(?:class|id|alt)\s*=\s*'[^']*logo[^']*'[^>]*>/i, group: 0 },
  // Filename says logo even when no attribute does.
  { name: "img-src-logo", re: /<img\b[^>]*\bsrc\s*=\s*["'][^"']*logo[^"']*["'][^>]*>/i, group: 0 },
  // Square app icon — almost always the mark, and already sized for it.
  {
    name: "apple-touch-icon",
    re: /<link\b[^>]*\brel\s*=\s*["']apple-touch-icon[^"']*["'][^>]*>/i,
    group: 0,
  },
  // Deliberately NO favicon fallback: a 16-32px .ico stretched to hero
  // height is visibly blurry, and a fuzzy mark at the top of a sales
  // report is worse than the wordmark alone (Adam 2026-08-19).
];

// Our own marks, never the prospect's. Two ways ours could leak into a
// report: the prospect's site carries a "powered by LeaseStack" badge, or
// someone audits leasestack.co itself. Either way the hero must fall back
// to the wordmark rather than brand their report as us (Adam 2026-08-19).
const OWN_HOSTS = [
  "leasestack.co",
  "leasestack.com",
  "realos.vercel.app",
];

function isOwnHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return OWN_HOSTS.some((own) => host === own || host.endsWith(`.${own}`));
  } catch {
    return true; // unparseable → don't render it
  }
}

// Attribute values arrive HTML-encoded. Next.js image URLs in
// particular come through as `?url=x&amp;w=384`, and handing that to an
// <img src> requests a literally different URL that 400s
// (telegraphcommons.com, 2026-08-19).
function decodeEntities(value: string): string {
  return value
    .replace(/&(?:amp|#38|#x26);/gi, "&")
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&(?:lt|#60);/gi, "<")
    .replace(/&(?:gt|#62);/gi, ">");
}

function attr(tag: string, name: string): string | null {
  const m =
    tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i")) ??
    tag.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

/** First entry of a srcset ("a.png 1x, b.png 2x" → "a.png"). */
function firstSrc(srcset: string): string | null {
  const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

/**
 * Pull a usable logo URL out of rendered homepage HTML.
 * Returns an absolute https/http URL, or null when nothing credible was
 * found. `baseUrl` is the prospect's own crawled URL — it resolves
 * relative hrefs (`/logo.svg`), so the result always traces back to the
 * domain the prospect entered. Never returns a LeaseStack-hosted mark.
 */
export function extractBrandLogo(
  html: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!html) return null;
  // Only the <head> + top of <body> — a "logo" match 200KB down the page
  // is a footer partner badge, not their mark.
  const head = html.slice(0, 120_000);

  for (const { re, group } of PATTERNS) {
    // Every match of the pattern, not just the first: a "powered by
    // LeaseStack" badge sitting above the prospect's real mark must be
    // skipped over, not treated as the answer for that pattern.
    const all = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    for (const m of head.matchAll(all)) {
      const raw =
        group === 0
          ? attr(m[0], "src") ??
            attr(m[0], "href") ??
            (attr(m[0], "srcset") ? firstSrc(attr(m[0], "srcset")!) : null)
          : decodeEntities(m[group]);
      const resolved = toAbsoluteHttpUrl(raw, baseUrl);
      if (resolved && !isOwnHost(resolved)) return resolved;
    }
  }
  return null;
}

/** Absolute http(s) only. Rejects data:, javascript:, and anything that
 *  won't parse — those would either break the <img> or, in the data:
 *  case, let a crawled page inline arbitrary bytes into our report. */
export function toAbsoluteHttpUrl(
  raw: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return null;
  try {
    const u = new URL(trimmed, baseUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Reject .ico wherever it came from. Wix declares the favicon as
    // schema.org Organization.logo, which otherwise sails past the
    // pattern ordering and lands a 32px blur in the hero.
    if (/\.ico$/i.test(u.pathname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}
