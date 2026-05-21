/**
 * Site intelligence orchestrator.
 *
 * Given an `orgId`, runs the four-stage ingest pipeline and upserts the
 * `SiteIntelligence` row:
 *
 *   1. Resolve the org's primary root URL (DomainBinding → first domain →
 *      first Property with a websiteUrl). If none, we skip the crawl/scrape
 *      stages but still write a row so downstream code knows we tried.
 *   2. Firecrawl /crawl up to 50 pages. Persist sitemapUrls + a compact
 *      `pages` JSON array (url, title, description, markdown, h1, h2[],
 *      wordCount). Skipped if crawledAt < 24h ago and `force` is false.
 *   3. Firecrawl /scrape the homepage + up to 5 cornerstone pages for
 *      higher-fidelity copy. Merged into the same pages array.
 *   4. Perplexity Sonar research on the company. Persist `research`.
 *   5. Claude Haiku brand-voice extractor over crawled copy + research.
 *      Persist `brandVoice`.
 *
 * Every stage is wrapped in try/catch — a Firecrawl outage should not block
 * the Perplexity research, and a Perplexity outage should not block the
 * voice extractor (which can still run on crawled copy alone).
 *
 * Cost-log per stage to stdout; final stats land in `lastRunStats` JSON.
 *
 * Server-only — uses Prisma and SDKs that don't ship to the browser.
 */

import "server-only";
import { prisma } from "@/lib/db";
import {
  crawl,
  scrape,
  isFirecrawlConfigured,
  type FirecrawlScrapePage,
} from "@/lib/intelligence/firecrawl";
import {
  researchCompany,
  type CompanyResearch,
} from "@/lib/intelligence/perplexity-research";
import { extractBrandVoice } from "@/lib/intelligence/voice-extract";

const CRAWL_PAGE_LIMIT = 50;
const SCRAPE_CORNERSTONE_LIMIT = 5;
const CRAWL_FRESHNESS_MS = 24 * 60 * 60 * 1000; // 24h
const PAGE_MARKDOWN_CAP = 8_000; // chars per page when persisting JSON
const SITEMAP_CAP = 500;

// Cornerstone-page heuristic. We pick URLs whose path matches one of these
// segments, in priority order. Real-estate-specific (about, neighborhoods,
// amenities, communities) plus generic SaaS pages.
const CORNERSTONE_PATTERNS: Array<RegExp> = [
  /\/about(?:\/|$)/i,
  /\/our[-_]?story(?:\/|$)/i,
  /\/communit(?:y|ies)(?:\/|$)/i,
  /\/neighborhood/i,
  /\/amenit/i,
  /\/floor[-_]?plans?(?:\/|$)/i,
  /\/contact(?:\/|$)/i,
  /\/pricing(?:\/|$)/i,
];

export interface IngestPersistedPage {
  url: string;
  title: string;
  description: string;
  markdown: string;
  h1: string;
  h2: string[];
  wordCount: number;
}

export interface IngestRunStats {
  pagesIngested: number;
  pagesCrawled: number;
  pagesScraped: number;
  costUsd: number;
  durationMs: number;
  rootUrl: string | null;
  stages: {
    crawl: StageStatus;
    cornerstoneScrape: StageStatus;
    research: StageStatus;
    voice: StageStatus;
  };
  errors: Array<{ stage: string; error: string }>;
}

type StageStatus =
  | "ok"
  | "skipped:not-configured"
  | "skipped:no-root-url"
  | "skipped:fresh"
  | "error";

export interface IngestResult {
  ok: boolean;
  orgId: string;
  stats: IngestRunStats;
}

/**
 * Main orchestrator. Returns the stats blob; the SiteIntelligence row is
 * upserted as a side effect.
 */
export async function ingestOrgIntelligence(args: {
  orgId: string;
  force?: boolean;
}): Promise<IngestResult> {
  const { orgId, force = false } = args;
  const startedAt = Date.now();

  const stats: IngestRunStats = {
    pagesIngested: 0,
    pagesCrawled: 0,
    pagesScraped: 0,
    costUsd: 0,
    durationMs: 0,
    rootUrl: null,
    stages: {
      crawl: "ok",
      cornerstoneScrape: "ok",
      research: "ok",
      voice: "ok",
    },
    errors: [],
  };

  // ---- Stage 0: load org + resolve root URL ------------------------------
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      domains: {
        select: { hostname: true, isPrimary: true },
      },
      tenantSiteConfig: {
        select: { siteTitle: true },
      },
      properties: {
        where: { websiteUrl: { not: null } },
        select: { websiteUrl: true },
        take: 1,
      },
      siteIntelligence: {
        select: {
          crawledAt: true,
          pages: true,
          sitemapUrls: true,
          research: true,
          brandVoice: true,
        },
      },
    },
  });
  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  const rootUrl = deriveRootUrl(org);
  stats.rootUrl = rootUrl;

  // Existing data — used to preserve fields whose stage gets skipped this run.
  const existing = org.siteIntelligence;
  let persistedPages: IngestPersistedPage[] = Array.isArray(existing?.pages)
    ? (existing!.pages as unknown as IngestPersistedPage[])
    : [];
  let sitemapUrls: string[] = Array.isArray(existing?.sitemapUrls)
    ? existing!.sitemapUrls
    : [];
  let research: CompanyResearch | null = isCompanyResearch(existing?.research)
    ? (existing!.research as unknown as CompanyResearch)
    : null;
  let brandVoice: string | null = existing?.brandVoice ?? null;

  let crawledAt: Date | null = existing?.crawledAt ?? null;
  let researchedAt: Date | null = null;
  let brandVoiceAt: Date | null = null;

  // ---- Stage 1: Firecrawl /crawl ----------------------------------------
  const crawlFresh =
    !force &&
    crawledAt &&
    Date.now() - crawledAt.getTime() < CRAWL_FRESHNESS_MS;

  if (!rootUrl) {
    stats.stages.crawl = "skipped:no-root-url";
    stats.stages.cornerstoneScrape = "skipped:no-root-url";
  } else if (!isFirecrawlConfigured()) {
    stats.stages.crawl = "skipped:not-configured";
    stats.stages.cornerstoneScrape = "skipped:not-configured";
  } else if (crawlFresh) {
    stats.stages.crawl = "skipped:fresh";
    stats.stages.cornerstoneScrape = "skipped:fresh";
  } else {
    try {
      const crawlRes = await crawl({ url: rootUrl, limit: CRAWL_PAGE_LIMIT });
      if (crawlRes.ok) {
        const fresh = compactPages(crawlRes.data.pages);
        persistedPages = mergePages(persistedPages, fresh);
        sitemapUrls = Array.from(
          new Set(crawlRes.data.pages.map((p) => normalizeUrl(p)).filter(Boolean) as string[]),
        ).slice(0, SITEMAP_CAP);
        stats.pagesCrawled = crawlRes.data.pages.length;
        stats.costUsd += crawlRes.costUsd;
        crawledAt = new Date();
      } else {
        stats.stages.crawl = "error";
        stats.errors.push({ stage: "crawl", error: crawlRes.error });
      }
    } catch (err) {
      stats.stages.crawl = "error";
      stats.errors.push({
        stage: "crawl",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ---- Stage 2: cornerstone /scrape -----------------------------------
    try {
      const cornerstoneUrls = pickCornerstoneUrls(rootUrl, sitemapUrls);
      const targets = [rootUrl, ...cornerstoneUrls].slice(
        0,
        SCRAPE_CORNERSTONE_LIMIT + 1,
      );

      for (const target of targets) {
        const scraped = await scrape({
          url: target,
          formats: ["markdown", "html"],
        });
        if (scraped.ok) {
          const page = compactSinglePage(scraped.data);
          if (page) {
            persistedPages = mergePages(persistedPages, [page]);
            stats.pagesScraped += 1;
          }
          stats.costUsd += scraped.costUsd;
        } else if (!scraped.skipped) {
          stats.errors.push({
            stage: "cornerstoneScrape",
            error: `${target}: ${scraped.error}`,
          });
        }
      }
    } catch (err) {
      stats.stages.cornerstoneScrape = "error";
      stats.errors.push({
        stage: "cornerstoneScrape",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ---- Stage 3: Perplexity research --------------------------------------
  const domainForResearch = rootUrl ? extractHostname(rootUrl) : null;
  const orgNameForResearch =
    org.tenantSiteConfig?.siteTitle?.trim() || org.name;

  if (!domainForResearch) {
    stats.stages.research = "skipped:no-root-url";
  } else if (!process.env.PERPLEXITY_API_KEY) {
    stats.stages.research = "skipped:not-configured";
  } else {
    try {
      const researchRes = await researchCompany({
        orgName: orgNameForResearch,
        domain: domainForResearch,
      });
      if (researchRes.ok) {
        research = researchRes.data;
        stats.costUsd += researchRes.costUsd;
        researchedAt = new Date();
      } else {
        stats.stages.research = researchRes.skipped
          ? "skipped:not-configured"
          : "error";
        if (!researchRes.skipped) {
          stats.errors.push({ stage: "research", error: researchRes.error });
        }
      }
    } catch (err) {
      stats.stages.research = "error";
      stats.errors.push({
        stage: "research",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ---- Stage 4: Claude voice extract -------------------------------------
  if (!process.env.ANTHROPIC_API_KEY) {
    stats.stages.voice = "skipped:not-configured";
  } else if (persistedPages.length === 0 && !research) {
    // Nothing to extract from — skip rather than call Claude on noise.
    stats.stages.voice = "skipped:no-root-url";
  } else {
    try {
      const voiceRes = await extractBrandVoice({
        orgName: orgNameForResearch,
        pages: persistedPages.map((p) => ({
          url: p.url,
          markdown: p.markdown,
        })),
        research,
      });
      if (voiceRes.ok) {
        brandVoice = voiceRes.brandVoice;
        stats.costUsd += voiceRes.costUsd;
        brandVoiceAt = new Date();
      } else {
        stats.stages.voice = voiceRes.skipped
          ? "skipped:not-configured"
          : "error";
        if (!voiceRes.skipped) {
          stats.errors.push({ stage: "voice", error: voiceRes.error });
        }
      }
    } catch (err) {
      stats.stages.voice = "error";
      stats.errors.push({
        stage: "voice",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ---- Persist -----------------------------------------------------------
  stats.pagesIngested = persistedPages.length;
  stats.durationMs = Date.now() - startedAt;

  await prisma.siteIntelligence.upsert({
    where: { orgId },
    create: {
      orgId,
      rootUrl,
      sitemapUrls,
      pages: persistedPages as unknown as object,
      research: (research as unknown as object) ?? undefined,
      brandVoice,
      crawledAt,
      researchedAt,
      brandVoiceAt,
      lastRunStats: stats as unknown as object,
    },
    update: {
      rootUrl: rootUrl ?? undefined,
      sitemapUrls,
      pages: persistedPages as unknown as object,
      // Only overwrite research/brandVoice when we actually got a new
      // value this run — keep previous data if the stage was skipped/erred.
      ...(researchedAt
        ? {
            research: research as unknown as object,
            researchedAt,
          }
        : {}),
      ...(brandVoiceAt
        ? {
            brandVoice,
            brandVoiceAt,
          }
        : {}),
      ...(crawledAt ? { crawledAt } : {}),
      lastRunStats: stats as unknown as object,
    },
  });

  console.log(
    `[site-ingest] orgId=${orgId} pages=${stats.pagesIngested} ` +
      `crawl=${stats.stages.crawl} research=${stats.stages.research} ` +
      `voice=${stats.stages.voice} cost=$${stats.costUsd.toFixed(4)} ` +
      `(${stats.durationMs}ms)`,
  );

  return { ok: stats.errors.length === 0, orgId, stats };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface OrgForIngest {
  domains: Array<{ hostname: string; isPrimary: boolean }>;
  properties: Array<{ websiteUrl: string | null }>;
}

function deriveRootUrl(org: OrgForIngest): string | null {
  const primary = org.domains.find((d) => d.isPrimary);
  if (primary?.hostname) return ensureHttps(primary.hostname);
  if (org.domains[0]?.hostname) return ensureHttps(org.domains[0].hostname);
  const propUrl = org.properties[0]?.websiteUrl;
  if (propUrl) return propUrl;
  return null;
}

function ensureHttps(hostname: string): string {
  const trimmed = hostname.trim().replace(/^https?:\/\//i, "");
  return `https://${trimmed}`;
}

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function normalizeUrl(page: FirecrawlScrapePage): string | null {
  const raw = page.metadata?.sourceURL ?? page.url;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function compactPages(
  pages: FirecrawlScrapePage[],
): IngestPersistedPage[] {
  return pages
    .map((p) => compactSinglePage(p))
    .filter((p): p is IngestPersistedPage => p !== null);
}

function compactSinglePage(
  page: FirecrawlScrapePage,
): IngestPersistedPage | null {
  const url = normalizeUrl(page);
  if (!url) return null;
  const markdown = (page.markdown ?? "").trim().slice(0, PAGE_MARKDOWN_CAP);
  const { h1, h2 } = extractHeadings(page.markdown ?? "");
  const wordCount = markdown.length
    ? markdown.split(/\s+/).filter(Boolean).length
    : 0;
  return {
    url,
    title: (page.metadata?.title ?? "").toString().trim().slice(0, 200),
    description: (page.metadata?.description ?? "")
      .toString()
      .trim()
      .slice(0, 500),
    markdown,
    h1,
    h2,
    wordCount,
  };
}

function extractHeadings(markdown: string): { h1: string; h2: string[] } {
  if (!markdown) return { h1: "", h2: [] };
  const lines = markdown.split("\n");
  let h1 = "";
  const h2: string[] = [];
  for (const line of lines) {
    if (!h1) {
      const m1 = line.match(/^#\s+(.+?)\s*$/);
      if (m1) {
        h1 = m1[1].trim().slice(0, 200);
        continue;
      }
    }
    const m2 = line.match(/^##\s+(.+?)\s*$/);
    if (m2) h2.push(m2[1].trim().slice(0, 200));
    if (h2.length >= 20) break;
  }
  return { h1, h2 };
}

function mergePages(
  existing: IngestPersistedPage[],
  fresh: IngestPersistedPage[],
): IngestPersistedPage[] {
  const byUrl = new Map<string, IngestPersistedPage>();
  for (const p of existing) byUrl.set(p.url, p);
  for (const p of fresh) byUrl.set(p.url, p); // fresh overwrites stale
  return Array.from(byUrl.values()).slice(0, CRAWL_PAGE_LIMIT);
}

function pickCornerstoneUrls(rootUrl: string, urls: string[]): string[] {
  const rootHost = extractHostname(rootUrl);
  if (!rootHost) return [];
  const same = urls.filter((u) => extractHostname(u) === rootHost);

  const chosen: string[] = [];
  for (const pattern of CORNERSTONE_PATTERNS) {
    const hit = same.find(
      (u) => pattern.test(u) && !chosen.includes(u) && u !== rootUrl,
    );
    if (hit) chosen.push(hit);
    if (chosen.length >= SCRAPE_CORNERSTONE_LIMIT) break;
  }
  return chosen;
}

function isCompanyResearch(value: unknown): value is CompanyResearch {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.companyOverview === "string" &&
    typeof v.competitiveLandscape === "string"
  );
}
