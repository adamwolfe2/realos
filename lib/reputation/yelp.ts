import "server-only";
import { MentionSource } from "@prisma/client";
import * as cheerio from "cheerio";
import type { ScanSourceResult, ScannedMention, PropertySeed } from "./types";
import { isAllowedUrlWithDns } from "@/lib/utils/ssrf-protection";

// ---------------------------------------------------------------------------
// Yelp — public biz-page review scrape.
//
// Background:
//   Yelp's Fusion API has been deprecated for reviews (their /reviews
//   endpoint now returns only 3 truncated snippets, and their data licensing
//   terms increasingly restrict storage). The pragmatic path is to scrape
//   the public biz page when a property has a `yelpBusinessId` configured.
//
// Behavior:
//   * Only runs when `property.yelpBusinessId` is set. Without it we can't
//     resolve a URL — the Tavily path already handles "search for Yelp
//     mentions" without an alias.
//   * URL: https://www.yelp.com/biz/<slug-or-alias>
//   * Hits SSRF-safe fetch first (the alias is operator-supplied, so we
//     treat it as untrusted — though Yelp's host is the only realistic
//     target).
//   * Extracts review cards via cheerio. Yelp keeps shipping new DOM
//     structures every few months, so we cast a wide selector net and
//     score per-card to pick the actual review nodes.
//   * Caps at 10 reviews to avoid scraping a thousand-review biz page.
//   * Falls back silently — Yelp blocking (403/503) is COMMON. The
//     orchestrator records the error on the ReputationScan row and the
//     unified inbox surfaces it as a partial-source warning.
// ---------------------------------------------------------------------------

const MAX_REVIEWS_PER_SCAN = 10;
const YELP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

function bizUrlFor(yelpBusinessId: string): string | null {
  // `yelpBusinessId` can be a numeric internal id or (more commonly) a
  // human-readable alias. The /biz/<alias> path works for both, but a
  // numeric id requires the alias-resolution redirect — Yelp serves a
  // 301 to the alias URL and we follow it via fetch redirect:"follow".
  const alias = yelpBusinessId.trim().replace(/^https?:\/\/[^/]*\/biz\//, "");
  if (!alias) return null;
  // Strip any leading slash; reject suspicious characters that would
  // otherwise break out of the URL path.
  const cleaned = alias.replace(/^\//, "");
  if (!/^[a-z0-9._%~+:?#@!$&'()*,;=/-]+$/i.test(cleaned)) return null;
  return `https://www.yelp.com/biz/${cleaned}`;
}

function parseYelpReviews(html: string, baseUrl: string): ScannedMention[] {
  const $ = cheerio.load(html);
  const mentions: ScannedMention[] = [];

  // Yelp's review cards live under <li> elements with data-testid attributes
  // like "review" or class names containing "review". We probe a few stable
  // selectors and dedupe on review URL — Yelp recycles markup across A/B
  // variants so any one selector might miss on a given render.
  const candidateSelectors = [
    "[data-testid='review-list'] li",
    "[data-testid='review']",
    "li[class*='review__']",
    "div[class*='review__'][data-testid]",
  ];

  const seenBodies = new Set<string>();

  for (const sel of candidateSelectors) {
    if (mentions.length >= MAX_REVIEWS_PER_SCAN) break;
    $(sel).each((_, el) => {
      if (mentions.length >= MAX_REVIEWS_PER_SCAN) return;

      const $el = $(el);

      // Body text. The review body is typically inside a <p> or a span
      // with class "raw__". Take the longest text node under the card.
      let body = "";
      $el.find("p, span").each((_, n) => {
        const t = $(n).text().trim();
        if (t.length > body.length) body = t;
      });
      if (!body || body.length < 20) return;
      if (seenBodies.has(body)) return;

      // Author name — anchor with class containing "user-passport" or
      // data-analytics="biz-details-user-passport-author-name".
      let author: string | null = null;
      const authorEl = $el.find(
        "[data-analytics-label*='user-name'], a[href*='/user_details']",
      ).first();
      if (authorEl.length) author = authorEl.text().trim() || null;

      // Rating — Yelp encodes star ratings in aria-label like "5 star rating".
      let rating: number | null = null;
      const ratingEl = $el
        .find("[aria-label*='star rating'], [class*='five-stars']")
        .first();
      if (ratingEl.length) {
        const label = ratingEl.attr("aria-label") || "";
        const m = label.match(/([0-5](?:\.\d)?)\s*star/i);
        if (m) {
          const n = Number(m[1]);
          if (Number.isFinite(n) && n >= 1 && n <= 5) rating = n;
        }
      }

      // Published date — "Jan 14, 2026" inside a span near the author.
      let publishedAt: Date | null = null;
      const dateText = $el
        .find("span")
        .filter((_, n) => /^[A-Z][a-z]{2,8} \d{1,2}, \d{4}$/.test($(n).text().trim()))
        .first()
        .text()
        .trim();
      if (dateText) {
        const parsed = new Date(dateText);
        if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
      }

      seenBodies.add(body);
      mentions.push({
        source: MentionSource.YELP,
        // We don't have a stable per-review URL from the scrape — use the
        // biz page URL plus a content-derived fragment so dedupe still
        // works across scans.
        sourceUrl: `${baseUrl}#review-${hashForFragment(body)}`,
        title: null,
        excerpt: body.slice(0, 1200),
        authorName: author,
        publishedAt,
        rating,
      });
    });
  }

  return mentions;
}

// Tiny non-crypto hash for URL fragments. We just need a stable identifier
// per review body so the urlHash dedupe doesn't collapse multiple reviews
// from the same biz page.
function hashForFragment(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export async function searchYelp(
  property: PropertySeed,
): Promise<ScanSourceResult> {
  if (!property.yelpBusinessId) {
    // Not configured — return a clean "no-op" rather than an error. This
    // lets the orchestrator skip the source-failed banner when the
    // operator simply hasn't set up Yelp for this property.
    return {
      source: "yelp",
      ok: true,
      found: 0,
      mentions: [],
    };
  }

  const url = bizUrlFor(property.yelpBusinessId);
  if (!url) {
    return {
      source: "yelp",
      ok: false,
      found: 0,
      mentions: [],
      error: "Invalid yelpBusinessId — could not derive biz URL",
    };
  }

  // SSRF guard. Yelp's host is well-known, but the alias is operator-
  // supplied so we route through the same DNS-aware allowlist used for
  // every other operator URL on the platform.
  const allowed = await isAllowedUrlWithDns(url);
  if (!allowed) {
    return {
      source: "yelp",
      ok: false,
      found: 0,
      mentions: [],
      error: "URL failed SSRF safety check",
    };
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": YELP_USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return {
        source: "yelp",
        ok: false,
        found: 0,
        mentions: [],
        error: `Yelp ${res.status}${res.status === 403 ? " — likely bot-blocked, no action needed" : ""}`,
      };
    }
    const html = await res.text();
    const mentions = parseYelpReviews(html, url);
    return {
      source: "yelp",
      ok: true,
      found: mentions.length,
      mentions,
    };
  } catch (err) {
    return {
      source: "yelp",
      ok: false,
      found: 0,
      mentions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
