import "server-only";

import {
  COMPUTE_VERSION,
  scopeKey,
  type AeoSignal,
  type ChatbotSignal,
  type LeadsSignal,
  type ReputationSignal,
  type SeoSignal,
  type SignalScope,
  type SignalSnapshot,
  type TrafficSignal,
} from "./types";

// ----------------------------------------------------------------------------
// TenantScope is still mocked. TODO(phase 3): replace with real fan-out:
//   - SEO/AEO/Reputation pulled from sync-orchestrator + portfolio rollups.
//   - Chatbot/Leads/Traffic pulled from the operator's own data.
// Kept here so the prospect path in compute.ts stays focused on real
// providers and the mock isn't sitting next to it.
// ----------------------------------------------------------------------------

export function computeMockTenantSignals(scope: SignalScope): SignalSnapshot {
  const startedAt = Date.now();
  const key = scopeKey(scope);
  const seed = hashSeed(key);
  const rand = mulberry32(seed);

  const seo: SeoSignal = {
    organicKeywords: 80 + Math.floor(rand() * 400),
    top10Count: 5 + Math.floor(rand() * 30),
    avgPosition: round(8 + rand() * 12, 1),
    estimatedTraffic: 200 + Math.floor(rand() * 5000),
    lighthouseScore: 60 + Math.floor(rand() * 40),
    backlinks: 30 + Math.floor(rand() * 800),
    referringDomains: 10 + Math.floor(rand() * 150),
    topMovers: [
      { keyword: "luxury apartments", from: 14, to: 6, volume: 1900 },
      { keyword: "downtown lofts", from: 22, to: 11, volume: 720 },
      { keyword: "pet friendly rentals", from: 9, to: 17, volume: 1100 },
    ],
    score: 50 + Math.floor(rand() * 45),
  };
  const aeo: AeoSignal = {
    enginesChecked: 4,
    citationsFound: 1 + Math.floor(rand() * 3),
    citationRate: round(rand() * 0.75 + 0.1, 2),
    byEngine: {
      claude: { cited: rand() > 0.4, sources: ["site.com/about"] },
      chatgpt: { cited: rand() > 0.6, sources: [] },
      gemini: { cited: rand() > 0.5, sources: ["site.com"] },
      perplexity: { cited: rand() > 0.3, sources: ["site.com/blog"] },
    },
    score: 40 + Math.floor(rand() * 55),
  };
  const reputation: ReputationSignal = {
    totalMentions: 20 + Math.floor(rand() * 300),
    avgRating: round(3.5 + rand() * 1.4, 2),
    sentimentMix: pickSentiment(rand),
    newNegative7d: Math.floor(rand() * 6),
    topThemes: ["pricing", "maintenance response", "amenities", "location"],
    score: 45 + Math.floor(rand() * 50),
  };
  const chatbot: ChatbotSignal = {
    conversations: 25 + Math.floor(rand() * 200),
    engagedRate: round(0.4 + rand() * 0.45, 2),
    avgMessages: round(3 + rand() * 6, 1),
    leadConversion: round(0.05 + rand() * 0.2, 2),
    score: 50 + Math.floor(rand() * 45),
  };
  const leads: LeadsSignal = {
    newLeads: 10 + Math.floor(rand() * 80),
    qualified: 4 + Math.floor(rand() * 35),
    cpl: round(20 + rand() * 90, 2),
    conversionRate: round(0.08 + rand() * 0.25, 2),
    pipelineValue: 5000 + Math.floor(rand() * 75000),
    score: 45 + Math.floor(rand() * 50),
  };
  const traffic: TrafficSignal = {
    sessions: 300 + Math.floor(rand() * 8000),
    source: "ga",
    bounceRate: round(0.35 + rand() * 0.4, 2),
    topPages: [
      { url: "/", visits: 1200 + Math.floor(rand() * 1500) },
      { url: "/floor-plans", visits: 400 + Math.floor(rand() * 800) },
      { url: "/contact", visits: 80 + Math.floor(rand() * 250) },
    ],
    score: 50 + Math.floor(rand() * 40),
  };

  let weight = 0;
  let acc = 0;
  const sections: Array<[number, number]> = [
    [seo.score, 30],
    [aeo.score, 20],
    [reputation.score, 20],
    [chatbot.score, 10],
    [leads.score, 15],
    [traffic.score, 5],
  ];
  for (const [s, w] of sections) {
    acc += s * w;
    weight += w;
  }
  const overallScore = weight > 0 ? Math.round(acc / weight) : 0;

  return {
    capturedOn: todayUtcDateString(),
    scopeKey: key,
    seo,
    aeo,
    reputation,
    chatbot,
    leads,
    traffic,
    overallScore,
    deltas7d: mockDeltas(rand),
    computeMs: Date.now() - startedAt,
    computeVersion: COMPUTE_VERSION,
  };
}

function pickSentiment(rand: () => number) {
  const pos = round(0.45 + rand() * 0.3, 2);
  const neg = round(0.05 + rand() * 0.2, 2);
  const neu = round(Math.max(0, 1 - pos - neg), 2);
  return { positive: pos, neutral: neu, negative: neg };
}

function mockDeltas(rand: () => number): Record<string, number> {
  const sign = () => (rand() > 0.5 ? 1 : -1);
  return {
    overall: round(sign() * rand() * 6, 1),
    seo: round(sign() * rand() * 8, 1),
    aeo: round(sign() * rand() * 10, 1),
    reputation: round(sign() * rand() * 4, 1),
    traffic: round(sign() * rand() * 12, 1),
  };
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function todayUtcDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
