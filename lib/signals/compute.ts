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
): Promise<ProspectComputeResult> {
  if (scope.kind === "prospect") {
    return computeProspectSignals(scope.prospectAuditId, scope.domain);
  }
  return computeRealTenantSignals(scope);
}

// ---------------------------------------------------------------------------
// PROSPECT
// ---------------------------------------------------------------------------

async function computeProspectSignals(
  prospectAuditId: string,
  domain: string,
): Promise<ProspectComputeResult> {
  const startedAt = Date.now();
  const key = scopeKey({ kind: "prospect", prospectAuditId, domain });
  const brandName = brandNameFromDomain(domain);
  const url = `https://${domain}`;

  // Five major fan-outs in parallel via allSettled — single source failure
  // never throws.
  //
  // 2026-05-29: site crawl added as a free fallback signal source so the
  // SEO surface never renders "Awaiting data" on a reachable site. Runs
  // ALWAYS (not just when DataForSEO fails) — buildSeoSignal merges the
  // two, preferring DataForSEO where present and falling back to the
  // crawl-derived score + findings otherwise.
  const [seoFanout, aeoResult, repResult, crawlResult, aioResult] =
    await Promise.allSettled([
      runSeoFanout(domain, url),
      runAeoFanout(brandName, domain, prospectAuditId),
      runProspectReputation({ brandName, domain, prospectAuditId }),
      crawlSite(url),
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
  };
}

async function runAeoFanout(
  brandName: string,
  domain: string,
  /** 2026-05-29: pass the audit id so each engine call tags its
   *  ApiUsage row to the audit. Lets /admin/costs answer "this audit
   *  cost $0.08 across 16 LLM calls." */
  prospectAuditId: string | null,
): Promise<AeoFanout> {
  const prompts = buildProspectPrompts(brandName, domain);
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
  const citedEngines: string[] = [];
  const uncitedEngines: string[] = [];

  await Promise.all(
    enabled.map(async (engine) => {
      const sources = new Set<string>();
      let citedAny = false;
      const results = await Promise.allSettled(
        prompts.map((p) => engine.runPrompt(p, { prospectAuditId })),
      );
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        if (r.value.skipped) continue;
        const parse = parseCitation(r.value.responseText, {
          name: brandName,
          websiteUrl: domain,
        });
        if (parse.status === "CITED") {
          citedAny = true;
          if (parse.citedUrl) sources.add(parse.citedUrl);
        } else if (parse.status === "COMPETITOR_CITED") {
          for (const c of parse.competitorsCited) competitorsCited.add(c);
        }
      }
      const key = engineKeyMap[engine.engine];
      if (key) byEngine[key] = { cited: citedAny, sources: Array.from(sources) };
      const pretty = prettyName[engine.engine] ?? engine.engine;
      (citedAny ? citedEngines : uncitedEngines).push(pretty);
    }),
  );

  const enginesChecked = enabled.length;
  const citationsFound = citedEngines.length;
  const citationRate =
    enginesChecked > 0 ? round(citationsFound / enginesChecked, 2) : 0;

  return {
    byEngine,
    enginesChecked,
    citationsFound,
    citationRate,
    competitorsCited: Array.from(competitorsCited).slice(0, 10),
    citedEngines,
    uncitedEngines,
  };
}

function buildProspectPrompts(brandName: string, domain: string): string[] {
  return [
    `Tell me about ${brandName}. Is it a good place to live?`,
    `What do residents say about ${brandName}? Any common complaints?`,
    `${brandName} reviews — what are people saying online?`,
    `What are the amenities and pricing like at ${brandName}?`,
    `Should I rent at ${brandName} or look elsewhere? (${domain})`,
  ];
}

function buildAeoSignal(data: AeoFanout): AeoSignal | null {
  if (data.enginesChecked === 0) return null;
  // 0..1 citation rate → 0..100 score. 20-pt floor so a wholly uncited
  // brand doesn't read as zero — there's always SOME defensive moat.
  const score = clampScore(Math.round(20 + data.citationRate * 80));
  return {
    enginesChecked: data.enginesChecked,
    citationsFound: data.citationsFound,
    citationRate: data.citationRate,
    byEngine: data.byEngine,
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
