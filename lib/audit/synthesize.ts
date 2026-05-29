import "server-only";

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
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

// ----------------------------------------------------------------------------
// Synthesizer — turns the raw provider responses + rolled-up SignalSnapshot
// into the audit findings/claudeSummary the viewer renders.
//
// All findings are derived from REAL signals (numbers from the scan, named
// audit failures from Lighthouse, actual mention URLs from reputation).
// No Claude-invented bullets.
// ----------------------------------------------------------------------------

export type Finding = { id: string; title: string; detail?: string };

/** Per-section "why this score" — short bullet list of the supporting
 *  numbers behind the section's score. Surfaced on the audit viewer so
 *  the prospect understands what's driving each number instead of
 *  staring at a score they can't trace.
 *  Adam 2026-05-29 feedback: "we don't understand why the SEO and the
 *  AEO and the reputation and the traffic are the numbers that they
 *  are." Every entry here is derived from the real signal — no fluff. */
export type SectionDetail = {
  /** One-line headline (rendered first, slightly larger). */
  headline?: string | null;
  /** Bullet supporting points — up to 4 per section. */
  points: string[];
};

export type SectionDetails = {
  seo: SectionDetail | null;
  aeo: SectionDetail | null;
  reputation: SectionDetail | null;
  traffic: SectionDetail | null;
};

export type SynthesizedFindings = {
  quickWins: Finding[];
  risks: Finding[];
  opportunities: Finding[];
  // Mentions persist onto the audit findings JSON so the viewer renders the
  // real reputation list (real URLs, real dates).
  mentions: ProspectMention[];
  /** Per-section reasoning — populated by synthesize.ts so the audit
   *  viewer can render "why" copy under each ScoreCard. */
  sectionDetails: SectionDetails;
};

export type ProviderData = {
  brandName: string;
  domain: string;
  rankedKeywords: DomainRankedKeyword[] | null;
  lighthouse: LighthouseScores | null;
  // Full Lighthouse audits map — surfaced so we can name the failing audit
  // by id in the quick-wins copy ("document-title", "image-alt", etc.).
  lighthouseAudits: Record<string, { id?: string; title?: string; score?: number | null }> | null;
  pageAudit: InstantPageAudit | null;
  backlinks: BacklinksSummary | null;
  mentions: ProspectMention[];
  aeoCompetitorsCited: string[];
  aeoCitedEngines: string[];
  aeoUncitedEngines: string[];
};

export async function synthesizeAudit(
  signals: SignalSnapshot,
  provider: ProviderData,
): Promise<{
  findings: SynthesizedFindings;
  claudeSummary: string;
  sectionScores: Record<string, number | null>;
}> {
  // Adam 2026-05-29: preserve null so the viewer can render "Data
  // unavailable" instead of a misleading "0/100". Previously we
  // coerced null → 0 here, which made provider failures
  // indistinguishable from genuinely-zero scores.
  //
  // The Prisma column is `Json?` and the audit viewer's
  // SectionScores type uses `?: number` per key — so absent keys
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

  // ---- Quick wins — only emit when the signal SAYS this is broken --------
  // 2026-05-29: expanded substantially. Every meaningful page-audit
  // signal turns into a named, specific action item. The point of the
  // /audit lead magnet is to give the prospect a concrete punch list,
  // not a vibe-y "your SEO could be better." Each finding either calls
  // out the exact failing field, the current value, and the fix — or
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
          "Without a <title>, Google synthesizes one from the page content — almost always worse than what you'd write yourself. Set it to '{Property name} — {city} {neighborhood} apartments' or similar (50-60 chars).",
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
        title: `Trim homepage <title> — ${meta.title.length} chars (Google truncates around 60)`,
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
          "Google falls back to a snippet from page content — usually a navigation list. Write a 140-160 char description focused on the property's strongest selling point.",
      });
    } else if (meta.description.length < 110) {
      quickWins.push({
        id: "qw-short-desc",
        title: `Meta description is ${meta.description.length} chars — too short`,
        detail: `"${meta.description.slice(0, 110)}". Aim for 140-160 chars: brand + key amenity + a number ("from $1,995", "5 min to campus").`,
      });
    } else if (meta.description.length > 165) {
      quickWins.push({
        id: "qw-long-desc",
        title: `Meta description is ${meta.description.length} chars — Google will truncate`,
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
        title: `Homepage has ${h1Tags.length} <h1> tags — should be exactly one`,
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
          "Missing images, CSS, or JS files load as 404s — they slow the page and tell Google the site isn't being maintained.",
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
          "Internal links distribute link-authority across the site. 10-25 is the typical sweet spot for a property homepage — link to floor plans, amenities, neighborhood, tour booking.",
      });
    }
    if (
      meta.content?.plain_text_word_count != null &&
      meta.content.plain_text_word_count < 300
    ) {
      quickWins.push({
        id: "qw-thin-content",
        title: `Homepage has ${meta.content.plain_text_word_count} words of text — under Google's preference`,
        detail:
          "Property pages under ~300 words tend to be classified as 'thin content' and struggle to rank against longer competitor pages. Add a neighborhood paragraph, amenity list, or FAQ.",
      });
    }
  }

  // Structured data — schema.org / JSON-LD presence is a meaningful AEO
  // signal too (AI engines lean on schema to confirm entity identity).
  const schemaTypes = provider.pageAudit?.schema?.type ?? [];
  if (schemaTypes.length === 0 && provider.pageAudit) {
    quickWins.push({
      id: "qw-no-schema",
      title: "No structured data (schema.org) detected on the homepage",
      detail:
        "Add ApartmentComplex or LocalBusiness JSON-LD with address, telephone, units, and price range. This is what ChatGPT and Perplexity read to confirm the property's identity — without it, AI engines hedge or skip you entirely.",
    });
  }

  // Lighthouse-derived quick wins — name the specific failing audit.
  if (provider.lighthouse?.seo != null && provider.lighthouse.seo < 80) {
    const failing = topFailingLighthouseAudits(provider.lighthouseAudits, 2);
    if (failing.length > 0) {
      quickWins.push({
        id: "qw-lh-seo",
        title: `Lighthouse SEO score is ${provider.lighthouse.seo} — fix ${failing[0].title ?? failing[0].id}`,
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

  // ---- Risks — reputation negatives + AEO gaps ---------------------------
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
        "Below the local-multifamily median. Domain authority compounds slowly — start outreach now.",
    });
  }

  // ---- Opportunities — high-volume keywords just outside top 10 ----------
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

  // 2026-05-29: quickWins cap raised from 5 → 10 so the punch-list
  // actually reads like a punch-list. The expanded page-audit findings
  // can routinely surface 8+ on-page issues for a brand-new property,
  // and capping at 5 would hide half the actionable work.
  const findings: SynthesizedFindings = {
    quickWins: quickWins.slice(0, 10),
    risks: risks.slice(0, 5),
    opportunities: opportunities.slice(0, 5),
    mentions: provider.mentions,
    sectionDetails: buildSectionDetails(signals, provider),
  };

  const claudeSummary = await writeNarrative(signals, provider, findings);

  return { findings, claudeSummary, sectionScores };
}

// ---------------------------------------------------------------------------
// buildSectionDetails
//
// "Why this score" copy for each section. Reads off the SignalSnapshot
// + raw provider data and emits short bullets the audit viewer can render
// under each ScoreCard. Every bullet is derived from a real number — no
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
  if (!seo) {
    return {
      headline: "Scan still expanding coverage",
      points: [
        "DataForSEO Labs has no organic ranking data yet for this domain — typical for properties under ~100 units or sites less than 6 months old.",
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
    points.push(
      "DataForSEO Labs returned 0 ranked keywords. Common for newer or smaller properties — pure on-page-audit signal driving this score.",
    );
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
      `Uncited by: ${provider.aeoUncitedEngines.join(", ")} — missing reach on those engines.`,
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
      `${rep.newNegative7d} new negative post${rep.newNegative7d === 1 ? "" : "s"} in the last 7 days — flag for fast public reply.`,
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
  if (rep.sentimentMix.negative > 0.3) return "Negative tilt — needs response";
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
async function writeNarrative(
  signals: SignalSnapshot,
  provider: ProviderData,
  findings: SynthesizedFindings,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackNarrative(signals, provider, findings);
  }

  const factSheet = buildFactSheet(signals, provider, findings);

  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system:
        "You are a senior property marketing analyst. Write tight, specific, number-driven prose. Never invent statistics. Cite exact numbers from the fact sheet. 180–220 words, 2–3 paragraphs.",
      prompt: `Write a "What this means" summary for the ${provider.brandName} property marketing audit. Reference SPECIFIC numbers from the fact sheet below. Mention at least one named Lighthouse audit failure or page-audit metric, at least one keyword/ranking number, and one reputation observation. Do not bullet — flowing prose. No marketing fluff.

FACT SHEET
${factSheet}`,
      maxOutputTokens: 600,
    });
    return text.trim() || fallbackNarrative(signals, provider, findings);
  } catch (err) {
    console.error(
      "[audit.synthesize] narrative generation failed:",
      err instanceof Error ? err.message : String(err),
    );
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
      `SEO: ${signals.seo.organicKeywords} ranked keywords (${signals.seo.top10Count} in top 10); est. monthly traffic ${signals.seo.estimatedTraffic.toLocaleString()}`,
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
      `Sample mentions: ${topThree.map((m) => `${prettySource(m.source)} — "${(m.title ?? m.snippet).slice(0, 80)}"`).join(" | ")}`,
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
