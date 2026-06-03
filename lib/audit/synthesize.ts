import "server-only";

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { logUsage } from "@/lib/cost-tracker/log";
import type {
  AeoSignal,
  ReputationSignal,
  SeoSignal,
  SignalSnapshot,
  TrafficSignal,
} from "@/lib/signals/types";
import type {
  BacklinksSummary,
  DomainRankedKeyword,
  InstantPageAudit,
  LighthouseScores,
} from "@/lib/seo/dataforseo";
import type { ProspectMention } from "./reputation-prospect";
import {
  crawlFindings,
  type SiteCrawlResult,
} from "./site-crawl";
import { computeDps, type DpsResult } from "./scoring";
import { computeRecommendations, type ActionItem } from "./recommendations";
import type { QuizAnswers } from "./quiz-questions";
import {
  runOnPageAuditChecks,
  type OnPageAuditResult,
} from "@/lib/aeo/onpage-audit";

// ----------------------------------------------------------------------------
// Synthesizer. Turns the raw provider responses + rolled-up SignalSnapshot
// into the audit findings/claudeSummary the viewer renders.
//
// All findings are derived from REAL signals (numbers from the scan, named
// audit failures from Lighthouse, actual mention URLs from reputation).
// No Claude-invented bullets.
// ----------------------------------------------------------------------------

export type Finding = { id: string; title: string; detail?: string };

/** Per-section "why this score". Short bullet list of the supporting
 *  numbers behind the section's score. Surfaced on the audit viewer so
 *  the prospect understands what's driving each number instead of
 *  staring at a score they can't trace.
 *  Adam 2026-05-29 feedback: "we don't understand why the SEO and the
 *  AEO and the reputation and the traffic are the numbers that they
 *  are." Every entry here is derived from the real signal. No fluff. */
export type SectionDetail = {
  /** One-line headline (rendered first, slightly larger). */
  headline?: string | null;
  /** Bullet supporting points. Up to 4 per section. */
  points: string[];
};

export type SectionDetails = {
  seo: SectionDetail | null;
  aeo: SectionDetail | null;
  reputation: SectionDetail | null;
  traffic: SectionDetail | null;
};

/** Per-engine AEO citation row. Renders the premium "Where AI search
 *  engines name you" card on the result page with the official engine
 *  mark next to each. Real data — derived from the AEO LLM fan-out we
 *  already run inside computeSignals. */
export type AeoEngineRow = {
  engine: "CHATGPT" | "PERPLEXITY" | "CLAUDE" | "GEMINI";
  cited: boolean;
  /** URLs the engine surfaced when it cited the brand. Empty when not
   *  cited or when the engine doesn't return source URLs. */
  sources: string[];
};

/** AEO Page Health — 8-check on-page audit run against the prospect's
 *  homepage. Surfaces the same scorecard the AEO Boost portal feature
 *  ships, so prospects see exactly what a paying customer would see
 *  for one of their pages. */
export type AeoOnPageFindings = {
  url: string;
  score: number;
  checks: OnPageAuditResult["checks"];
  excerpt: string;
};

/** Google AI Overview captured for the brand's name query. Verbatim. */
export type GoogleAiOverviewFindings = {
  query: string;
  summary: string;
  citedUrls: string[];
  /** True when the prospect's own domain is in citedUrls. */
  cited: boolean;
};

/** Detect-don't-ask conversion stack scan. Regex pass over the crawled
 *  homepage HTML for known vendor hosts. Builds trust by showing the
 *  prospect what we OBSERVED on their site, not what the quiz said. */
export type DetectedStack = {
  /** Vendor slug → display name + tagline + whether we found it. */
  rows: Array<{
    key: string;
    label: string;
    category: "chatbot" | "popups" | "pixel" | "analytics" | "crm";
    detected: boolean;
    /** Short note for the row. "Detected: Intercom widget" or "Not loaded". */
    note: string;
  }>;
};

/** Schema markup gap — what JSON-LD types are present on the homepage
 *  and what high-AEO-signal types are missing. Surfaced as a side-by-
 *  side "Present / Missing" card. */
export type SchemaGap = {
  present: string[];
  /** Curated list of high-AEO-signal schema types (FAQPage,
   *  ApartmentComplex, LocalBusiness, etc.) NOT present on the page. */
  missing: string[];
};

export type SynthesizedFindings = {
  quickWins: Finding[];
  risks: Finding[];
  opportunities: Finding[];
  // Mentions persist onto the audit findings JSON so the viewer renders the
  // real reputation list (real URLs, real dates).
  mentions: ProspectMention[];
  /** Per-section reasoning. Populated by synthesize.ts so the audit
   *  viewer can render "why" copy under each ScoreCard. Legacy 4-section
   *  shape kept for any downstream consumer; superseded by `dps.pillars`
   *  on the result page. */
  sectionDetails: SectionDetails;
  /** Digital Performance Score. 6-pillar shape, post-cap. The result
   *  page renders from this. Adam 2026-06-01. */
  dps: DpsResult;
  /** Ordered recommendation cards. Each maps to a LeaseStack feature
   *  via `lib/audit/feature-catalog.ts`. */
  recommendations: ActionItem[];
  /** Premium AEO surface — per-engine citation rows with logos. Always
   *  emitted when AEO ran (every audit). Adam 2026-06-03. */
  aeoEngines?: AeoEngineRow[];
  /** Competitor names AI engines surfaced INSTEAD of the brand. Already
   *  collected by computeSignals; surfaced on findings so the result
   *  page renders the chip strip without re-deriving. */
  aeoCompetitorsCited?: string[];
  /** AEO Page Health 8-check on the homepage. Always emitted when we
   *  have crawled HTML. */
  aeoOnPage?: AeoOnPageFindings | null;
  /** Verbatim Google AI Overview for the brand's name query. Null when
   *  DataForSEO is unconfigured or Google didn't surface an AI Overview
   *  for the query. */
  googleAiOverview?: GoogleAiOverviewFindings | null;
  /** Detected conversion stack (chatbot, pixel, popups, analytics, CRM)
   *  from the crawled HTML. Builds trust vs the quiz answers. */
  detectedStack?: DetectedStack;
  /** Schema markup present + missing. */
  schemaGap?: SchemaGap;
};

export type ProviderData = {
  brandName: string;
  domain: string;
  rankedKeywords: DomainRankedKeyword[] | null;
  lighthouse: LighthouseScores | null;
  // Full Lighthouse audits map. Surfaced so we can name the failing audit
  // by id in the quick-wins copy ("document-title", "image-alt", etc.).
  lighthouseAudits: Record<string, { id?: string; title?: string; score?: number | null }> | null;
  pageAudit: InstantPageAudit | null;
  backlinks: BacklinksSummary | null;
  /** Direct site crawl. Runs always (free, no API key). Used by the
   *  synthesizer to generate quick-win findings when DataForSEO Labs
   *  returned nothing for the domain. */
  siteCrawl?: SiteCrawlResult | null;
  mentions: ProspectMention[];
  aeoCompetitorsCited: string[];
  aeoCitedEngines: string[];
  aeoUncitedEngines: string[];
  /** Google AI Overview captured during compute. Null when DataForSEO
   *  is unconfigured or the query returned no AI Overview. */
  googleAiOverview?: {
    query: string;
    summary: string;
    citedUrls: string[];
  } | null;
};

export async function synthesizeAudit(
  signals: SignalSnapshot,
  provider: ProviderData,
  /** Operator's quiz answers from the /audit lead-magnet flow. Null
   *  when the audit was started without the quiz (URL-only deep link). */
  quizAnswers: QuizAnswers | null = null,
): Promise<{
  findings: SynthesizedFindings;
  claudeSummary: string;
  sectionScores: Record<string, number | null>;
  /** Post-cap overall score. What the run route persists as
   *  ProspectAudit.overallScore so the legacy /admin views still
   *  surface the right number. */
  overallScore: number;
}> {
  // Adam 2026-05-29: preserve null so the viewer can render "Data
  // unavailable" instead of a misleading "0/100". Previously we
  // coerced null → 0 here, which made provider failures
  // indistinguishable from genuinely-zero scores.
  //
  // The Prisma column is `Json?` and the audit viewer's
  // SectionScores type uses `?: number` per key. So absent keys
  // round-trip cleanly through JSON serialization.
  const sectionScores: Record<string, number | null> = {
    seo: signals.seo?.score ?? null,
    aeo: signals.aeo?.score ?? null,
    reputation: signals.reputation?.score ?? null,
    traffic: signals.traffic?.score ?? null,
  };

  const quickWins: Finding[] = [];
  const risks: Finding[] = [];
  const opportunities: Finding[] = [];

  // ---- Quick wins. Only emit when the signal SAYS this is broken --------
  // 2026-05-29: expanded substantially. Every meaningful page-audit
  // signal turns into a named, specific action item. The point of the
  // /audit lead magnet is to give the prospect a concrete punch list,
  // not a vibe-y "your SEO could be better." Each finding either calls
  // out the exact failing field, the current value, and the fix. Or
  // doesn't render at all.
  const meta = provider.pageAudit?.meta;
  if (meta) {
    if (!meta.is_https) {
      quickWins.push({
        id: "qw-https",
        title: "Enable HTTPS",
        detail:
          "Site is being served over HTTP. Search engines down-rank non-HTTPS pages and modern browsers flag them as 'Not Secure', which kills the click-through from search results.",
      });
    }
    if (meta.title == null || meta.title.length === 0) {
      quickWins.push({
        id: "qw-no-title",
        title: "Homepage is missing a <title> tag",
        detail:
          "Without a <title>, Google synthesizes one from the page content. Almost always worse than what you'd write yourself. Set it to '{Property name}. {city} {neighborhood} apartments' or similar (50-60 chars).",
      });
    } else if (meta.title.length < 30) {
      quickWins.push({
        id: "qw-short-title",
        title: `Lengthen homepage <title> (currently ${meta.title.length} chars)`,
        detail: `Current title: "${meta.title}". Google prefers 50-60 characters with the brand name + the primary keyword. You're losing ~10 chars of click-bait real estate.`,
      });
    } else if (meta.title.length > 65) {
      quickWins.push({
        id: "qw-long-title",
        title: `Trim homepage <title>. ${meta.title.length} chars (Google truncates around 60)`,
        detail: `Current: "${meta.title.slice(0, 80)}…". Anything past ~60 chars gets cut off in the SERP, so the part after the ellipsis is wasted.`,
      });
    }
    if (meta.duplicate_title) {
      quickWins.push({
        id: "qw-dup-title",
        title: "Multiple pages share the same <title>",
        detail: meta.title
          ? `Pages reusing "${meta.title.slice(0, 80)}". Each page needs a unique title so Google can differentiate them and rank each on its own merit.`
          : "Multiple pages share the same <title>. Unique titles per page lift CTR and indexing.",
      });
    }
    if (meta.description == null || meta.description.length === 0) {
      quickWins.push({
        id: "qw-no-desc",
        title: "Homepage is missing a meta description",
        detail:
          "Google falls back to a snippet from page content. Usually a navigation list. Write a 140-160 char description focused on the property's strongest selling point.",
      });
    } else if (meta.description.length < 110) {
      quickWins.push({
        id: "qw-short-desc",
        title: `Meta description is ${meta.description.length} chars. Too short`,
        detail: `"${meta.description.slice(0, 110)}". Aim for 140-160 chars: brand + key amenity + a number ("from $1,995", "5 min to campus").`,
      });
    } else if (meta.description.length > 165) {
      quickWins.push({
        id: "qw-long-desc",
        title: `Meta description is ${meta.description.length} chars. Google will truncate`,
        detail:
          "Anything past ~160 chars is dropped from the SERP snippet. Move the most important phrase to the front.",
      });
    }
    if (meta.duplicate_description) {
      quickWins.push({
        id: "qw-dup-desc",
        title: "Multiple pages share the same meta description",
        detail:
          "Each page needs a unique 140-160 char description. Pages with duplicates can't rank for their own keywords.",
      });
    }
    if (!meta.canonical) {
      quickWins.push({
        id: "qw-no-canonical",
        title: "Homepage is missing a canonical URL",
        detail:
          "Without <link rel='canonical'>, Google has to guess which version is authoritative when query strings or trailing slashes vary. Set canonical to the bare homepage URL.",
      });
    }
    const h1Tags = meta.htags?.h1 ?? [];
    if (h1Tags.length === 0) {
      quickWins.push({
        id: "qw-no-h1",
        title: "Homepage has no <h1> tag",
        detail:
          "Google leans heavily on the H1 to confirm what the page is about. Add an H1 that names the property + the primary value prop ('Furnished apartments steps from campus').",
      });
    } else if (h1Tags.length > 1) {
      quickWins.push({
        id: "qw-multi-h1",
        title: `Homepage has ${h1Tags.length} <h1> tags. Should be exactly one`,
        detail: `Current H1s: ${h1Tags
          .slice(0, 3)
          .map((h) => `"${h.slice(0, 60)}"`)
          .join(", ")}. Multiple H1s split topical authority.`,
      });
    }
    if (meta.no_image_alt && meta.no_image_alt > 0) {
      quickWins.push({
        id: "qw-no-alt",
        title: `Add alt text to ${meta.no_image_alt} image${meta.no_image_alt === 1 ? "" : "s"}`,
        detail:
          "Missing alt attributes hurt accessibility scoring AND prevent the property from ranking in Google Images. ~10-15 min of work per page.",
      });
    }
    if (meta.broken_links && meta.broken_links > 0) {
      quickWins.push({
        id: "qw-broken-links",
        title: `Fix ${meta.broken_links} broken link${meta.broken_links === 1 ? "" : "s"} on the homepage`,
        detail:
          "Broken outbound or internal links signal low quality to crawlers and frustrate visitors. Run a link checker, fix the targets, redeploy.",
      });
    }
    if (meta.broken_resources && meta.broken_resources > 0) {
      quickWins.push({
        id: "qw-broken-resources",
        title: `${meta.broken_resources} broken resource${meta.broken_resources === 1 ? "" : "s"} on the homepage`,
        detail:
          "Missing images, CSS, or JS files load as 404s. They slow the page and tell Google the site isn't being maintained.",
      });
    }
    if (
      meta.internal_links_count != null &&
      meta.internal_links_count < 10
    ) {
      quickWins.push({
        id: "qw-thin-internal",
        title: `Only ${meta.internal_links_count} internal link${meta.internal_links_count === 1 ? "" : "s"} on the homepage`,
        detail:
          "Internal links distribute link-authority across the site. 10-25 is the typical sweet spot for a property homepage. Link to floor plans, amenities, neighborhood, tour booking.",
      });
    }
    if (
      meta.content?.plain_text_word_count != null &&
      meta.content.plain_text_word_count < 300
    ) {
      quickWins.push({
        id: "qw-thin-content",
        title: `Homepage has ${meta.content.plain_text_word_count} words of text. Under Google's preference`,
        detail:
          "Property pages under ~300 words tend to be classified as 'thin content' and struggle to rank against longer competitor pages. Add a neighborhood paragraph, amenity list, or FAQ.",
      });
    }
  }

  // Structured data. Schema.org / JSON-LD presence is a meaningful AEO
  // signal too (AI engines lean on schema to confirm entity identity).
  const schemaTypes = provider.pageAudit?.schema?.type ?? [];
  if (schemaTypes.length === 0 && provider.pageAudit) {
    quickWins.push({
      id: "qw-no-schema",
      title: "No structured data (schema.org) detected on the homepage",
      detail:
        "Add ApartmentComplex or LocalBusiness JSON-LD with address, telephone, units, and price range. This is what ChatGPT and Perplexity read to confirm the property's identity. Without it, AI engines hedge or skip you entirely.",
    });
  }

  // Direct site-crawl findings. Fired when DataForSEO Labs has nothing
  // on the domain (small / new properties). The crawl observes the live
  // homepage and emits concrete quick-wins (missing canonical, no H1,
  // thin content, no sitemap, etc.) so the SEO surface always has real
  // action items even without DataForSEO indexing.
  //
  // De-duplicate: if a page-audit finding above already covered a
  // particular issue (e.g. Duplicate <title>), we keep the page-audit
  // version since it's based on whole-site signal. The crawl is single-
  // page only.
  if (provider.siteCrawl) {
    const existingIds = new Set(quickWins.map((f) => f.id));
    // Map crawl-finding ids onto page-audit ids so we can detect overlap.
    const overlapMap: Record<string, string> = {
      "qw-crawl-https": "qw-https",
      "qw-crawl-no-title": "qw-no-title",
      "qw-crawl-short-title": "qw-short-title",
      "qw-crawl-long-title": "qw-long-title",
      "qw-crawl-no-desc": "qw-no-desc",
      "qw-crawl-short-desc": "qw-short-desc",
      "qw-crawl-long-desc": "qw-long-desc",
      "qw-crawl-no-canonical": "qw-no-canonical",
      "qw-crawl-no-h1": "qw-no-h1",
      "qw-crawl-multi-h1": "qw-multi-h1",
      "qw-crawl-no-alt": "qw-no-alt",
      "qw-crawl-thin-content": "qw-thin-content",
      "qw-crawl-thin-internal": "qw-thin-internal",
      "qw-crawl-no-schema": "qw-no-schema",
    };
    for (const f of crawlFindings(provider.siteCrawl)) {
      const overlap = overlapMap[f.id];
      if (overlap && existingIds.has(overlap)) continue;
      if (existingIds.has(f.id)) continue;
      quickWins.push(f);
    }
  }

  // Lighthouse-derived quick wins. Name the specific failing audit.
  if (provider.lighthouse?.seo != null && provider.lighthouse.seo < 80) {
    const failing = topFailingLighthouseAudits(provider.lighthouseAudits, 2);
    if (failing.length > 0) {
      quickWins.push({
        id: "qw-lh-seo",
        title: `Lighthouse SEO score is ${provider.lighthouse.seo}. Fix ${failing[0].title ?? failing[0].id}`,
        detail: failing
          .map((f) => f.title ?? f.id)
          .filter(Boolean)
          .join(" · "),
      });
    } else {
      quickWins.push({
        id: "qw-lh-seo",
        title: `Lighthouse SEO score is ${provider.lighthouse.seo}/100`,
        detail:
          "Below the 80 threshold Google uses as the rough cutoff for healthy on-page SEO.",
      });
    }
  }
  if (
    provider.lighthouse?.performance != null &&
    provider.lighthouse.performance < 50
  ) {
    quickWins.push({
      id: "qw-lh-perf",
      title: `Page speed is hurting you (Lighthouse perf ${provider.lighthouse.performance}/100)`,
      detail:
        "Page loads slowly enough that bounce rate on mobile is likely high. Image compression + lazy-loading is usually the fastest win.",
    });
  }

  // ---- Risks. Reputation negatives + AEO gaps ---------------------------
  const negativeMentions = provider.mentions.filter((m) => {
    const hay = `${m.title ?? ""} ${m.snippet}`.toLowerCase();
    return /(avoid|scam|worst|horrible|terrible|do not rent|stay away|nightmare|roach|mold)/.test(
      hay,
    );
  });
  if (negativeMentions.length > 0) {
    risks.push({
      id: "r-negative",
      title: `${negativeMentions.length} negative mention${negativeMentions.length === 1 ? "" : "s"} in the past 90 days`,
      detail: `Across ${uniqueSources(negativeMentions)}. Public replies inside 48 hours measurably reduce next-tour cancellations.`,
    });
  }
  if (provider.aeoUncitedEngines.length > 0) {
    risks.push({
      id: "r-aeo",
      title: `${provider.aeoUncitedEngines.join(" and ")} aren't citing ${provider.brandName}`,
      detail:
        "Today's renters check AI search before clicking. Un-cited brands are invisible on the chat surface.",
    });
  }
  if (provider.aeoCompetitorsCited.length > 0) {
    risks.push({
      id: "r-aeo-comp",
      title: `Competitors cited instead: ${provider.aeoCompetitorsCited.slice(0, 3).join(", ")}`,
      detail:
        "AI search recommended other properties over yours on the same prospect prompts.",
    });
  }
  if (
    provider.backlinks &&
    provider.backlinks.referring_domains != null &&
    provider.backlinks.referring_domains < 30
  ) {
    risks.push({
      id: "r-backlinks",
      title: `Only ${provider.backlinks.referring_domains} referring domains`,
      detail:
        "Below the local-multifamily median. Domain authority compounds slowly. Start outreach now.",
    });
  }

  // ---- Opportunities. High-volume keywords just outside top 10 ----------
  if (provider.rankedKeywords && provider.rankedKeywords.length > 0) {
    const closeToTop = provider.rankedKeywords
      .filter((k) => {
        const r = k.ranked_serp_element?.serp_item?.rank_absolute;
        const v = k.keyword_data?.keyword_info?.search_volume ?? 0;
        return r != null && r > 10 && r <= 25 && v >= 100;
      })
      .sort((a, b) => {
        const va = a.keyword_data?.keyword_info?.search_volume ?? 0;
        const vb = b.keyword_data?.keyword_info?.search_volume ?? 0;
        return vb - va;
      })
      .slice(0, 3);
    for (const k of closeToTop) {
      const kw = k.keyword_data.keyword;
      const rank = k.ranked_serp_element.serp_item.rank_absolute;
      const vol = k.keyword_data.keyword_info?.search_volume ?? 0;
      opportunities.push({
        id: `o-kw-${slug(kw)}`,
        title: `Push "${kw}" from #${rank} into the top 10`,
        detail: `${vol.toLocaleString()} searches/mo. A focused on-page rewrite + 1-2 backlinks usually closes a 5-15 position gap inside 60 days.`,
      });
    }
  }
  if (provider.aeoCitedEngines.length > 0) {
    opportunities.push({
      id: "o-aeo-defend",
      title: `Defend AI citations on ${provider.aeoCitedEngines.join(" and ")}`,
      detail:
        "These engines already cite you. Schema markup + FAQ pages keep that visibility durable as the models retrain.",
    });
  }

  // ---- 6-pillar DPS + recommendations -----------------------------------
  // The audit page renders from these. Quiz answers feed both engines so
  // operator-stated context (no chatbot, no pixel, no review monitoring)
  // becomes both a pillar penalty and a personalized action item.
  const hasSchemaMarkup =
    (provider.pageAudit?.schema?.type ?? []).length > 0 ||
    (provider.siteCrawl?.schemaTypes?.length ?? 0) > 0;
  const dps = computeDps(
    signals,
    {
      lighthouseSeo: provider.lighthouse?.seo ?? null,
      lighthousePerformance: provider.lighthouse?.performance ?? null,
      lighthouseAccessibility: provider.lighthouse?.accessibility ?? null,
      hasSchemaMarkup,
    },
    quizAnswers,
  );

  const hasNegativeMentions = risks.some((r) => r.id === "r-negative");
  const recommendations = computeRecommendations(quizAnswers, signals, {
    aeoCitedEngines: provider.aeoCitedEngines,
    aeoUncitedEngines: provider.aeoUncitedEngines,
    aeoCompetitorsCited: provider.aeoCompetitorsCited,
    lighthouseSeo: provider.lighthouse?.seo ?? null,
    lighthousePerformance: provider.lighthouse?.performance ?? null,
    noSchemaMarkup: !hasSchemaMarkup,
    hasNegativeMentions,
    totalMentions: signals.reputation?.totalMentions ?? 0,
  });

  // 2026-05-29: quickWins cap raised from 5 → 10 so the punch-list
  // actually reads like a punch-list. The expanded page-audit findings
  // can routinely surface 8+ on-page issues for a brand-new property,
  // and capping at 5 would hide half the actionable work.
  // ---- Premium findings (2026-06-03) -----------------------------------
  // Reuses signal data already collected by computeSignals. Zero extra
  // API calls — these surfaces just RE-PRESENT the data we have through
  // a richer, branded lens (engine logos, verbatim AIO, 8-check on-page
  // audit, detected stack, schema gap). Every field is real and traceable
  // back to the audit's existing signal sources.
  const aeoEngines = buildAeoEngineRows(signals);
  const aeoOnPage = buildAeoOnPageFindings(provider);
  const googleAiOverview = buildGoogleAiOverview(provider);
  const detectedStack = buildDetectedStack(provider.siteCrawl?.html ?? null);
  const schemaGap = buildSchemaGap(provider);

  const findings: SynthesizedFindings = {
    quickWins: quickWins.slice(0, 10),
    risks: risks.slice(0, 5),
    opportunities: opportunities.slice(0, 5),
    mentions: provider.mentions,
    sectionDetails: buildSectionDetails(signals, provider),
    dps,
    recommendations,
    aeoEngines,
    aeoCompetitorsCited: provider.aeoCompetitorsCited,
    aeoOnPage,
    googleAiOverview,
    detectedStack,
    schemaGap,
  };

  const claudeSummary = await writeNarrative(signals, provider, findings);

  return {
    findings,
    claudeSummary,
    sectionScores,
    overallScore: dps.score,
  };
}

// ---------------------------------------------------------------------------
// buildSectionDetails
//
// "Why this score" copy for each section. Reads off the SignalSnapshot
// + raw provider data and emits short bullets the audit viewer can render
// under each ScoreCard. Every bullet is derived from a real number. No
// generic copy. Adam 2026-05-29: prospect should see the receipts.
// ---------------------------------------------------------------------------
function buildSectionDetails(
  signals: SignalSnapshot,
  provider: ProviderData,
): SectionDetails {
  return {
    seo: buildSeoDetail(signals, provider),
    aeo: buildAeoDetail(signals, provider),
    reputation: buildReputationDetail(signals),
    traffic: buildTrafficDetail(signals),
  };
}

function buildSeoDetail(
  signals: SignalSnapshot,
  provider: ProviderData,
): SectionDetail | null {
  const seo = signals.seo;
  const crawl = provider.siteCrawl ?? null;
  if (!seo) {
    // The site-crawl fallback should have produced data unless the site
    // itself is unreachable. Tailor the empty-state copy to the actual
    // failure mode so the prospect knows what's wrong.
    if (crawl?.status === "unreachable") {
      return {
        headline: "Homepage was unreachable",
        points: [
          "Our crawler couldn't connect to the homepage within the timeout window. The domain may be down, behind DNS issues, or pointed at the wrong IP.",
          "Try loading the URL in a private browser window. If it fails for you too, that's the root cause.",
        ],
      };
    }
    if (crawl?.status === "blocked") {
      return {
        headline: "Homepage is blocking our crawler",
        points: [
          `HTTP ${crawl.httpStatus ?? "4xx"}. Site is rejecting bot traffic (Cloudflare / WAF / CAPTCHA).`,
          "Search engines and AI crawlers hit the same wall. Allowlist legitimate crawler user-agents in your WAF to unblock indexing.",
        ],
      };
    }
    if (crawl?.status === "non_html") {
      return {
        headline: "Homepage isn't serving HTML",
        points: [
          `Content-Type "${crawl.errorMessage ?? "non-HTML"}". Likely a single-page JS app that doesn't render HTML server-side.`,
          "Without server-rendered HTML, search engines see an empty shell. Add server-side rendering or a static prerender layer.",
        ],
      };
    }
    return {
      headline: "Scan still expanding coverage",
      points: [
        "DataForSEO Labs has no organic ranking data yet for this domain. Typical for properties under ~100 units or sites less than 6 months old.",
        "Page-level audit (Lighthouse + on-page checks) didn't return either. Verify the homepage is reachable and serves real HTML (not a JS shell with no SSR).",
      ],
    };
  }
  const points: string[] = [];
  if (seo.organicKeywords > 0) {
    points.push(
      `${seo.organicKeywords.toLocaleString()} ranked keyword${seo.organicKeywords === 1 ? "" : "s"}, ${seo.top10Count} in the top 10 of Google.`,
    );
    if (seo.avgPosition != null) {
      points.push(`Average ranking position is #${seo.avgPosition}.`);
    }
  } else {
    // No DataForSEO Labs data. Lean on whatever the crawl observed
    // instead of just saying "0 keywords". This is the bullet most
    // operators of new properties will read first.
    if (crawl?.status === "ok") {
      points.push(
        `Direct homepage scan: ${crawl.bodyWordCount} words of content, ${crawl.h1Count} H1 tag${crawl.h1Count === 1 ? "" : "s"}, ${crawl.imageCount} image${crawl.imageCount === 1 ? "" : "s"} (${crawl.imagesMissingAlt} missing alt), ${crawl.internalLinkCount} internal links.`,
      );
      if (!crawl.hasSitemapXml) {
        points.push("No /sitemap.xml detected. Slows crawler indexing.");
      } else if (crawl.schemaTypes.length === 0) {
        points.push(
          "No schema.org structured data detected. AI engines can't confirm property identity without it.",
        );
      }
    } else {
      points.push(
        "DataForSEO Labs returned 0 ranked keywords. Common for newer or smaller properties.",
      );
    }
  }
  if (seo.lighthouseScore != null) {
    points.push(`Lighthouse SEO category: ${seo.lighthouseScore}/100.`);
  }
  if (seo.referringDomains > 0) {
    points.push(
      `${seo.referringDomains.toLocaleString()} referring domain${seo.referringDomains === 1 ? "" : "s"} backlinking to the site.`,
    );
  }
  if (provider.pageAudit?.meta) {
    const m = provider.pageAudit.meta;
    const issues: string[] = [];
    if (!m.is_https) issues.push("no HTTPS");
    if (!m.title) issues.push("missing <title>");
    if (m.duplicate_title) issues.push("duplicate <title>");
    if (m.duplicate_description) issues.push("duplicate description");
    if ((m.htags?.h1?.length ?? 0) === 0) issues.push("no <h1>");
    if ((m.no_image_alt ?? 0) > 0) issues.push(`${m.no_image_alt} missing alt`);
    if ((m.broken_links ?? 0) > 0) issues.push(`${m.broken_links} broken links`);
    if (issues.length > 0) {
      points.push(`On-page issues found: ${issues.join(", ")}.`);
    } else {
      points.push("On-page audit found no blocking issues.");
    }
  }
  return {
    headline: pickSeoHeadline(seo),
    points: points.slice(0, 4),
  };
}

function pickSeoHeadline(seo: SeoSignal): string {
  if (seo.score >= 80) return "Strong SEO fundamentals";
  if (seo.score >= 60) return "Healthy with specific gaps";
  if (seo.score >= 40) return "Significant on-page work needed";
  return "Multiple SEO blockers";
}

function buildAeoDetail(
  signals: SignalSnapshot,
  provider: ProviderData,
): SectionDetail | null {
  const aeo = signals.aeo;
  if (!aeo) return null;
  const points: string[] = [];
  points.push(
    `${aeo.citationsFound} of ${aeo.enginesChecked} AI engines cited the brand by name (${Math.round(aeo.citationRate * 100)}% citation rate).`,
  );
  if (provider.aeoCitedEngines.length > 0) {
    points.push(`Cited by: ${provider.aeoCitedEngines.join(", ")}.`);
  }
  if (provider.aeoUncitedEngines.length > 0) {
    points.push(
      `Uncited by: ${provider.aeoUncitedEngines.join(", ")}. Missing reach on those engines.`,
    );
  }
  if (provider.aeoCompetitorsCited.length > 0) {
    points.push(
      `Competitors cited instead on the same prompts: ${provider.aeoCompetitorsCited.slice(0, 3).join(", ")}.`,
    );
  }
  return {
    headline: pickAeoHeadline(aeo),
    points: points.slice(0, 4),
  };
}

function pickAeoHeadline(aeo: AeoSignal): string {
  if (aeo.citationRate >= 0.8) return "AI search well-defended";
  if (aeo.citationRate >= 0.5) return "Half the AI surface covered";
  if (aeo.citationRate > 0) return "Limited AI citation reach";
  return "Invisible on AI search";
}

function buildReputationDetail(
  signals: SignalSnapshot,
): SectionDetail | null {
  const rep = signals.reputation;
  if (!rep) return null;
  const points: string[] = [];
  if (rep.totalMentions === 0) {
    return {
      headline: "No public mentions found",
      points: [
        "Scanned Reddit, Yelp, Google, BBB, ApartmentRatings, Facebook, and the open web. Zero hits in the last 90 days.",
        "For a leased-up property this usually means the brand name is too generic or no one's posting. For a stealth/new property, it's expected.",
      ],
    };
  }
  const pos = Math.round(rep.sentimentMix.positive * 100);
  const neu = Math.round(rep.sentimentMix.neutral * 100);
  const neg = Math.round(rep.sentimentMix.negative * 100);
  points.push(
    `${rep.totalMentions} public mention${rep.totalMentions === 1 ? "" : "s"} surfaced from the past 90 days.`,
  );
  points.push(
    `Sentiment mix: ${pos}% positive, ${neu}% neutral, ${neg}% negative.`,
  );
  if (rep.newNegative7d > 0) {
    points.push(
      `${rep.newNegative7d} new negative post${rep.newNegative7d === 1 ? "" : "s"} in the last 7 days. Flag for fast public reply.`,
    );
  }
  if (rep.avgRating != null) {
    points.push(`Average aggregated rating: ${rep.avgRating.toFixed(1)} / 5.`);
  }
  return {
    headline: pickReputationHeadline(rep),
    points: points.slice(0, 4),
  };
}

function pickReputationHeadline(rep: ReputationSignal): string {
  if (rep.sentimentMix.negative > 0.3) return "Negative tilt. Needs response";
  if (rep.sentimentMix.positive > 0.5) return "Net positive public sentiment";
  if (rep.totalMentions < 5) return "Thin public presence";
  return "Mixed-signal public coverage";
}

function buildTrafficDetail(
  signals: SignalSnapshot,
): SectionDetail | null {
  const traffic = signals.traffic;
  if (!traffic) {
    return {
      headline: "No traffic estimate available",
      points: [
        "Traffic is currently estimated from DataForSEO ranked-keyword data × CTR-by-position. With zero ranked keywords on file, we can't make an honest estimate.",
        "Real-time traffic via GA4 lands when the operator connects analytics inside LeaseStack.",
      ],
    };
  }
  const points: string[] = [];
  points.push(
    `Estimated ${traffic.sessions.toLocaleString()} organic session${traffic.sessions === 1 ? "" : "s"} per month from ranked-keyword × CTR-by-position math.`,
  );
  points.push(
    traffic.source === "ga"
      ? "Source: Google Analytics (GA4) live data."
      : "Source: DataForSEO ranking estimate (no GA4 connection yet).",
  );
  if (traffic.topPages.length > 0) {
    const top = traffic.topPages[0];
    points.push(`Top page by visits: ${top.url} (${top.visits.toLocaleString()}).`);
  }
  if (traffic.bounceRate != null) {
    points.push(`Bounce rate: ${(traffic.bounceRate * 100).toFixed(0)}%.`);
  }
  return {
    headline: pickTrafficHeadline(traffic),
    points: points.slice(0, 4),
  };
}

function pickTrafficHeadline(traffic: TrafficSignal): string {
  if (traffic.sessions >= 10_000) return "Healthy organic baseline";
  if (traffic.sessions >= 1_000) return "Real organic floor";
  if (traffic.sessions > 100) return "Thin organic footprint";
  return "Effectively no organic traffic";
}

function uniqueSources(mentions: ProspectMention[]): string {
  const set = new Set(mentions.map((m) => prettySource(m.source)));
  return Array.from(set).join(", ");
}

function prettySource(s: ProspectMention["source"]): string {
  switch (s) {
    case "REDDIT":
      return "Reddit";
    case "YELP":
      return "Yelp";
    case "BBB":
      return "BBB";
    case "APARTMENT_RATINGS":
      return "ApartmentRatings";
    case "FACEBOOK":
      return "Facebook";
    case "GOOGLE_REVIEW":
      return "Google";
    case "TAVILY_WEB":
    default:
      return "web";
  }
}

function topFailingLighthouseAudits(
  audits: Record<string, { id?: string; title?: string; score?: number | null }> | null,
  limit: number,
): Array<{ id: string; title: string | null }> {
  if (!audits) return [];
  const failing = Object.entries(audits)
    .filter(([, v]) => v && v.score != null && (v.score as number) < 0.9)
    .map(([k, v]) => ({ id: k, title: v.title ?? null }))
    .slice(0, limit);
  return failing;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ---- Narrative writer (Claude) -------------------------------------------
// Claude Haiku 4.5 pricing (per million tokens). Kept inline as a
// constant so the cost estimate stays accurate even when the SDK
// doesn't return token counts. Source: anthropic.com/pricing as of
// 2026-05. Bump when model swaps.
const HAIKU_INPUT_PER_M = 1.0;   // $1.00 per 1M input tokens
const HAIKU_OUTPUT_PER_M = 5.0;  // $5.00 per 1M output tokens

function estimateHaikuCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * HAIKU_INPUT_PER_M +
    (outputTokens / 1_000_000) * HAIKU_OUTPUT_PER_M
  );
}

async function writeNarrative(
  signals: SignalSnapshot,
  provider: ProviderData,
  findings: SynthesizedFindings,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackNarrative(signals, provider, findings);
  }

  const factSheet = buildFactSheet(signals, provider, findings);
  const startedAt = Date.now();

  try {
    const { text, usage } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system:
        "You are a senior property marketing analyst. Write tight, specific, number-driven prose. Never invent statistics. Cite exact numbers from the fact sheet. 180–220 words, 2–3 paragraphs.",
      prompt: `Write a "What this means" summary for the ${provider.brandName} property marketing audit. Reference SPECIFIC numbers from the fact sheet below. Mention at least one named Lighthouse audit failure or page-audit metric, at least one keyword/ranking number, and one reputation observation. Do not bullet. Flowing prose. No marketing fluff.

FACT SHEET
${factSheet}`,
      maxOutputTokens: 600,
    });

    // Log the cost. The AI SDK returns `usage` with inputTokens +
    // outputTokens; we compute the dollar cost from the published
    // Haiku 4.5 rate card. Even if usage is missing for some reason
    // (older SDK / providers omit it), we still log a row with cost=0
    // so the count is visible on /admin/costs.
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    await logUsage({
      provider: "anthropic",
      endpoint: "claude-haiku-4.5/audit-narrative",
      status: "SUCCESS",
      costUsd: estimateHaikuCostUsd(inputTokens, outputTokens),
      durationMs: Date.now() - startedAt,
      meta: {
        model: "claude-haiku-4-5-20251001",
        inputTokens,
        outputTokens,
        domain: provider.domain,
      },
    });
    return text.trim() || fallbackNarrative(signals, provider, findings);
  } catch (err) {
    console.error(
      "[audit.synthesize] narrative generation failed:",
      err instanceof Error ? err.message : String(err),
    );
    await logUsage({
      provider: "anthropic",
      endpoint: "claude-haiku-4.5/audit-narrative",
      status: "ERROR",
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      meta: {
        model: "claude-haiku-4-5-20251001",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return fallbackNarrative(signals, provider, findings);
  }
}

function buildFactSheet(
  signals: SignalSnapshot,
  provider: ProviderData,
  findings: SynthesizedFindings,
): string {
  const lines: string[] = [];
  lines.push(`Brand: ${provider.brandName}`);
  lines.push(`Domain: ${provider.domain}`);
  lines.push(`Overall score: ${signals.overallScore}/100`);
  lines.push(
    `Section scores: SEO ${signals.seo?.score ?? "n/a"}, AEO ${signals.aeo?.score ?? "n/a"}, Reputation ${signals.reputation?.score ?? "n/a"}, Traffic ${signals.traffic?.score ?? "n/a"}`,
  );
  if (provider.lighthouse) {
    lines.push(
      `Lighthouse: SEO ${provider.lighthouse.seo ?? "n/a"}, Performance ${provider.lighthouse.performance ?? "n/a"}, Accessibility ${provider.lighthouse.accessibility ?? "n/a"}`,
    );
  }
  if (provider.pageAudit?.meta) {
    const m = provider.pageAudit.meta;
    lines.push(
      `On-page: title length ${m.title?.length ?? 0} chars; ${m.no_image_alt ?? 0} images missing alt; ${m.broken_links ?? 0} broken links; ${m.internal_links_count ?? 0} internal links; HTTPS=${m.is_https}`,
    );
  }
  if (signals.seo) {
    lines.push(
      `SEO: ${signals.seo.organicKeywords} ranked keywords (${signals.seo.top10Count} in top 10); est. Monthly traffic ${signals.seo.estimatedTraffic.toLocaleString()}`,
    );
  }
  if (provider.backlinks) {
    lines.push(
      `Backlinks: ${provider.backlinks.backlinks ?? 0} total, ${provider.backlinks.referring_domains ?? 0} referring domains, rank ${provider.backlinks.rank ?? "n/a"}`,
    );
  }
  if (signals.aeo) {
    lines.push(
      `AEO: ${signals.aeo.citationsFound}/${signals.aeo.enginesChecked} engines cited the brand (rate ${(signals.aeo.citationRate * 100).toFixed(0)}%). Cited: ${provider.aeoCitedEngines.join(", ") || "none"}. Uncited: ${provider.aeoUncitedEngines.join(", ") || "none"}.`,
    );
    if (provider.aeoCompetitorsCited.length > 0) {
      lines.push(
        `AEO competitors cited instead: ${provider.aeoCompetitorsCited.slice(0, 5).join(", ")}`,
      );
    }
  }
  if (signals.reputation) {
    lines.push(
      `Reputation (last 90d): ${signals.reputation.totalMentions} mentions; sentiment positive ${(signals.reputation.sentimentMix.positive * 100).toFixed(0)}%, negative ${(signals.reputation.sentimentMix.negative * 100).toFixed(0)}%.`,
    );
  }
  if (findings.mentions.length > 0) {
    const topThree = findings.mentions.slice(0, 3);
    lines.push(
      `Sample mentions: ${topThree.map((m) => `${prettySource(m.source)}. "${(m.title ?? m.snippet).slice(0, 80)}"`).join(" | ")}`,
    );
  }
  return lines.join("\n");
}

function fallbackNarrative(
  signals: SignalSnapshot,
  provider: ProviderData,
  findings: SynthesizedFindings,
): string {
  const parts: string[] = [];
  parts.push(
    `${provider.brandName} (${provider.domain}) sits at an overall score of ${signals.overallScore}/100.`,
  );
  if (provider.lighthouse?.seo != null) {
    parts.push(
      `Lighthouse rates the homepage SEO at ${provider.lighthouse.seo}/100.`,
    );
  }
  if (signals.seo) {
    parts.push(
      `The site ranks for ${signals.seo.organicKeywords} keywords, with ${signals.seo.top10Count} in the top 10 of Google results.`,
    );
  }
  if (signals.aeo) {
    parts.push(
      `On AI search, ${signals.aeo.citationsFound} of ${signals.aeo.enginesChecked} assistants cited the brand by name.`,
    );
  }
  if (signals.reputation && signals.reputation.totalMentions > 0) {
    parts.push(
      `Reputation scan surfaced ${signals.reputation.totalMentions} public mentions in the last 90 days.`,
    );
  }
  if (findings.quickWins.length > 0) {
    parts.push(
      `The fastest wins are ${findings.quickWins
        .slice(0, 2)
        .map((q) => q.title.toLowerCase())
        .join(" and ")}.`,
    );
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Premium build helpers (2026-06-03). Each function consumes data already
// collected during the audit run and reshapes it into a branded, render-
// ready findings sub-object. All return values are JSON-serializable so
// they round-trip through the findings JSONB column cleanly.
// ---------------------------------------------------------------------------

function buildAeoEngineRows(snapshot: SignalSnapshot): AeoEngineRow[] {
  const byEngine = snapshot.aeo?.byEngine ?? {};
  // Stable rendering order — matches the in-product AEO dashboard.
  const order: Array<{
    engine: AeoEngineRow["engine"];
    key: keyof NonNullable<SignalSnapshot["aeo"]>["byEngine"];
  }> = [
    { engine: "CHATGPT", key: "chatgpt" },
    { engine: "PERPLEXITY", key: "perplexity" },
    { engine: "CLAUDE", key: "claude" },
    { engine: "GEMINI", key: "gemini" },
  ];
  return order.map(({ engine, key }) => {
    const row = byEngine[key];
    return {
      engine,
      cited: row?.cited ?? false,
      sources: row?.sources ?? [],
    };
  });
}

function buildAeoOnPageFindings(
  provider: ProviderData,
): AeoOnPageFindings | null {
  const html = provider.siteCrawl?.html;
  if (!html) return null;
  const result = runOnPageAuditChecks(html);
  return {
    url: provider.siteCrawl?.resolvedUrl ?? `https://${provider.domain}`,
    score: result.score,
    checks: result.checks,
    excerpt: result.excerpt,
  };
}

function buildGoogleAiOverview(
  provider: ProviderData,
): GoogleAiOverviewFindings | null {
  const aio = provider.googleAiOverview;
  if (!aio) return null;
  const ownDomain = provider.domain.toLowerCase();
  const cited = aio.citedUrls.some((u) => {
    try {
      return new URL(u).hostname.toLowerCase().includes(ownDomain);
    } catch {
      return false;
    }
  });
  return {
    query: aio.query,
    summary: aio.summary,
    citedUrls: aio.citedUrls,
    cited,
  };
}

// Detection registry — regex against crawled HTML. Each entry names a
// known vendor we care about for the audit's "Detected stack" card.
// Patterns are intentionally lenient (host fragment, script src, common
// global names) so a slightly-old install still matches.
const STACK_DETECTORS: Array<{
  key: string;
  label: string;
  category: DetectedStack["rows"][number]["category"];
  patterns: RegExp[];
}> = [
  // Chatbots
  { key: "intercom", label: "Intercom", category: "chatbot",
    patterns: [/widget\.intercom\.io/i, /intercomSettings/] },
  { key: "drift", label: "Drift", category: "chatbot",
    patterns: [/js\.driftt?\.com/i, /drift\.load/i] },
  { key: "tidio", label: "Tidio", category: "chatbot",
    patterns: [/code\.tidio\.co/i] },
  { key: "tawk", label: "Tawk.to", category: "chatbot",
    patterns: [/embed\.tawk\.to/i] },
  { key: "zendesk", label: "Zendesk Chat", category: "chatbot",
    patterns: [/static\.zdassets\.com/i, /zendesk\.com\/embeddable/i] },
  { key: "chatbase", label: "Chatbase", category: "chatbot",
    patterns: [/chatbase\.co\/embed/i] },
  // Popups
  { key: "klaviyo-popup", label: "Klaviyo Popups", category: "popups",
    patterns: [/static\.klaviyo\.com\/onsite/i, /klaviyo\/.*\/forms/i] },
  { key: "optimonk", label: "OptiMonk", category: "popups",
    patterns: [/optimonk\.com/i] },
  { key: "privy", label: "Privy", category: "popups",
    patterns: [/privy\.com\/widget/i, /privywidget/i] },
  { key: "popupsmart", label: "Popupsmart", category: "popups",
    patterns: [/popupsmart\.com/i] },
  // Visitor / pixel
  { key: "cursive", label: "Cursive Pixel", category: "pixel",
    patterns: [/cursive\.js/i, /meetcursive\.com\/p/i, /cursive\.tags/i] },
  { key: "meta-pixel", label: "Meta Pixel", category: "pixel",
    patterns: [/connect\.facebook\.net\/.*\/fbevents\.js/i, /fbq\(['"]init/i] },
  { key: "rb2b", label: "RB2B (B2B identification)", category: "pixel",
    patterns: [/rb2b\.com/i] },
  // Analytics
  { key: "ga4", label: "Google Analytics 4 / GTM", category: "analytics",
    patterns: [/googletagmanager\.com\/gtag\/js/i, /googletagmanager\.com\/gtm\.js/i, /gtag\(['"]config/i] },
  { key: "segment", label: "Segment", category: "analytics",
    patterns: [/cdn\.segment\.com\/analytics\.js/i, /analytics\.load\(['"]/i] },
  { key: "amplitude", label: "Amplitude", category: "analytics",
    patterns: [/cdn\.amplitude\.com/i] },
  { key: "posthog", label: "PostHog", category: "analytics",
    patterns: [/posthog\.com\/static\/array\.js/i, /posthog\.init/i] },
  // CRM / marketing
  { key: "hubspot", label: "HubSpot", category: "crm",
    patterns: [/js\.hs-scripts\.com/i, /js\.hubspot\.com/i] },
  { key: "klaviyo-id", label: "Klaviyo (tracking)", category: "crm",
    patterns: [/static\.klaviyo\.com\/onsite\/js\/klaviyo\.js/i, /_learnq/i] },
  { key: "salesforce-pardot", label: "Pardot / Salesforce", category: "crm",
    patterns: [/pi\.pardot\.com/i] },
];

const CATEGORY_TAGLINES: Record<
  DetectedStack["rows"][number]["category"],
  string
> = {
  chatbot: "AI chatbot / live chat widget",
  popups: "On-site popup / lead capture",
  pixel: "Visitor identification pixel",
  analytics: "Analytics / tag manager",
  crm: "CRM / marketing automation",
};

function buildDetectedStack(html: string | null): DetectedStack {
  if (!html) {
    return {
      rows: [
        {
          key: "no-html",
          label: "Site not crawlable",
          category: "analytics",
          detected: false,
          note: "Homepage didn't return HTML — couldn't observe the stack.",
        },
      ],
    };
  }
  // Bucket detections per category so the report shows ONE row per
  // category (chatbot/popups/pixel/analytics/crm) with the matched
  // vendor name OR "not detected".
  type Cat = DetectedStack["rows"][number]["category"];
  const cats: Cat[] = ["chatbot", "popups", "pixel", "analytics", "crm"];
  const matchesByCategory = new Map<Cat, string[]>();
  for (const det of STACK_DETECTORS) {
    if (det.patterns.some((p) => p.test(html))) {
      const list = matchesByCategory.get(det.category) ?? [];
      list.push(det.label);
      matchesByCategory.set(det.category, list);
    }
  }
  const rows = cats.map((category) => {
    const matches = matchesByCategory.get(category) ?? [];
    if (matches.length === 0) {
      return {
        key: category,
        label: CATEGORY_TAGLINES[category],
        category,
        detected: false,
        note: "Not detected on the homepage.",
      };
    }
    return {
      key: category,
      label: CATEGORY_TAGLINES[category],
      category,
      detected: true,
      note: `Detected: ${matches.join(", ")}.`,
    };
  });
  return { rows };
}

// High-AEO-signal schema types we recommend every real-estate property
// ship. Order matters — drives the rendering order of the "Missing"
// column on the audit result page.
const RECOMMENDED_SCHEMA_TYPES = [
  "Organization",
  "LocalBusiness",
  "ApartmentComplex",
  "RealEstateAgent",
  "Place",
  "FAQPage",
  "BreadcrumbList",
  "Product",
  "ImageObject",
  "Review",
];

function buildSchemaGap(provider: ProviderData): SchemaGap {
  // Union of schema types detected by site-crawl JSON-LD scan + the
  // page-audit endpoint's schema.type list.
  const fromCrawl = provider.siteCrawl?.schemaTypes ?? [];
  const fromAudit = provider.pageAudit?.schema?.type ?? [];
  const present = Array.from(
    new Set([...fromCrawl, ...fromAudit].map((s) => String(s).trim()).filter(Boolean)),
  );
  const presentLower = new Set(present.map((s) => s.toLowerCase()));
  const missing = RECOMMENDED_SCHEMA_TYPES.filter(
    (t) => !presentLower.has(t.toLowerCase()),
  );
  return { present, missing };
}
