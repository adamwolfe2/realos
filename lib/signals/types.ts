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
      { cited: boolean; sources: string[] }
    >
  >;
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
export const COMPUTE_VERSION = "2026-05-28.v1";

export function scopeKey(s: SignalScope): string {
  if (s.kind === "tenant") {
    return `tenant:${s.orgId}:${s.propertyId ?? "_"}`;
  }
  return `prospect:${s.prospectAuditId}`;
}
