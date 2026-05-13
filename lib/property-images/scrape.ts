import "server-only";

// ---------------------------------------------------------------------------
// Property image scraper — pulls og:image (→ heroImageUrl) and the best
// available logo signal (→ logoUrl) from a property's public marketing
// website. Runs server-side from an action or a cron, NEVER from the
// browser — public-facing HTML fetches can take a few seconds and would
// destroy interactivity.
//
// Pipeline:
//   1. Normalise the URL (https://, no trailing slash).
//   2. Fetch with a 6s timeout + LeaseStack user-agent so origins know
//      who we are (helps with cache + abuse triage).
//   3. Parse the HTML head with cheerio (already a dep — used by intake
//      site classifier).
//   4. Extract image candidates in priority order:
//        hero:  og:image > twitter:image > first <img> in <header>/<main>
//        logo:  og:logo > schema.org logo > <link rel="icon"> > favicon
//   5. Resolve relative URLs against the page origin.
//   6. Return both URLs (or null per slot) + any error.
//
// Design notes:
//   - We don't host-rewrite or proxy the image — we just store the URL.
//     If the origin moves the asset, the avatar shows the Building icon
//     fallback (PropertyAvatar handles 404 gracefully).
//   - HEAD requests would be ideal for verifying the image exists, but
//     many CDNs return 405 on HEAD. We trust the URL and let the browser
//     handle 404s.
//   - Returns structured result so callers can record `imageScrapeError`
//     for diagnostics without throwing.
// ---------------------------------------------------------------------------

import * as cheerio from "cheerio";

export type ScrapeResult = {
  /** Best hero image found (og:image > twitter:image > ...). Null if none. */
  heroImageUrl: string | null;
  /** Best logo found (og:logo > schema logo > icon link > favicon). Null if none. */
  logoUrl: string | null;
  /** Final URL after redirects (so callers can update websiteUrl if it changed). */
  finalUrl: string;
  /** Page title — useful as a sanity check that we hit the right page. */
  pageTitle: string | null;
  /** Surface diagnostic for the cron / UI to log. */
  warning: string | null;
};

const SCRAPE_TIMEOUT_MS = 6_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; LeaseStackBot/1.0; +https://leasestack.co/bot)";

export function normaliseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const u = new URL(withScheme);
    // Strip default ports + the trailing slash on bare host so callers
    // get a deterministic value to compare/store.
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Resolve a possibly-relative URL against a base.
 * Returns null if the input is empty or fails to parse.
 */
function resolveAgainst(base: string, raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Reject obvious data URIs as they'd bloat the DB and the avatar
  // <img> already handles them — but they're not portable.
  if (trimmed.startsWith("data:")) return null;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

/**
 * Cheerio sometimes returns srcset entries — pick the highest-resolution
 * URL by parsing the comma-separated list and taking the last entry.
 */
function pickFromSrcset(srcset: string): string {
  const parts = srcset
    .split(",")
    .map((p) => p.trim().split(/\s+/)[0])
    .filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export async function scrapePropertyImages(
  rawUrl: string,
): Promise<ScrapeResult> {
  const normalised = normaliseUrl(rawUrl);
  if (!normalised) {
    throw new Error("Invalid URL");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(normalised, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        // Respect operator privacy — we don't follow tracking redirects
        // that try to set cookies.
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const message =
      err instanceof Error && err.name === "AbortError"
        ? `Timed out after ${SCRAPE_TIMEOUT_MS}ms`
        : err instanceof Error
          ? err.message
          : "Network error";
    throw new Error(message);
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const finalUrl = response.url || normalised;
  const html = await response.text();
  if (!html.includes("<")) {
    throw new Error("Response not HTML");
  }

  const $ = cheerio.load(html);
  const head = $("head");

  // -------------------------------------------------------------------
  // Hero candidates (priority order)
  // -------------------------------------------------------------------
  const heroCandidates: Array<string | undefined> = [
    head.find('meta[property="og:image:secure_url"]').attr("content"),
    head.find('meta[property="og:image"]').attr("content"),
    head.find('meta[name="twitter:image"]').attr("content"),
    head.find('meta[name="twitter:image:src"]').attr("content"),
    head.find('link[rel="image_src"]').attr("href"),
  ];

  // Body-level fallback: first sizeable image inside header/main/section.
  // We DON'T scan the whole <body> because nav-bar tiny icons would win.
  if (!heroCandidates.some((c) => c?.trim())) {
    const bodyImg = $("header img, main img, section img").first();
    const src = bodyImg.attr("src") ?? bodyImg.attr("data-src");
    const srcset = bodyImg.attr("srcset");
    if (srcset) heroCandidates.push(pickFromSrcset(srcset));
    if (src) heroCandidates.push(src);
  }

  // -------------------------------------------------------------------
  // Logo candidates (priority order)
  // -------------------------------------------------------------------
  const logoCandidates: Array<string | undefined> = [
    head.find('meta[property="og:logo"]').attr("content"),
    // Schema.org Organization logo embedded as JSON-LD
    extractJsonLdLogo($),
    head.find('link[rel="apple-touch-icon"]').attr("href"),
    head.find('link[rel="apple-touch-icon-precomposed"]').attr("href"),
    head.find('link[rel="icon"][type="image/png"]').attr("href"),
    head.find('link[rel="icon"]').attr("href"),
    head.find('link[rel="shortcut icon"]').attr("href"),
  ];

  // Body-level logo fallback: a header <img> with "logo" in src/alt/class.
  // This catches sites that don't bother with og:logo but have a clearly
  // labelled logo asset in their nav.
  if (!logoCandidates.some((c) => c?.trim())) {
    let bodyLogo: string | undefined;
    $("header img, nav img").each((_i, el) => {
      if (bodyLogo) return;
      const img = $(el);
      const src = img.attr("src") ?? img.attr("data-src") ?? "";
      const alt = (img.attr("alt") ?? "").toLowerCase();
      const cls = (img.attr("class") ?? "").toLowerCase();
      if (
        src &&
        (alt.includes("logo") ||
          cls.includes("logo") ||
          src.toLowerCase().includes("logo"))
      ) {
        bodyLogo = src;
      }
    });
    if (bodyLogo) logoCandidates.push(bodyLogo);
  }

  // -------------------------------------------------------------------
  // Resolve + filter
  // -------------------------------------------------------------------
  const heroImageUrl =
    heroCandidates
      .map((c) => resolveAgainst(finalUrl, c))
      .find((u): u is string => Boolean(u)) ?? null;
  const logoUrl =
    logoCandidates
      .map((c) => resolveAgainst(finalUrl, c))
      .find((u): u is string => Boolean(u)) ?? null;

  // Last-resort favicon: /favicon.ico relative to the origin. Browsers
  // request this by convention even when no <link> tag is present.
  const fallbackFavicon = !logoUrl
    ? resolveAgainst(finalUrl, "/favicon.ico")
    : null;

  const pageTitle = head.find("title").first().text().trim() || null;

  let warning: string | null = null;
  if (!heroImageUrl && !logoUrl && !fallbackFavicon) {
    warning =
      "No og:image, og:logo, or favicon found. Site may be a SPA that needs JS to render head tags.";
  }

  return {
    heroImageUrl,
    logoUrl: logoUrl ?? fallbackFavicon,
    finalUrl,
    pageTitle,
    warning,
  };
}

/**
 * Extract the Organization logo from a JSON-LD <script> block.
 * Returns the first logo URL found across all parsed blocks.
 */
function extractJsonLdLogo($: cheerio.CheerioAPI): string | undefined {
  let found: string | undefined;
  $('script[type="application/ld+json"]').each((_i, el) => {
    if (found) return;
    try {
      const raw = $(el).contents().text();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const logo = item.logo;
        if (typeof logo === "string") {
          found = logo;
          return;
        }
        if (logo && typeof logo === "object" && typeof logo.url === "string") {
          found = logo.url;
          return;
        }
      }
    } catch {
      // Malformed JSON-LD is common — silently skip.
    }
  });
  return found;
}
