import "server-only";

import {
  COMPUTE_VERSION,
  scopeKey,
  type AeoSignal,
  type ReputationSignal,
  type SeoSignal,
  type SignalScope,
  type SignalSnapshot,
  type TrafficSignal,
} from "./types";
import {
  fetchRankedKeywords,
  fetchLighthouseScores,
  fetchBacklinksSummary,
  fetchInstantPageAudit,
  fetchSerpAiSummary,
  type BacklinksSummary,
  type DomainRankedKeyword,
  type InstantPageAudit,
  type LighthouseScores,
} from "@/lib/seo/dataforseo";
import { ALL_ENGINES } from "@/lib/aeo/engines";
import { parseCitation } from "@/lib/aeo/parse";
import { stripChatbotMarkdown } from "@/lib/chatbot/strip-markdown";
import {
  runProspectReputation,
  brandNameFromDomain,
  type ProspectMention,
} from "@/lib/audit/reputation-prospect";
import {
  crawlSite,
  crawlScore,
  type SiteCrawlResult,
} from "@/lib/audit/site-crawl";
import {
  derivePropertyLocale,
  type PropertyLocale,
} from "@/lib/audit/derive-locale";
import { computeRealTenantSignals } from "./real-tenant";

// ----------------------------------------------------------------------------
// computeSignals — daily snapshot for a scope.
//   PROSPECT: real DataforSEO + AEO + reputation fan-out.
//   TENANT:   real data — reputation/leads/chatbot/traffic/SEO/AEO pulled from
//             the operator's own tables (lib/signals/real-tenant.ts). Sections
//             with no underlying data return null (honest empty state), never
//             fabricated. The old mock generator is retired.
// ----------------------------------------------------------------------------

export type ProspectComputeResult = SignalSnapshot & {
  /** Raw provider data — prospect scope only. Stripped before persisting.
   * The audit run route forwards this to synthesizeAudit() so we don't
   * re-fetch when building findings. */
  __provider?: {
    brandName: string;
    domain: string;
    rankedKeywords: DomainRankedKeyword[] | null;
    lighthouse: LighthouseScores | null;
    pageAudit: InstantPageAudit | null;
    backlinks: BacklinksSummary | null;
    /** Direct site crawl — runs always (free, no API key). Synthesizer
     *  reads this to generate findings when DataForSEO Labs returned
     *  nothing. */
    siteCrawl: SiteCrawlResult | null;
    mentions: ProspectMention[];
    aeoCompetitorsCited: string[];
    aeoCitedEngines: string[];
    aeoUncitedEngines: string[];
    /** Locale derived from the crawl for discovery prompts. Null city =
     *  branded-only fallback ran. */
    aeoLocale: PropertyLocale | null;
    /** True when unbranded discovery prompts ran (city derivable). */
    aeoDiscoveryRan: boolean;
    /** Verbatim answer excerpts, one per engine × prompt-kind
     *  (2026-08-14). Persisted onto findings as the receipts feed. */
    aeoReceipts: AeoReceipt[];
    /** Ranked competitor mentions from discovery answers (2026-08-14). */
    aeoCompetitorsRanked: Array<{ name: string; mentions: number }>;
    /** You-vs-tracked-rival per engine (slice 13). */
    aeoRival: AeoRivalResult | null;
    /** Google AI Overview captured for one branded query during the
     *  audit run. Powers the verbatim "this is what Google AI says
     *  about you today" section on the result page. Null when
     *  DataForSEO is not configured or the query returned no AI
     *  Overview block. */
    googleAiOverview: {
      query: string;
      summary: string;
      citedUrls: string[];
    } | null;
  };
};

export async function computeSignals(
  scope: SignalScope,
  opts?: {
    /** Explicitly tracked rival (2026-08-14 slice 13, prospect only). */
    rivalName?: string | null;
    /** The property name the prospect typed into the form (prospect only).
     *  MUST be threaded through: the engine prompts, the reputation scan,
     *  and the Google AI Overview query are all built from it. Falling back
     *  to the domain silently audits the wrong entity whenever the two
     *  differ — which is most of the time (Adam 2026-08-19: a "Warwick"
     *  audit asked every engine about "Leasestack"). */
    brandName?: string | null;
  },
): Promise<ProspectComputeResult> {
  if (scope.kind === "prospect") {
    return computeProspectSignals(
      scope.prospectAuditId,
      scope.domain,
      opts?.rivalName ?? null,
      opts?.brandName ?? null,
    );
  }
  return computeRealTenantSignals(scope);
}

// ---------------------------------------------------------------------------
// PROSPECT
// ---------------------------------------------------------------------------

/**
 * The name every prospect fan-out is keyed off: engine prompts, the
 * reputation mention scan, and the Google AI Overview query.
 *
 * What the prospect typed wins. Deriving it from the domain scans a
 * different company whenever the two differ — a "Warwick" audit on
 * leasestack.co asked all four engines about "Leasestack", and the report
 * rendered those answers under the Warwick name (Adam 2026-08-19).
 */
export function resolveProspectBrandName(
  supplied: string | null | undefined,
  domain: string,
): string {
  const trimmed = supplied?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : brandNameFromDomain(domain);
}

async function computeProspectSignals(
  prospectAuditId: string,
  domain: string,
  rivalName: string | null = null,
  suppliedBrandName: string | null = null,
): Promise<ProspectComputeResult> {
  const startedAt = Date.now();
  const key = scopeKey({ kind: "prospect", prospectAuditId, domain });
  const brandName = resolveProspectBrandName(suppliedBrandName, domain);
  const url = `https://${domain}`;

  // Five major fan-outs in parallel via allSettled — single source failure
  // never throws.
  //
  // 2026-05-29: site crawl added as a free fallback signal source so the
  // SEO surface never renders "Awaiting data" on a reachable site. Runs
  // ALWAYS (not just when DataForSEO fails) — buildSeoSignal merges the
  // two, preferring DataForSEO where present and falling back to the
  // crawl-derived score + findings otherwise.
  //
  // 2026-08-13: the AEO fan-out now CHAINS on the crawl — discovery
  // prompts need a city derived from the homepage. Everything else still
  // runs concurrently; AEO waits only on the crawl (+ ~1s locale call),
  // and the LLM fan-out is the long pole anyway.
  const crawlPromise = crawlSite(url);
  let derivedLocale: PropertyLocale | null = null;
  const aeoPromise = (async () => {
    const crawl = await crawlPromise.catch(() => null);
    derivedLocale = await derivePropertyLocale(crawl, prospectAuditId);
    return runAeoFanout(
      brandName,
      domain,
      prospectAuditId,
      derivedLocale,
      rivalName,
    );
  })();
  const [seoFanout, aeoResult, repResult, crawlResult, aioResult] =
    await Promise.allSettled([
      runSeoFanout(domain, url),
      aeoPromise,
      runProspectReputation({ brandName, domain, prospectAuditId }),
      crawlPromise,
      // Google AI Overview for the branded query. One DataForSEO SERP
      // advanced call (~$0.005). Captures verbatim Google AI summary +
      // cited URLs. Renders as the "what Google AI says about you" card
      // on the result page. Wrapped in allSettled so a DataForSEO outage
      // never tanks the audit.
      fetchSerpAiSummary(
        { query: brandName },
        { prospectAuditId, surface: "audit" },
      ),
    ]);

  const seoData =
    seoFanout.status === "fulfilled" ? seoFanout.value : emptySeoFanout();
  const aeoData =
    aeoResult.status === "fulfilled" ? aeoResult.value : emptyAeoFanout();
  const crawlData: SiteCrawlResult | null =
    crawlResult.status === "fulfilled" ? crawlResult.value : null;
  const rep =
    repResult.status === "fulfilled"
      ? repResult.value
      : {
          totalMentions: 0,
          mentions: [] as ProspectMention[],
          sentimentMix: { positive: 0, neutral: 1, negative: 0 },
          avgRating: null,
          errors: {},
        };
  // Unwrap the SERP AI Overview call. Discriminated-union shape from
  // dataforseo.ts: { ok: true, data, costUsd } | { ok: false, ... }.
  // Anything but a plain ok=true with non-empty summary is treated as
  // "no AI Overview for this query" so the renderer collapses
  // gracefully instead of showing an empty card.
  const aioData =
    aioResult.status === "fulfilled" &&
    "ok" in aioResult.value &&
    aioResult.value.ok &&
    aioResult.value.data.summary.trim().length > 0
      ? {
          query: aioResult.value.data.query,
          summary: aioResult.value.data.summary,
          citedUrls: aioResult.value.data.citedUrls,
        }
      : null;

  const seo: SeoSignal | null = buildSeoSignal(seoData, crawlData);
  const traffic: TrafficSignal | null = buildTrafficSignal(seoData.rankedKeywords);
  const aeo: AeoSignal | null = buildAeoSignal(aeoData);
  const reputation: ReputationSignal | null = buildReputationSignal(rep);

  const overallScore = weightedOverall({ seo, aeo, reputation, traffic });

  return {
    capturedOn: todayUtcDateString(),
    scopeKey: key,
    seo,
    aeo,
    reputation,
    chatbot: null,
    leads: null,
    traffic,
    overallScore,
    deltas7d: null,
    computeMs: Date.now() - startedAt,
    computeVersion: COMPUTE_VERSION,
    __provider: {
      brandName,
      domain,
      rankedKeywords: seoData.rankedKeywords,
      lighthouse: seoData.lighthouse,
      pageAudit: seoData.pageAudit,
      backlinks: seoData.backlinks,
      siteCrawl: crawlData,
      mentions: rep.mentions,
      aeoCompetitorsCited: aeoData.competitorsCited,
      aeoCitedEngines: aeoData.citedEngines,
      aeoUncitedEngines: aeoData.uncitedEngines,
      aeoLocale: derivedLocale,
      aeoDiscoveryRan: aeoData.discoveryRan,
      aeoReceipts: aeoData.receipts,
      aeoCompetitorsRanked: aeoData.competitorsRanked,
      aeoRival: aeoData.rival,
      googleAiOverview: aioData,
    },
  };
}

// ---- SEO fan-out ---------------------------------------------------------

type SeoFanout = {
  rankedKeywords: DomainRankedKeyword[] | null;
  lighthouse: LighthouseScores | null;
  pageAudit: InstantPageAudit | null;
  backlinks: BacklinksSummary | null;
};

function emptySeoFanout(): SeoFanout {
  return { rankedKeywords: null, lighthouse: null, pageAudit: null, backlinks: null };
}

async function runSeoFanout(domain: string, url: string): Promise<SeoFanout> {
  const [rk, lh, bl, pa] = await Promise.allSettled([
    fetchRankedKeywords({ domain, limit: 200 }),
    fetchLighthouseScores({ url }),
    fetchBacklinksSummary({ target: domain }),
    fetchInstantPageAudit({ url }),
  ]);

  const unwrap = <T>(
    r: PromiseSettledResult<{ ok: boolean; data?: T }>,
  ): T | null => {
    if (r.status !== "fulfilled") return null;
    const v = r.value as { ok: boolean; data?: T };
    return v.ok && v.data ? v.data : null;
  };

  return {
    rankedKeywords: unwrap<DomainRankedKeyword[]>(rk),
    lighthouse: unwrap<LighthouseScores>(lh),
    backlinks: unwrap<BacklinksSummary>(bl),
    pageAudit: unwrap<InstantPageAudit>(pa),
  };
}

function buildSeoSignal(
  data: SeoFanout,
  crawl: SiteCrawlResult | null = null,
): SeoSignal | null {
  // Adam 2026-05-29: include pageAudit AND direct-crawl in the null check.
  // The page-audit endpoint (instant_pages) hits the live URL and works
  // for ANY domain — even small recently-launched properties that
  // DataForSEO Labs (ranked_keywords + backlinks_summary) hasn't indexed
  // yet. The site crawl is a free zero-API fallback that hits the URL
  // directly via fetch — works on any reachable site. With both layered
  // in, "Awaiting data" only renders when the site itself is unreachable.
  if (
    !data.rankedKeywords &&
    !data.lighthouse &&
    !data.backlinks &&
    !data.pageAudit &&
    (!crawl || crawl.status !== "ok")
  ) {
    return null;
  }
  const ranked = data.rankedKeywords ?? [];
  const organicKeywords = ranked.length;
  const positions = ranked
    .map((k) => k.ranked_serp_element?.serp_item?.rank_absolute)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const top10Count = positions.filter((p) => p <= 10).length;
  const avgPosition =
    positions.length > 0
      ? round(positions.reduce((a, b) => a + b, 0) / positions.length, 1)
      : null;
  const estimatedTraffic = estimateTraffic(ranked);

  const lhSeo = data.lighthouse?.seo ?? null;
  const top10Ratio = organicKeywords > 0 ? top10Count / organicKeywords : 0;
  const backlinkTier = backlinkScore(data.backlinks);
  // Page-audit tier: same scale as the other components (0..100), derived
  // from how many of the canonical on-page checks pass. Used when the
  // DataForSEO Labs endpoints (ranked_keywords / backlinks_summary) have
  // nothing on the domain — small recently-launched sites still get a
  // real SEO score from the page-audit signal alone.
  const pageTier = pageAuditScore(data.pageAudit);

  let score = 0;
  let weight = 0;
  if (lhSeo != null) {
    score += lhSeo * 0.4;
    weight += 0.4;
  }
  // Only count organic-rank component when DataForSEO actually returned
  // ranked-keyword data. If rankedKeywords came back null, leaving the
  // contribution at 0 with weight 0.3 would systematically tank the SEO
  // score on every site DataForSEO hasn't indexed yet — which is most
  // sub-100-unit properties. Conditional weight so the average is honest.
  if (data.rankedKeywords) {
    score += Math.min(top10Ratio * 200, 100) * 0.3;
    weight += 0.3;
  }
  if (data.backlinks) {
    score += backlinkTier * 0.3;
    weight += 0.3;
  }
  if (data.pageAudit) {
    score += pageTier * 0.3;
    weight += 0.3;
  }
  // Direct site-crawl tier — runs always, contributes whenever the crawl
  // succeeded. Weight intentionally lower than DataForSEO components
  // (0.2 vs 0.3-0.4) because the crawl is a single-page observation
  // and shouldn't dominate a real domain-wide signal when DataForSEO
  // has data. But on small/new sites where DataForSEO is empty, this
  // becomes the sole signal and carries the full average.
  if (crawl && crawl.status === "ok") {
    score += crawlScore(crawl) * 0.2;
    weight += 0.2;
  }
  const finalScore = Math.round(weight > 0 ? score / weight : 0);

  return {
    organicKeywords,
    top10Count,
    avgPosition,
    estimatedTraffic,
    lighthouseScore: lhSeo,
    backlinks: data.backlinks?.backlinks ?? 0,
    referringDomains: data.backlinks?.referring_domains ?? 0,
    topMovers: [],
    score: clampScore(finalScore),
  };
}

function backlinkScore(b: BacklinksSummary | null): number {
  if (!b) return 50;
  const rd = b.referring_domains ?? 0;
  if (rd >= 500) return 95;
  if (rd >= 100) return 80;
  if (rd >= 30) return 65;
  if (rd >= 10) return 50;
  return 35;
}

// On-page tier score — 100 = perfect on-page hygiene, deductions per
// known on-page red flag from DataForSEO's instant_pages audit. The
// list below mirrors the quick-wins the synthesizer surfaces so the
// score and the action items stay in lockstep.
function pageAuditScore(p: InstantPageAudit | null): number {
  if (!p?.meta) return 50;
  const meta = p.meta;
  let score = 100;
  if (!meta.is_https) score -= 18;
  if (meta.duplicate_title) score -= 8;
  if (meta.duplicate_description) score -= 6;
  if (meta.title == null || meta.title.length === 0) score -= 12;
  else if (meta.title.length < 30) score -= 6;
  else if (meta.title.length > 65) score -= 4;
  if (meta.no_image_alt != null && meta.no_image_alt > 0) score -= 5;
  if (meta.broken_links != null && meta.broken_links > 0) {
    score -= Math.min(10, meta.broken_links * 2);
  }
  if (
    meta.internal_links_count != null &&
    meta.internal_links_count < 10
  ) {
    score -= 4;
  }
  return Math.max(0, Math.min(100, score));
}

// Sistrix 2024 CTR-by-position (multifamily-adjusted).
const CTR_BY_POSITION: Record<number, number> = {
  1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.07,
  6: 0.05, 7: 0.04, 8: 0.03, 9: 0.025, 10: 0.02,
};

function ctrFor(position: number): number {
  if (position <= 0) return 0;
  if (position <= 10) return CTR_BY_POSITION[position] ?? 0.02;
  if (position <= 20) return 0.012;
  if (position <= 30) return 0.005;
  return 0.001;
}

function estimateTraffic(ranked: DomainRankedKeyword[]): number {
  let total = 0;
  for (const k of ranked) {
    const vol = k.keyword_data?.keyword_info?.search_volume ?? 0;
    const pos = k.ranked_serp_element?.serp_item?.rank_absolute ?? 0;
    if (!vol || !pos) continue;
    total += vol * ctrFor(pos);
  }
  return Math.round(total);
}

function buildTrafficSignal(
  ranked: DomainRankedKeyword[] | null,
): TrafficSignal | null {
  const traffic = estimateTraffic(ranked ?? []);
  let score = 30;
  if (traffic > 10_000) score = 90;
  else if (traffic > 1_000) score = 70;
  else if (traffic > 100) score = 50;
  return {
    sessions: traffic,
    source: "dataforseo_estimate",
    bounceRate: null,
    topPages: [],
    score: clampScore(score),
  };
}

// ---- AEO fan-out ---------------------------------------------------------

type AeoFanout = {
  byEngine: AeoSignal["byEngine"];
  enginesChecked: number;
  citationsFound: number;
  citationRate: number;
  competitorsCited: string[];
  citedEngines: string[];
  uncitedEngines: string[];
  /** True when unbranded discovery prompts ran. False = branded-only
   *  fallback (city not derivable) — legacy semantics preserved. */
  discoveryRan: boolean;
  /** Verbatim receipts (2026-08-14): one curated answer excerpt per
   *  engine × prompt-kind. The fan-out already holds every responseText
   *  in memory — persisting a capped excerpt is free and is the single
   *  highest-trust artifact the report can show. */
  receipts: AeoReceipt[];
  /** Ranked competitor mentions across discovery answers (2026-08-14).
   *  Same {name, mentions} shape as the tenant report's topCompetitors.
   *  Additive alongside the flat competitorsCited list. */
  competitorsRanked: Array<{ name: string; mentions: number }>;
  /** You-vs-them for the lead's explicitly tracked rival (slice 13).
   *  Null when the lead didn't name one. */
  rival: AeoRivalResult | null;
};

/** Per-engine you-vs-rival verdict for an explicitly tracked competitor. */
export type AeoRivalResult = {
  name: string;
  byEngine: Array<{
    engine: AeoReceipt["engine"];
    /** You were named/cited in a discovery answer on this engine. */
    you: boolean;
    /** The rival was named in a discovery answer on this engine. */
    rival: boolean;
  }>;
};

function emptyAeoFanout(): AeoFanout {
  return {
    byEngine: {},
    enginesChecked: 0,
    citationsFound: 0,
    citationRate: 0,
    competitorsCited: [],
    citedEngines: [],
    uncitedEngines: [],
    discoveryRan: false,
    receipts: [],
    competitorsRanked: [],
    rival: null,
  };
}

export type AuditPrompt = { text: string; kind: "branded" | "discovery" };

/** Prompts per engine in the audit fan-out — 5 in both modes (2 branded
 *  + 3 discovery, or 5 branded legacy). Exported so the report's "N live
 *  API calls" trust copy can't drift from the fan-out. */
export const AUDIT_PROMPTS_PER_ENGINE = 5;

/** One verbatim AI-answer excerpt, persisted onto findings so the report
 *  can show "here is literally what ChatGPT said." Additive JSONB field —
 *  legacy audits simply lack it and render unchanged. */
export type AeoReceipt = {
  engine: "CHATGPT" | "PERPLEXITY" | "CLAUDE" | "GEMINI";
  kind: AuditPrompt["kind"];
  /** The exact prompt we asked the engine. */
  prompt: string;
  /** Markdown-stripped answer excerpt, capped ~500 chars on a word
   *  boundary. */
  excerpt: string;
};

const RECEIPT_EXCERPT_CAP = 500;

/** Strip markdown + cap for a persisted receipt excerpt. Pure — exported
 *  for tests. Reuses the chatbot markdown stripper, then removes the
 *  link/heading syntax LLM answers add that chat replies don't. */
export function toReceiptExcerpt(text: string): string {
  let out = stripChatbotMarkdown(text);
  // [label](url) → label ; bare heading markers ; leftover table pipes.
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  out = out.replace(/^#{1,6}\s+/gm, "");
  out = out.replace(/^\|.*\|$/gm, " ");
  out = out.replace(/\s+/g, " ").trim();
  if (out.length <= RECEIPT_EXCERPT_CAP) return out;
  const cut = out.slice(0, RECEIPT_EXCERPT_CAP);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 300 ? lastSpace : RECEIPT_EXCERPT_CAP).trimEnd()}…`;
}

/**
 * Pick the single most informative answer per prompt-kind for one engine.
 * Pure — exported for tests.
 *
 * Discovery: an answer that recommends the brand (CITED) is the proof
 * receipt; an answer that names competitors (COMPETITOR_CITED) is the
 * gap receipt; anything else only if that's all we have. Branded:
 * prefer an answer that cites the domain (real awareness), then any
 * name-mention, then the longest answer.
 */
export function curateEngineReceipts(
  engine: AeoReceipt["engine"],
  items: Array<{
    kind: AuditPrompt["kind"];
    prompt: string;
    text: string;
    parse: ReturnType<typeof parseCitation>;
  }>,
): AeoReceipt[] {
  const rank = (it: (typeof items)[number]): number => {
    if (it.kind === "discovery") {
      if (it.parse.status === "CITED") return 0;
      if (it.parse.status === "COMPETITOR_CITED") return 1;
      return 2;
    }
    if (it.parse.status === "CITED" && it.parse.citedUrl) return 0;
    if (it.parse.status === "CITED") return 1;
    return 2;
  };
  const receipts: AeoReceipt[] = [];
  for (const kind of ["discovery", "branded"] as const) {
    const pool = items
      .filter((i) => i.kind === kind && i.text.trim().length > 0)
      .sort((a, b) => rank(a) - rank(b) || b.text.length - a.text.length);
    const best = pool[0];
    if (!best) continue;
    const excerpt = toReceiptExcerpt(best.text);
    if (!excerpt) continue;
    receipts.push({ engine, kind, prompt: best.prompt, excerpt });
  }
  return receipts;
}

/**
 * Classify one engine's parsed answers into the verdict trio
 * (2026-08-13 discovery split). Pure — exported for tests.
 *
 *  - discovered: named OR domain-cited in a DISCOVERY answer. This is
 *    the number that matters — "does AI recommend you when a renter
 *    doesn't already know your name."
 *  - aware: domain-cited in a BRANDED answer. A name echo counts for
 *    NOTHING — every engine parrots the name it was handed (that echo
 *    was the tautology this replaces).
 *  - legacyCited: old semantics (name echo counts), used only in the
 *    branded-only fallback so those audits behave exactly like before.
 *  - Competitor names are collected from DISCOVERY answers only — a
 *    branded answer's capitalized nouns are review themes, not rivals.
 */
export function classifyEngineAnswers(
  answers: Array<{
    kind: AuditPrompt["kind"];
    parse: ReturnType<typeof parseCitation>;
  }>,
  opts?: {
    /** Branded-only fallback: also collect competitors from branded
     *  answers (legacy behavior, junk-prone — kept for back-compat). */
    brandedCompetitors?: boolean;
  },
): {
  discovered: boolean;
  aware: boolean;
  legacyCited: boolean;
  sources: string[];
  competitors: string[];
} {
  let discovered = false;
  let aware = false;
  let legacyCited = false;
  const sources = new Set<string>();
  const competitors = new Set<string>();

  for (const { kind, parse } of answers) {
    if (kind === "discovery") {
      if (parse.status === "CITED") {
        discovered = true;
        if (parse.citedUrl) sources.add(parse.citedUrl);
      } else if (parse.status === "COMPETITOR_CITED") {
        for (const c of parse.competitorsCited) competitors.add(c);
      }
    } else {
      if (parse.status === "CITED") {
        legacyCited = true;
        if (parse.citedUrl) {
          aware = true;
          sources.add(parse.citedUrl);
        }
      } else if (
        opts?.brandedCompetitors &&
        parse.status === "COMPETITOR_CITED"
      ) {
        for (const c of parse.competitorsCited) competitors.add(c);
      }
    }
  }

  return {
    discovered,
    aware,
    legacyCited,
    sources: Array.from(sources),
    competitors: Array.from(competitors),
  };
}

async function runAeoFanout(
  brandName: string,
  domain: string,
  /** 2026-05-29: pass the audit id so each engine call tags its
   *  ApiUsage row to the audit. Lets /admin/costs answer "this audit
   *  cost $0.08 across 16 LLM calls." */
  prospectAuditId: string | null,
  /** 2026-08-13: crawl-derived locale. A derivable city switches the
   *  fan-out to 2 branded + 3 discovery prompts; otherwise branded-only
   *  fallback with legacy semantics. */
  locale: PropertyLocale | null,
  /** Explicitly tracked rival (slice 13) — parsed as its own citation
   *  target against every discovery answer. Free: no extra API calls. */
  rivalName: string | null = null,
): Promise<AeoFanout> {
  const prompts = buildProspectPrompts(brandName, domain, locale);
  const discoveryRan = prompts.some((p) => p.kind === "discovery");
  const enabled = ALL_ENGINES.filter((e) => e.isConfigured());
  if (enabled.length === 0 || prompts.length === 0) {
    return emptyAeoFanout();
  }

  type EngineMap = NonNullable<AeoSignal["byEngine"]>;
  const engineKeyMap: Record<string, keyof EngineMap> = {
    CLAUDE: "claude",
    CHATGPT: "chatgpt",
    GEMINI: "gemini",
    PERPLEXITY: "perplexity",
  };
  const prettyName: Record<string, string> = {
    CLAUDE: "Claude",
    CHATGPT: "ChatGPT",
    GEMINI: "Gemini",
    PERPLEXITY: "Perplexity",
  };

  const byEngine: EngineMap = {};
  const competitorsCited = new Set<string>();
  const competitorCounts = new Map<string, number>();
  const citedEngines: string[] = [];
  const uncitedEngines: string[] = [];
  const receipts: AeoReceipt[] = [];
  const rivalByEngine: AeoRivalResult["byEngine"] = [];
  const rival = rivalName?.trim() || null;

  await Promise.all(
    enabled.map(async (engine) => {
      const results = await Promise.allSettled(
        prompts.map((p) => engine.runPrompt(p.text, { prospectAuditId })),
      );
      const answers: Array<{
        kind: AuditPrompt["kind"];
        prompt: string;
        text: string;
        parse: ReturnType<typeof parseCitation>;
      }> = [];
      results.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        if (r.value.skipped) return;
        answers.push({
          kind: prompts[i].kind,
          prompt: prompts[i].text,
          text: r.value.responseText,
          parse: parseCitation(r.value.responseText, {
            name: brandName,
            websiteUrl: domain,
          }),
        });
      });
      receipts.push(...curateEngineReceipts(engine.engine, answers));
      // Ranked competitor tally (2026-08-14): answer-level mentions
      // across DISCOVERY answers only — branded answers' capitalized
      // nouns are review themes, not rivals. Counts rivals from CITED
      // answers too (an answer naming the brand AND five competitors
      // must not contribute zero).
      for (const a of answers) {
        if (a.kind !== "discovery") continue;
        for (const c of a.parse.competitorsCited) {
          competitorCounts.set(c, (competitorCounts.get(c) ?? 0) + 1);
        }
      }
      const verdict = classifyEngineAnswers(answers, {
        brandedCompetitors: !discoveryRan,
      });
      for (const c of verdict.competitors) competitorsCited.add(c);

      // Explicit rival tracking (slice 13): parse each discovery answer
      // against the rival as its own citation target. Name match = the
      // rival was recommended where you weren't asked about.
      if (rival && discoveryRan) {
        const rivalNamed = answers.some(
          (a) =>
            a.kind === "discovery" &&
            parseCitation(a.text, { name: rival }).status === "CITED",
        );
        rivalByEngine.push({
          engine: engine.engine as AeoReceipt["engine"],
          you: verdict.discovered,
          rival: rivalNamed,
        });
      }

      // `cited` stays the back-compat verdict field: discovered when
      // discovery ran, legacy name-echo semantics otherwise.
      const citedAny = discoveryRan ? verdict.discovered : verdict.legacyCited;
      const key = engineKeyMap[engine.engine];
      if (key) {
        byEngine[key] = discoveryRan
          ? {
              cited: citedAny,
              sources: verdict.sources,
              discovered: verdict.discovered,
              aware: verdict.aware,
            }
          : { cited: citedAny, sources: verdict.sources };
      }
      const pretty = prettyName[engine.engine] ?? engine.engine;
      (citedAny ? citedEngines : uncitedEngines).push(pretty);
    }),
  );

  const enginesChecked = enabled.length;
  const citationsFound = citedEngines.length;
  const citationRate =
    enginesChecked > 0 ? round(citationsFound / enginesChecked, 2) : 0;

  // Stable render order: engine display order, discovery receipt first.
  const engineOrder: Record<AeoReceipt["engine"], number> = {
    CHATGPT: 0,
    PERPLEXITY: 1,
    CLAUDE: 2,
    GEMINI: 3,
  };
  receipts.sort(
    (a, b) =>
      engineOrder[a.engine] - engineOrder[b.engine] ||
      (a.kind === "discovery" ? 0 : 1) - (b.kind === "discovery" ? 0 : 1),
  );

  return {
    byEngine,
    enginesChecked,
    citationsFound,
    citationRate,
    competitorsCited: Array.from(competitorsCited).slice(0, 10),
    citedEngines,
    uncitedEngines,
    discoveryRan,
    receipts,
    competitorsRanked: [...competitorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, mentions]) => ({ name, mentions })),
    rival:
      rival && rivalByEngine.length > 0
        ? {
            name: rival,
            byEngine: rivalByEngine.sort(
              (a, b) =>
                ["CHATGPT", "PERPLEXITY", "CLAUDE", "GEMINI"].indexOf(a.engine) -
                ["CHATGPT", "PERPLEXITY", "CLAUDE", "GEMINI"].indexOf(b.engine),
            ),
          }
        : null,
  };
}

/**
 * 2026-08-13 discovery split. With a derivable city: 2 branded prompts
 * (awareness / defensive moat) + 3 DISCOVERY prompts that never contain
 * the brand — "does AI recommend you to a renter who doesn't know you."
 * Without a city: the original 5 branded prompts, unchanged (legacy
 * fallback; the UI says the location wasn't derivable).
 *
 * Exported for tests — discovery prompts must never contain the brand.
 */
export function buildProspectPrompts(
  brandName: string,
  domain: string,
  locale: PropertyLocale | null,
): AuditPrompt[] {
  const branded: AuditPrompt[] = [
    {
      text: `Tell me about ${brandName}. Is it a good place to live?`,
      kind: "branded",
    },
    {
      text: `Should I rent at ${brandName} or look elsewhere? (${domain})`,
      kind: "branded",
    },
  ];

  const city = locale?.city?.trim();
  if (!city) {
    return [
      branded[0],
      {
        text: `What do residents say about ${brandName}? Any common complaints?`,
        kind: "branded",
      },
      {
        text: `${brandName} reviews — what are people saying online?`,
        kind: "branded",
      },
      {
        text: `What are the amenities and pricing like at ${brandName}?`,
        kind: "branded",
      },
      branded[1],
    ];
  }

  const category = locale?.category || "apartments";
  const where = locale?.region ? `${city}, ${locale.region}` : city;
  const discovery: AuditPrompt[] = [
    { text: `What are the best ${category} in ${where}?`, kind: "discovery" },
    locale?.amenity
      ? {
          text: `Looking for ${category} in ${city} with ${locale.amenity}. What do you recommend?`,
          kind: "discovery",
        }
      : {
          text: `What are the top-rated ${category} in ${where} right now?`,
          kind: "discovery",
        },
    locale?.neighborhood
      ? {
          text: `Where should I live near ${locale.neighborhood} in ${city}? Recommend specific buildings.`,
          kind: "discovery",
        }
      : {
          text: `I'm moving to ${where} and looking for ${category}. Which specific buildings should I tour?`,
          kind: "discovery",
        },
  ];

  return [...branded, ...discovery];
}

function buildAeoSignal(data: AeoFanout): AeoSignal | null {
  if (data.enginesChecked === 0) return null;
  // 0..1 rate → 0..100 score. 20-pt floor so a wholly invisible brand
  // doesn't read as zero. Since 2026-08-13 the rate counts DISCOVERED
  // engines (when discovery ran) instead of branded name echo — the
  // echo made this ~always 1.0 and the AEO pillar read 100 for every
  // property.
  const score = clampScore(Math.round(20 + data.citationRate * 80));
  return {
    enginesChecked: data.enginesChecked,
    citationsFound: data.citationsFound,
    citationRate: data.citationRate,
    byEngine: data.byEngine,
    discoveryRan: data.discoveryRan,
    score,
  };
}

// ---- Reputation ----------------------------------------------------------

function buildReputationSignal(rep: {
  totalMentions: number;
  mentions: ProspectMention[];
  sentimentMix: { positive: number; neutral: number; negative: number };
  avgRating: number | null;
}): ReputationSignal | null {
  if (rep.totalMentions === 0) {
    return {
      totalMentions: 0,
      avgRating: null,
      sentimentMix: { positive: 0, neutral: 1, negative: 0 },
      newNegative7d: 0,
      topThemes: [],
      score: 60,
    };
  }
  const { positive, negative } = rep.sentimentMix;
  const base = 70 + positive * 30 - negative * 60;
  const score = clampScore(Math.round(base));

  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const negTells =
    /(avoid|scam|worst|horrible|terrible|nightmare|do not rent)/;
  const newNeg7d = rep.mentions.filter((m) => {
    if (!m.publishedAt) return false;
    const t = new Date(m.publishedAt).getTime();
    if (!Number.isFinite(t)) return false;
    if (Date.now() - t > sevenDays) return false;
    return negTells.test(`${m.title ?? ""} ${m.snippet}`.toLowerCase());
  }).length;

  return {
    totalMentions: rep.totalMentions,
    avgRating: rep.avgRating,
    sentimentMix: rep.sentimentMix,
    newNegative7d: newNeg7d,
    topThemes: [],
    score,
  };
}

// ---- Helpers -------------------------------------------------------------

const SECTION_WEIGHTS = {
  seo: 30,
  aeo: 20,
  reputation: 20,
  traffic: 5,
} as const;

function weightedOverall(s: {
  seo: SeoSignal | null;
  aeo: AeoSignal | null;
  reputation: ReputationSignal | null;
  traffic: TrafficSignal | null;
}): number {
  let weight = 0;
  let acc = 0;
  for (const k of Object.keys(SECTION_WEIGHTS) as Array<keyof typeof SECTION_WEIGHTS>) {
    const section = s[k];
    if (!section) continue;
    const w = SECTION_WEIGHTS[k];
    acc += section.score * w;
    weight += w;
  }
  if (weight === 0) return 0;
  return Math.round(acc / weight);
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function todayUtcDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
