// Recommendation engine — the audit's sales-tool layer.
//
// Pure function: (quizAnswers, signals, providerSummary) → ActionItem[].
// Each ActionItem represents a personalized recommendation that maps to
// a specific LeaseStack feature. Rules are deterministic — no LLM, no
// hidden randomness. Adam 2026-06-01: every action item is, by design,
// an upsell disguised as a fix.
//
// Severity scale: high > medium > low. Renderer sorts high first so
// the most painful gaps surface above the fold.

import type { SignalSnapshot } from "@/lib/signals/types";
import {
  readMultiAnswer,
  readSingleAnswer,
  type Pillar,
  type QuizAnswers,
} from "./quiz-questions";

export type Severity = "high" | "medium" | "low";

export interface ActionItem {
  /** Stable id for React keys + dedupe. */
  id: string;
  /** Headline copy — punchy, the gap they have. */
  title: string;
  /** Why we recommend this for them. References their quiz answer or a
   *  scan signal whenever possible so it reads as personalized, not
   *  templated. */
  why: string;
  /** Feature slug used to resolve the "See it live" / "Talk to us" CTA
   *  via `lib/audit/feature-catalog.ts`. */
  featureSlug: string;
  /** Which pillar this recommendation reinforces — drives section
   *  grouping on the result page. */
  pillar: Pillar;
  severity: Severity;
}

/** Cheap snapshot of signal-derived booleans the recommendation engine
 *  consumes. Caller assembles from provider data + SignalSnapshot. */
export interface RecSignals {
  aeoCitedEngines: string[];
  aeoUncitedEngines: string[];
  aeoCompetitorsCited: string[];
  /** Lighthouse SEO score (0-100) when available. */
  lighthouseSeo: number | null;
  /** Lighthouse Performance score (0-100) when available. */
  lighthousePerformance: number | null;
  /** True when site has no schema.org structured data. */
  noSchemaMarkup: boolean;
  /** True when there are >0 negative mentions in the past 90 days. */
  hasNegativeMentions: boolean;
  /** Total mentions count from the reputation scan. */
  totalMentions: number;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function computeRecommendations(
  quiz: QuizAnswers | null,
  signals: SignalSnapshot,
  recSignals: RecSignals,
): ActionItem[] {
  const recs: ActionItem[] = [];

  // Pull commonly-referenced quiz answers up front for readability.
  const siteFeatures = readMultiAnswer(quiz, "site_features");
  const leadSources = readMultiAnswer(quiz, "lead_sources");
  const tracking = readSingleAnswer(quiz, "marketing_tracking");
  const tour = readSingleAnswer(quiz, "tour_booking");
  const rep = readSingleAnswer(quiz, "reputation_handling");
  const portfolio = readSingleAnswer(quiz, "portfolio_size");
  const propertyType = readSingleAnswer(quiz, "property_type");

  const has = (feature: string) => siteFeatures.includes(feature);
  const usesLeadSource = (src: string) => leadSources.includes(src);

  // ---- Conversion -----------------------------------------------------
  if (!has("ai_chatbot") && !has("live_chat")) {
    recs.push({
      id: "rec-chatbot",
      title: "Add an AI chatbot that books tours 24/7",
      why:
        "You said your site doesn't have an AI chatbot or live chat. Renters check listings outside leasing hours — without a chatbot, every off-hours visit walks away unrecorded.",
      featureSlug: "chatbot",
      pillar: "conversion",
      severity: "high",
    });
  }
  if (!has("popups")) {
    recs.push({
      id: "rec-popups",
      title: "Exit-intent popups for off-hours capture",
      why:
        "You said popups aren't live on your site. ~40% of property-site visitors leave without converting; exit-intent capture turns a meaningful share into emails.",
      featureSlug: "popups",
      pillar: "conversion",
      severity: "medium",
    });
  }
  if (tour === "call_only" || tour === "unclear" || tour === "form_callback") {
    recs.push({
      id: "rec-tour-booking",
      title: "Self-serve tour booking on every floorplan page",
      why:
        tour === "call_only"
          ? "You said tours can only be booked by phone. Phone-only blocks the 60%+ of renters who research after 6pm."
          : tour === "unclear"
            ? "You said there's no clear path to book a tour. Every step a prospect has to figure out costs you the next lease."
            : "You said tours go through a form + callback. The handoff between submit and call is where most leads ghost.",
      featureSlug: "website-build",
      pillar: "conversion",
      severity: "high",
    });
  }
  if (
    has("none_of_these") ||
    (siteFeatures.length > 0 &&
      !has("online_application") &&
      !has("virtual_tour") &&
      !has("floorplan_tool"))
  ) {
    recs.push({
      id: "rec-site-build",
      title: "A website built for conversion, not just brochure-ware",
      why:
        "Your site is missing the standard conversion stack — interactive floor plans, online application, virtual tour. Renters expect to do everything but sign the lease without talking to a person.",
      featureSlug: "website-build",
      pillar: "conversion",
      severity: "medium",
    });
  }

  // ---- Tracking & attribution -----------------------------------------
  if (tracking !== "pixel_plus_analytics") {
    recs.push({
      id: "rec-pixel",
      title: "Install a visitor identification pixel",
      why:
        tracking === "no_tracking"
          ? "You said you're not really tracking marketing performance. Every dollar of ad spend right now is going into a black box."
          : tracking === "ga_only"
            ? "You said you're using Google Analytics only. GA tells you HOW MANY visited — not WHO. The pixel turns anonymous traffic into named leads."
            : "You said your CRM is the only thing tracking leads. CRM kicks in after they convert — the pixel catches the 95%+ who never fill a form.",
      featureSlug: "pixel",
      pillar: "tracking",
      severity: "high",
    });
  }
  if (usesLeadSource("not_sure")) {
    recs.push({
      id: "rec-lead-sources",
      title: "Source-of-truth lead source tracking",
      why:
        "You said you don't know where your leads come from today. Without source attribution, every campaign decision is a guess.",
      featureSlug: "lead-sources",
      pillar: "tracking",
      severity: "high",
    });
  }
  if (
    usesLeadSource("paid_ads") &&
    (tracking !== "pixel_plus_analytics" || tracking === null)
  ) {
    recs.push({
      id: "rec-attribution",
      title: "Per-property ad attribution tied to signed leases",
      why:
        "You said you're spending on paid ads, but your tracking can't tie spend to specific units leased. Most campaigns look profitable until you check.",
      featureSlug: "attribution",
      pillar: "tracking",
      severity: "high",
    });
  }
  if (usesLeadSource("paid_ads")) {
    recs.push({
      id: "rec-ads",
      title: "Managed ads with spend tied to signed leases",
      why:
        "You said paid ads are a meaningful lead source. We optimize against signed leases, not impressions — most operators see CAC drop 20-40% in the first quarter.",
      featureSlug: "ads",
      pillar: "tracking",
      severity: "medium",
    });
  }

  // ---- Reputation -----------------------------------------------------
  if (rep === "not_at_all" || rep === "occasional") {
    recs.push({
      id: "rec-reputation",
      title: "Auto-monitor every public mention, with reply suggestions",
      why:
        rep === "not_at_all"
          ? "You said reviews aren't being watched. A single un-replied 1-star review can cost a property a quarter of inbound interest until you respond."
          : "You said reviews only get attention when something flares up. The flare is downstream — quiet drift is what's actually moving your score.",
      featureSlug: "reputation",
      pillar: "reputation",
      severity: "high",
    });
  } else if (rep === "monthly_check") {
    recs.push({
      id: "rec-reputation",
      title: "Real-time review alerts (not monthly checks)",
      why:
        "You said reviews are checked monthly. Monthly is 29 days too slow on a 1-star post — the prospect who saw it has already decided.",
      featureSlug: "reputation",
      pillar: "reputation",
      severity: "medium",
    });
  }
  if (recSignals.hasNegativeMentions) {
    recs.push({
      id: "rec-reputation-negative",
      title: "Respond to active negative mentions in 48 hours",
      why:
        "Our scan surfaced negative mentions in the past 90 days. Public replies inside 48 hours measurably reduce next-tour cancellations.",
      featureSlug: "reputation",
      pillar: "reputation",
      severity: "high",
    });
  }

  // ---- Findability (SEO + AEO) ----------------------------------------
  if (recSignals.aeoUncitedEngines.length > 0) {
    recs.push({
      id: "rec-aeo",
      title: `Get cited by ${recSignals.aeoUncitedEngines.join(" and ")}`,
      why: `${recSignals.aeoUncitedEngines.join(" and ")} ${recSignals.aeoUncitedEngines.length === 1 ? "doesn't" : "don't"} cite your property by name. Today's renters check AI search before clicking — un-cited brands are invisible.`,
      featureSlug: "seo-aeo",
      pillar: "findability",
      severity: "high",
    });
  }
  if (recSignals.aeoCompetitorsCited.length > 0) {
    recs.push({
      id: "rec-aeo-defend",
      title: "Stop competitors from being cited instead of you",
      why: `AI search recommended ${recSignals.aeoCompetitorsCited.slice(0, 3).join(", ")} on the same prospect prompts you should be winning.`,
      featureSlug: "aeo-briefing",
      pillar: "findability",
      severity: "high",
    });
  }
  if (
    recSignals.lighthouseSeo != null &&
    recSignals.lighthouseSeo < 80
  ) {
    recs.push({
      id: "rec-seo",
      title: "Fix the on-page SEO gaps holding your rankings back",
      why: `Lighthouse rated your homepage SEO at ${recSignals.lighthouseSeo}/100 — below the 80 threshold Google treats as healthy. The specific failing audits are in the punch list below.`,
      featureSlug: "seo-aeo",
      pillar: "findability",
      severity: "high",
    });
  }
  if (recSignals.noSchemaMarkup) {
    recs.push({
      id: "rec-schema",
      title: "Add schema.org structured data for AI search",
      why:
        "Our scan found no schema.org markup on your homepage. AI engines lean on schema to confirm property identity — without it, ChatGPT and Perplexity hedge or skip you.",
      featureSlug: "seo-aeo",
      pillar: "findability",
      severity: "medium",
    });
  }
  recs.push({
    id: "rec-keyword-trends",
    title: "Weekly rank tracking on every query that matters",
    why:
      signals.seo && signals.seo.organicKeywords > 0
        ? `You rank for ${signals.seo.organicKeywords} keywords today. Weekly tracking is how you keep that — and catch the next 20 before competitors do.`
        : "Most properties have 50-200 trackable queries between branded, neighborhood, and intent terms. We track them weekly so a slip on any single one is caught in days, not quarters.",
    featureSlug: "keyword-trends",
    pillar: "findability",
    severity: "low",
  });

  // ---- Listings --------------------------------------------------------
  if (!usesLeadSource("apartments_com") && propertyType !== "commercial") {
    recs.push({
      id: "rec-apartments-com",
      title: "Apartments.com as a synced source of truth",
      why:
        "You didn't mark Apartments.com as a lead source. For multifamily, missing the largest ILS is millions of impressions you're not seeing.",
      featureSlug: "apartments-com-sync",
      pillar: "listings",
      severity: "medium",
    });
  }
  if (!usesLeadSource("google_search")) {
    recs.push({
      id: "rec-google-business",
      title: "Optimize your Google Business Profile + Local Pack presence",
      why:
        "You didn't mark Google search as a meaningful lead source. The Local Pack is where most 'apartments near me' searches convert — fixing this is usually a 2-week lift.",
      featureSlug: "seo-aeo",
      pillar: "findability",
      severity: "medium",
    });
  }

  // ---- Portfolio-only (market intel + resident ops) -------------------
  if (portfolio === "mid" || portfolio === "large") {
    recs.push({
      id: "rec-market-intel",
      title: "Portfolio-wide market intelligence in one place",
      why: `You manage ${portfolio === "large" ? "50+" : "11-50"} properties. Per-asset dashboards stop scaling at ~10 — we roll competitor pricing, traffic, and ad performance up to the portfolio.`,
      featureSlug: "market-intelligence",
      pillar: "findability",
      severity: "medium",
    });
    recs.push({
      id: "rec-resident-ops",
      title: "Resident operations tied to marketing data",
      why:
        "Renewals, work orders, and applications all carry marketing signal — at portfolio scale, separating them from the lead funnel hides the most expensive churn.",
      featureSlug: "resident-ops",
      pillar: "conversion",
      severity: "low",
    });
  }

  // ---- Tour tracking ---------------------------------------------------
  if (tour === "self_serve" && tracking !== "pixel_plus_analytics") {
    recs.push({
      id: "rec-tour-tracking",
      title: "Tour-level tracking (booked, show, no-show, leased)",
      why:
        "You said tours are self-serve, but tracking is light. Without tour-level outcomes, you can't tell whether the chatbot, the form, or the ILS is producing the better-quality lead.",
      featureSlug: "tour-tracking",
      pillar: "conversion",
      severity: "medium",
    });
  }

  return sortBySeverity(recs);
}

// ---------------------------------------------------------------------------
// Sort + cap
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function sortBySeverity(items: ActionItem[]): ActionItem[] {
  // Stable sort by severity, then keep insertion order within tier so
  // pillar order from the rules above is preserved as a tiebreaker.
  return items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const rs = SEVERITY_RANK[a.item.severity] - SEVERITY_RANK[b.item.severity];
      return rs !== 0 ? rs : a.idx - b.idx;
    })
    .map((entry) => entry.item);
}
