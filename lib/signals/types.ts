// ----------------------------------------------------------------------------
// Shared types behind /audit (public prospect report) and /portal/insights
// (operator dashboard). One snapshot per day per scope. UI imports this file
// directly — DO NOT add server-only side effects to the types themselves.
// ----------------------------------------------------------------------------

export type TenantScope = { kind: "tenant"; orgId: string; propertyId?: string };
export type ProspectScope = {
  kind: "prospect";
  prospectAuditId: string;
  domain: string;
};
export type SignalScope = TenantScope | ProspectScope;

export interface SeoSignal {
  organicKeywords: number;
  top10Count: number;
  avgPosition: number | null;
  estimatedTraffic: number;
  lighthouseScore: number | null;
  backlinks: number;
  referringDomains: number;
  topMovers: Array<{ keyword: string; from: number; to: number; volume: number }>;
  score: number;
}

export interface AeoSignal {
  enginesChecked: number;
  citationsFound: number;
  citationRate: number;
  byEngine: Partial<
    Record<
      "claude" | "chatgpt" | "gemini" | "perplexity",
      {
        /** Back-compat verdict. When discovery prompts ran this equals
         *  `discovered`; legacy rows carry the old name-echo semantics. */
        cited: boolean;
        sources: string[];
        /** Named OR domain-cited in a DISCOVERY answer (no brand in the
         *  prompt). Absent on legacy / branded-only rows. */
        discovered?: boolean;
        /** Domain-cited in a BRANDED answer. Name echo counts for
         *  nothing. Absent on legacy / branded-only rows. */
        aware?: boolean;
      }
    >
  >;
  /** True when the fan-out included unbranded discovery prompts
   *  (city was derivable). False = branded-only fallback. Absent on
   *  legacy snapshots. */
  discoveryRan?: boolean;
  score: number;
}

export interface ReputationSignal {
  totalMentions: number;
  avgRating: number | null;
  sentimentMix: { positive: number; neutral: number; negative: number };
  newNegative7d: number;
  topThemes: string[];
  score: number;
}

export interface ChatbotSignal {
  conversations: number;
  engagedRate: number;
  avgMessages: number;
  leadConversion: number;
  score: number;
}

export interface LeadsSignal {
  newLeads: number;
  qualified: number;
  cpl: number | null;
  conversionRate: number;
  pipelineValue: number;
  score: number;
}

export interface TrafficSignal {
  sessions: number;
  source: "ga" | "dataforseo_estimate";
  bounceRate: number | null;
  topPages: Array<{ url: string; visits: number }>;
  score: number;
}

export interface SignalSnapshot {
  capturedOn: string; // ISO date (YYYY-MM-DD)
  scopeKey: string;
  seo: SeoSignal | null;
  aeo: AeoSignal | null;
  reputation: ReputationSignal | null;
  chatbot: ChatbotSignal | null;
  leads: LeadsSignal | null;
  traffic: TrafficSignal | null;
  overallScore: number;
  deltas7d: Record<string, number> | null;
  computeMs: number;
  computeVersion: string;
}

// Bump this string to invalidate prior snapshots (e.g. when a section's
// scoring rubric changes). The cron skips rows where computeVersion already
// matches today's value.
//
// 2026-05-29 bump: prospect reputation scanner switched to per-source
// Tavily host-pinned queries (Yelp / Google / ApartmentRatings / BBB /
// Facebook each get dedicated host-bound calls) + open-web sweep. Existing
// cached audits ran against the old 3-broad-query pipeline so most
// mentions classified as TAVILY_WEB instead of their canonical source.
// Also, synthesize.ts now preserves null section scores instead of
// coercing to 0 — old audits have explicit `0` for missing data which
// would still render the misleading "0/100" card.
// Bumping the version invalidates the 14-day dedupe so the next visit
// to a stale audit triggers a fresh scan.
// 2026-06-01: bump to dps.v1 — Digital Performance Score rebuild shipped
// (6-pillar shape, cap-enforced overall, recommendation engine). Cached
// audits from v5 don't carry findings.dps or findings.recommendations,
// so the result page silently hides the 6-pillar grid + the action plan.
// Invalidate the 14-day dedupe so the next /audit submission re-runs
// the scan and persists the new shape.
// 2026-08-13: bump to aeo-discovery.v1 — the AEO fan-out previously ran
// 5 BRANDED prompts and parseCitation counted a name echo as CITED, so
// every property read all-engines-cited (a tautology). The fan-out now
// splits 2 branded + 3 discovery prompts (city derived from the crawl)
// and the verdict counts DISCOVERED. Invalidate the dedupe so stale
// all-green audits re-run on next visit.
// 2026-08-19: bump to brand-identity.v1 — the prospect scan keyed every
// fan-out (engine prompts, mention scan, Google AI Overview) off a name
// derived from the domain, ignoring the property name the prospect typed.
// Reports rendered the typed name over answers about a different company.
// Every audit computed before this bump carries wrong-entity data, so the
// dedupe must not serve one to a new submission.
// 2026-08-26: bump to locale-merge.v1 — the schema-address tier took the
// first PostalAddress anywhere in the markup (a sibling community or a
// corporate HQ on operator sites) and short-circuited the LLM tier, so
// every cached audit carries city-only locale and the "apartments"
// default. Those reports asked the engines the wrong question; don't
// serve one to a new submission.
export const COMPUTE_VERSION = "2026-08-26.locale-merge.v1";

export function scopeKey(s: SignalScope): string {
  if (s.kind === "tenant") {
    return `tenant:${s.orgId}:${s.propertyId ?? "_"}`;
  }
  return `prospect:${s.prospectAuditId}`;
}
