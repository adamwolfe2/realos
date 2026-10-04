import { describe, it, expect, vi, beforeEach } from "vitest";

// F-139: when the global spend cap trips, the audit narrative falls back to
// the deterministic text; Claude is never called and nothing throws.

const h = vi.hoisted(() => ({ generateText: vi.fn(), withSpendCap: vi.fn() }));
vi.mock("ai", () => ({ generateText: h.generateText }));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: (m: string) => m }));
vi.mock("@/lib/cost-tracker/log", () => ({ logUsage: vi.fn() }));
vi.mock("@/lib/cost-tracker/cap", () => ({ withSpendCap: h.withSpendCap }));

import { synthesizeAudit } from "@/lib/audit/synthesize";

const provider = {
  brandName: "Oak Flats",
  domain: "oak.example",
  rankedKeywords: null,
  lighthouse: null,
  lighthouseAudits: null,
  pageAudit: null,
  backlinks: null,
  mentions: [],
  aeoCompetitorsCited: [],
  aeoCitedEngines: [],
  aeoUncitedEngines: [],
} as never;
const signals = {
  seo: null,
  aeo: null,
  reputation: null,
  traffic: null,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test";
});

describe("synthesizeAudit narrative under the spend cap", () => {
  it("falls back without calling Claude when the cap is hit", async () => {
    h.withSpendCap.mockResolvedValue({
      status: "skipped_cap",
      reason: "cap",
      spentUsd: 500,
      capUsd: 200,
    });
    const out = await synthesizeAudit(signals, provider);
    expect(h.withSpendCap).toHaveBeenCalledTimes(1);
    expect(h.generateText).not.toHaveBeenCalled();
    expect(out.claudeSummary.length).toBeGreaterThan(0);
  });
});
