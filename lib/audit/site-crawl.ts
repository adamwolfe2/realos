import "server-only";
import * as cheerio from "cheerio";
import { scrape as firecrawlScrape, isFirecrawlConfigured } from "@/lib/intelligence/firecrawl";

// ---------------------------------------------------------------------------
// Direct site crawl — fallback SEO signal source when DataForSEO returns
// nothing for a domain.
//
// Adam 2026-05-29: "we can't have it just be awaiting the data. There has
// to be something we can do if it's not able to find data on that site.
// Most sites will be up for longer to have actual data on them, but we
// need a fallback to actually have something show up."
//
// What this does:
//   1. Fetches the homepage URL directly (no API key dependencies)
//   2. Parses the HTML for the on-page SEO signals operators actually
//      care about — title, description, canonical, H1, image alt,
//      structured data, viewport, OG tags, etc.
//   3. Probes /sitemap.xml and /robots.txt via HEAD requests
//   4. Returns a SiteCrawlResult the synthesizer + buildSeoSignal can
//      score from, even when DataForSEO Labs has zero indexed data.
//
// Why this is in addition to DataForSEO instant_pages:
//   instant_pages is a paid + cached call (~$0.005 per audit). It works
//   when configured. This is a free, zero-dependency belt-and-suspenders
//   layer that runs ALWAYS so we never show "Awaiting data" on a real
//   reachable site. When DataForSEO has data we use it (it's richer);
//   when it doesn't, this fills the gap.
//
// Costs zero — direct HTTP fetch, no third-party API.
// ---------------------------------------------------------------------------

const CRAWL_TIMEOUT_MS = 12_000;
const HEAD_PROBE_TIMEOUT_MS = 5_000;

// Mimic a real browser. Some sites (Cloudflare, AWS WAF) block obvious
// bot user-agents. Generic Chrome UA passes most edge protections without
// requiring residential proxies.
const CRAWL_USER_AGENT =
  "Mozilla/5.0 (compatible; LeaseStackAudit/1.0; +https://leasestack.co/audit)";

export interface SiteCrawlResult {
  status: "ok" | "unreachable" | "non_html" | "blocked" | "error";
  errorMessage: string | null;
  /** Final URL after redirects — null when fetch failed. */
  resolvedUrl: string | null;
  /** HTTP status from the final response (200, 403, etc.) */
  httpStatus: number | null;
  responseTimeMs: number | null;
  /** Bytes downloaded — useful as a thin-content / over-fat-page proxy. */
  contentLengthBytes: number | null;
  isHttps: boolean;

  // --- Meta -------------------------------------------------------------
  title: string | null;
  titleLength: number;
  description: string | null;
  descriptionLength: number;
  canonical: string | null;
  robotsMeta: string | null;
  viewport: string | null;
  lang: string | null;
  charset: string | null;

  // --- Headings + content ----------------------------------------------
  h1Count: number;
  h1FirstText: string | null;
  h2Count: number;
  /** Visible-ish word count from <body> — strips <script> + <style>. */
  bodyWordCount: number;

  // --- Images + links --------------------------------------------------
  imageCount: number;
  imagesMissingAlt: number;
  internalLinkCount: number;
  externalLinkCount: number;

  // --- Structured data + social ---------------------------------------
  schemaTypes: string[];
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  hasFavicon: boolean;

  // --- Discoverability probes (side channels) --------------------------
  hasSitemapXml: boolean;
  hasRobotsTxt: boolean;
}

function emptyResult(
  url: string,
  status: SiteCrawlResult["status"],
  errorMessage: string | null,
  httpStatus: number | null = null,
  responseTimeMs: number | null = null,
): SiteCrawlResult {
  let isHttps = false;
  try {
    isHttps = new URL(url).protocol === "https:";
  } catch {
    /* ignore */
  }
  return {
    status,
    errorMessage,
    resolvedUrl: null,
    httpStatus,
    responseTimeMs,
    contentLengthBytes: null,
    isHttps,
    title: null,
    titleLength: 0,
    description: null,
    descriptionLength: 0,
    canonical: null,
    robotsMeta: null,
    viewport: null,
    lang: null,
    charset: null,
    h1Count: 0,
    h1FirstText: null,
    h2Count: 0,
    bodyWordCount: 0,
    imageCount: 0,
    imagesMissingAlt: 0,
    internalLinkCount: 0,
    externalLinkCount: 0,
    schemaTypes: [],
    hasOpenGraph: false,
    hasTwitterCard: false,
    hasFavicon: false,
    hasSitemapXml: false,
    hasRobotsTxt: false,
  };
}

/**
 * Fetch the URL + side-probes, parse the HTML, return a SiteCrawlResult.
 * Never throws — wraps every error path in a defensive return so the
 * audit pipeline gets a clean shape even when the target is unreachable.
 *
 * Two-tier fetch strategy:
 *   1. Firecrawl /scrape with `formats: ["html"]` when FIRECRAWL_API_KEY
 *      is configured. Firecrawl handles JavaScript-rendered SPAs
 *      (modern multifamily marketing sites built in React/Next),
 *      Cloudflare/WAF challenge pages, and returns fully-rendered HTML
 *      we can feed to the existing cheerio parser. ~$0.0008 per call.
 *   2. Native fetch fallback for the >50% of property sites that are
 *      server-rendered HTML and don't need JS execution. Free.
 *
 * Either path produces the same SiteCrawlResult shape so downstream
 * scoring + synthesis doesn't need to branch on which fetcher ran.
 */
export async function crawlSite(targetUrl: string): Promise<SiteCrawlResult> {
  const url = normalizeUrl(targetUrl);
  if (!url) {
    return emptyResult(targetUrl, "error", "URL could not be parsed");
  }

  const startedAt = Date.now();

  // Tier 1 — Firecrawl. Only attempted when the API key is configured.
  // Returns null on any error so we fall through to native fetch.
  if (isFirecrawlConfigured()) {
    const fc = await firecrawlScrape({ url, formats: ["html"] }).catch(
      () => null,
    );
    if (fc && fc.ok && fc.data.html) {
      const responseTimeMs = Date.now() - startedAt;
      const statusCode = fc.data.metadata?.statusCode ?? 200;
      const resolvedUrl =
        (fc.data.metadata?.sourceURL as string | undefined) ?? url;
      // Run the cheerio parser on Firecrawl's rendered HTML. Same parser
      // path as native fetch — produces identical SiteCrawlResult shape.
      return parseHtmlIntoResult({
        url: resolvedUrl,
        html: fc.data.html,
        contentLengthBytes: fc.data.html.length,
        httpStatus: statusCode,
        responseTimeMs,
      });
    }
    // Firecrawl failed or returned empty — fall through to native fetch
    // so the audit pipeline still produces signals.
  }

  // Tier 2 — native fetch. Free, fast for SSR sites, blind to SPAs.
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": CRAWL_USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      // Follow redirects so we end up on the canonical homepage.
      redirect: "follow",
      signal: AbortSignal.timeout(CRAWL_TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return emptyResult(
      url,
      // Timeouts + DNS failures + connection refused all classify as
      // "unreachable" to distinguish from 4xx / 5xx (which classify as
      // "error" with the status code).
      /timeout|abort/i.test(message) ? "unreachable" : "error",
      message,
      null,
      Date.now() - startedAt,
    );
  }

  const responseTimeMs = Date.now() - startedAt;

  if (res.status === 403 || res.status === 401 || res.status === 429) {
    // Site explicitly blocks us. Distinguish from generic 5xx so
    // findings can recommend allowlisting our crawler.
    return emptyResult(
      url,
      "blocked",
      `HTTP ${res.status} — site is blocking our crawler (Cloudflare / WAF / bot detection).`,
      res.status,
      responseTimeMs,
    );
  }

  if (!res.ok) {
    return emptyResult(
      url,
      "error",
      `HTTP ${res.status} — homepage returned a non-success status.`,
      res.status,
      responseTimeMs,
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("xml")) {
    return emptyResult(
      url,
      "non_html",
      `Content-Type "${contentType}" isn't HTML — likely a JS-only SPA shell that needs server-side rendering for SEO.`,
      res.status,
      responseTimeMs,
    );
  }

  let html: string;
  try {
    html = await res.text();
  } catch (err) {
    return emptyResult(
      url,
      "error",
      `Failed to read response body: ${err instanceof Error ? err.message : String(err)}`,
      res.status,
      responseTimeMs,
    );
  }

  const resolvedUrl = res.url || url;
  const contentLengthBytes = html.length;

  return parseHtmlIntoResult({
    url: resolvedUrl,
    html,
    contentLengthBytes,
    httpStatus: res.status,
    responseTimeMs,
  });
}

// ---------------------------------------------------------------------------
// parseHtmlIntoResult
//
// Cheerio-based HTML parser shared by the native-fetch and Firecrawl
// paths. Takes the already-fetched HTML string + the response metadata
// and returns the same SiteCrawlResult shape either tier produces.
// Async because the sitemap.xml / robots.txt side-probes run from here.
// ---------------------------------------------------------------------------
async function parseHtmlIntoResult(args: {
  url: string;
  html: string;
  contentLengthBytes: number;
  httpStatus: number;
  responseTimeMs: number;
}): Promise<SiteCrawlResult> {
  const { url: resolvedUrl, html, contentLengthBytes, httpStatus, responseTimeMs } = args;
  const $ = cheerio.load(html);

  // Meta + head
  const title = readText($("head > title").first()) || null;
  const description =
    $('head meta[name="description"]').attr("content")?.trim() || null;
  const canonical =
    $('head link[rel="canonical"]').attr("href")?.trim() || null;
  const robotsMeta =
    $('head meta[name="robots"]').attr("content")?.trim() || null;
  const viewport =
    $('head meta[name="viewport"]').attr("content")?.trim() || null;
  const lang = $("html").attr("lang")?.trim() || null;
  const charset = inferCharset($);

  // Headings
  const h1s = $("h1");
  const h1Count = h1s.length;
  const h1FirstText = h1Count > 0 ? readText(h1s.first()) : null;
  const h2Count = $("h2").length;

  // Words in body — strip scripts/styles before counting
  const $body = $("body").clone();
  $body.find("script,style,noscript,svg,template").remove();
  const bodyText = $body.text().replace(/\s+/g, " ").trim();
  const bodyWordCount = bodyText ? bodyText.split(" ").length : 0;

  // Images
  const images = $("img");
  let imagesMissingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt == null || alt.trim() === "") imagesMissingAlt += 1;
  });

  // Links — classify by hostname
  const targetHost = safeHostname(resolvedUrl);
  let internalLinkCount = 0;
  let externalLinkCount = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
    try {
      const u = new URL(href, resolvedUrl);
      if (u.hostname === targetHost) internalLinkCount += 1;
      else externalLinkCount += 1;
    } catch {
      internalLinkCount += 1;
    }
  });

  // Structured data
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    if (!raw) return;
    try {
      const json = JSON.parse(raw);
      collectSchemaTypes(json, schemaTypes);
    } catch {
      // Malformed JSON-LD — skip silently.
    }
  });

  // Social + favicon
  const hasOpenGraph = $('head meta[property^="og:"]').length > 0;
  const hasTwitterCard = $('head meta[name^="twitter:"]').length > 0;
  const hasFavicon =
    $('head link[rel="icon"], head link[rel="shortcut icon"]').length > 0;

  // Side probes — sitemap.xml and robots.txt.
  const [hasSitemapXml, hasRobotsTxt] = await Promise.all([
    headProbe(new URL("/sitemap.xml", resolvedUrl).toString()),
    headProbe(new URL("/robots.txt", resolvedUrl).toString()),
  ]);

  return {
    status: "ok",
    errorMessage: null,
    resolvedUrl,
    httpStatus,
    responseTimeMs,
    contentLengthBytes,
    isHttps: new URL(resolvedUrl).protocol === "https:",
    title,
    titleLength: title?.length ?? 0,
    description,
    descriptionLength: description?.length ?? 0,
    canonical,
    robotsMeta,
    viewport,
    lang,
    charset,
    h1Count,
    h1FirstText,
    h2Count,
    bodyWordCount,
    imageCount: images.length,
    imagesMissingAlt,
    internalLinkCount,
    externalLinkCount,
    schemaTypes: Array.from(new Set(schemaTypes)),
    hasOpenGraph,
    hasTwitterCard,
    hasFavicon,
    hasSitemapXml,
    hasRobotsTxt,
  };
}

// ---------------------------------------------------------------------------
// Scoring
//
// crawlScore() returns 0..100 using the same weights the page-audit
// tier uses, plus a few extras (Open Graph, structured data, sitemap,
// favicon). Used by buildSeoSignal when DataForSEO returns null so the
// SEO card always renders a real number derived from observable signals.
// ---------------------------------------------------------------------------

export function crawlScore(c: SiteCrawlResult): number {
  if (c.status !== "ok") {
    // Reachability failures bottom out at low scores so operators know
    // there's a structural problem to fix before optimization matters.
    return c.status === "blocked" ? 35 : c.status === "non_html" ? 30 : 20;
  }
  let score = 100;
  // HTTPS — non-HTTPS is a hard ranking penalty in 2026.
  if (!c.isHttps) score -= 18;
  // Title
  if (!c.title) score -= 12;
  else if (c.titleLength < 30) score -= 6;
  else if (c.titleLength > 65) score -= 3;
  // Meta description
  if (!c.description) score -= 8;
  else if (c.descriptionLength < 110) score -= 4;
  else if (c.descriptionLength > 165) score -= 3;
  // Canonical
  if (!c.canonical) score -= 5;
  // H1
  if (c.h1Count === 0) score -= 8;
  else if (c.h1Count > 1) score -= 4;
  // Images / alt
  if (c.imagesMissingAlt > 0) {
    score -= Math.min(8, c.imagesMissingAlt);
  }
  // Thin content
  if (c.bodyWordCount < 200) score -= 8;
  else if (c.bodyWordCount < 400) score -= 4;
  // Internal links
  if (c.internalLinkCount < 5) score -= 5;
  else if (c.internalLinkCount < 10) score -= 2;
  // Structured data — bonus for presence; small penalty for absence on a
  // property site (AI engines lean on ApartmentComplex / LocalBusiness
  // schema to confirm entity identity).
  if (c.schemaTypes.length === 0) score -= 6;
  // Open Graph — required for any modern share preview.
  if (!c.hasOpenGraph) score -= 4;
  // Viewport meta — mobile rendering
  if (!c.viewport) score -= 4;
  // Discoverability probes
  if (!c.hasSitemapXml) score -= 4;
  if (!c.hasRobotsTxt) score -= 3;
  // Favicon — small bonus deduction; cosmetic but commonly missing
  if (!c.hasFavicon) score -= 1;
  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Findings — convert crawl result into actionable quick-wins for the
// audit synthesizer. Each finding is specific (names the failing field,
// references the observed value, prescribes the fix).
// ---------------------------------------------------------------------------

export interface CrawlFinding {
  id: string;
  title: string;
  detail: string;
}

export function crawlFindings(c: SiteCrawlResult): CrawlFinding[] {
  const out: CrawlFinding[] = [];
  if (c.status !== "ok") {
    out.push({
      id: "qw-crawl-unreachable",
      title:
        c.status === "blocked"
          ? "Homepage is blocking our crawler"
          : c.status === "non_html"
            ? "Homepage isn't serving HTML"
            : "Homepage was unreachable",
      detail:
        c.errorMessage ??
        "We couldn't fetch the homepage. Verify it returns 200 from an unauthenticated browser session and isn't behind a login.",
    });
    return out;
  }
  if (!c.isHttps) {
    out.push({
      id: "qw-crawl-https",
      title: "Enable HTTPS",
      detail:
        "Site is being served over HTTP. Search engines down-rank non-HTTPS pages and modern browsers flag them as 'Not Secure', which kills click-through from search results.",
    });
  }
  if (!c.title) {
    out.push({
      id: "qw-crawl-no-title",
      title: "Homepage is missing a <title> tag",
      detail:
        "Without a <title>, Google synthesizes one from page content — almost always worse than what you'd write yourself. Set it to '{Property name} — {city} {neighborhood} apartments' (50-60 chars).",
    });
  } else if (c.titleLength < 30) {
    out.push({
      id: "qw-crawl-short-title",
      title: `Lengthen homepage <title> (currently ${c.titleLength} chars)`,
      detail: `Current: "${c.title}". Google prefers 50-60 characters with the brand name + the primary keyword.`,
    });
  } else if (c.titleLength > 65) {
    out.push({
      id: "qw-crawl-long-title",
      title: `Trim homepage <title> — ${c.titleLength} chars (Google truncates around 60)`,
      detail: `Current: "${c.title.slice(0, 80)}…". The part after ~60 chars gets cut off in the SERP.`,
    });
  }
  if (!c.description) {
    out.push({
      id: "qw-crawl-no-desc",
      title: "Homepage is missing a meta description",
      detail:
        "Google falls back to a snippet from page content — usually a navigation list. Write a 140-160 char description focused on the property's strongest selling point.",
    });
  } else if (c.descriptionLength < 110) {
    out.push({
      id: "qw-crawl-short-desc",
      title: `Meta description is ${c.descriptionLength} chars — too short`,
      detail: `"${c.description.slice(0, 110)}". Aim for 140-160 chars: brand + key amenity + a number ("from $1,995", "5 min to campus").`,
    });
  } else if (c.descriptionLength > 165) {
    out.push({
      id: "qw-crawl-long-desc",
      title: `Meta description is ${c.descriptionLength} chars — Google will truncate`,
      detail:
        "Anything past ~160 chars is dropped from the SERP snippet. Move the most important phrase to the front.",
    });
  }
  if (!c.canonical) {
    out.push({
      id: "qw-crawl-no-canonical",
      title: "Homepage is missing a canonical URL",
      detail:
        "Without <link rel='canonical'>, Google has to guess which version is authoritative when query strings or trailing slashes vary. Set canonical to the bare homepage URL.",
    });
  }
  if (c.h1Count === 0) {
    out.push({
      id: "qw-crawl-no-h1",
      title: "Homepage has no <h1> tag",
      detail:
        "Google leans heavily on the H1 to confirm what the page is about. Add an H1 that names the property + the primary value prop.",
    });
  } else if (c.h1Count > 1) {
    out.push({
      id: "qw-crawl-multi-h1",
      title: `Homepage has ${c.h1Count} <h1> tags — should be exactly one`,
      detail: c.h1FirstText
        ? `First H1: "${c.h1FirstText.slice(0, 80)}". Multiple H1s split topical authority.`
        : "Multiple H1s split topical authority — use one H1 and switch the others to H2.",
    });
  }
  if (c.imagesMissingAlt > 0) {
    out.push({
      id: "qw-crawl-no-alt",
      title: `Add alt text to ${c.imagesMissingAlt} image${c.imagesMissingAlt === 1 ? "" : "s"}`,
      detail: `${c.imagesMissingAlt} of ${c.imageCount} <img> tags are missing alt attributes. Hurts accessibility and image-search ranking. ~10-15 min of work.`,
    });
  }
  if (c.bodyWordCount < 300) {
    out.push({
      id: "qw-crawl-thin-content",
      title: `Homepage has ${c.bodyWordCount} words of text — under Google's preference`,
      detail:
        "Property pages under ~300 words tend to be classified as 'thin content' and struggle to rank against longer competitor pages. Add a neighborhood paragraph, amenity list, or FAQ.",
    });
  }
  if (c.internalLinkCount < 10) {
    out.push({
      id: "qw-crawl-thin-internal",
      title: `Only ${c.internalLinkCount} internal link${c.internalLinkCount === 1 ? "" : "s"} on the homepage`,
      detail:
        "Internal links distribute link-authority across the site. 10-25 is the typical sweet spot — link to floor plans, amenities, neighborhood, tour booking.",
    });
  }
  if (c.schemaTypes.length === 0) {
    out.push({
      id: "qw-crawl-no-schema",
      title: "No structured data (schema.org) detected on the homepage",
      detail:
        "Add ApartmentComplex or LocalBusiness JSON-LD with address, telephone, units, and price range. This is what ChatGPT and Perplexity read to confirm the property's identity — without it, AI engines hedge or skip you entirely.",
    });
  }
  if (!c.hasOpenGraph) {
    out.push({
      id: "qw-crawl-no-og",
      title: "Missing Open Graph tags",
      detail:
        "When the URL gets shared on social or in messengers, no preview card renders. Add og:title, og:description, og:image at minimum.",
    });
  }
  if (!c.viewport) {
    out.push({
      id: "qw-crawl-no-viewport",
      title: "Missing mobile viewport meta tag",
      detail:
        "Without <meta name='viewport' content='width=device-width'>, mobile browsers render the desktop layout at 1/3 size. Add the viewport meta — Google's mobile-friendly test will fail otherwise.",
    });
  }
  if (!c.hasSitemapXml) {
    out.push({
      id: "qw-crawl-no-sitemap",
      title: "No sitemap.xml detected at /sitemap.xml",
      detail:
        "Sitemaps tell crawlers which URLs to index. Without one, Google relies on link-following alone — slow for new sites. Most CMS platforms generate one automatically; verify and link it from robots.txt.",
    });
  }
  if (!c.hasRobotsTxt) {
    out.push({
      id: "qw-crawl-no-robots",
      title: "No robots.txt detected at /robots.txt",
      detail:
        "robots.txt declares which paths crawlers may access + points to your sitemap. Default behavior (no file) opens everything to everyone — fine, but missing the sitemap reference costs you crawl efficiency.",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeUrl(input: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const u = new URL(withScheme);
    return u.toString();
  } catch {
    return null;
  }
}

function readText($el: cheerio.Cheerio<unknown>): string {
  return ($el as unknown as { text(): string }).text().trim();
}

function inferCharset($: cheerio.CheerioAPI): string | null {
  const direct = $("head meta[charset]").attr("charset");
  if (direct) return direct.trim().toLowerCase();
  const httpEquiv = $('head meta[http-equiv="Content-Type"]').attr("content");
  if (httpEquiv) {
    const match = httpEquiv.match(/charset=([^;]+)/i);
    if (match) return match[1].trim().toLowerCase();
  }
  return null;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// Recursively pulls @type values out of a parsed JSON-LD blob. Handles
// arrays of multiple types ("@type": ["Organization", "LocalBusiness"])
// and @graph wrappers.
function collectSchemaTypes(node: unknown, out: string[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectSchemaTypes(item, out);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  if (typeof t === "string") out.push(t);
  else if (Array.isArray(t)) {
    for (const item of t) if (typeof item === "string") out.push(item);
  }
  // @graph wraps multiple top-level entities
  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"] as unknown[]) collectSchemaTypes(item, out);
  }
}

async function headProbe(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": CRAWL_USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(HEAD_PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
