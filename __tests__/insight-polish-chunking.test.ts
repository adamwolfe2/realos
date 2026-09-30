import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DetectedInsight } from "@/lib/insights/types";

// ---------------------------------------------------------------------------
// Regression (2026-09-29): polishInsights sent 25-97 insights in ONE Haiku
// call capped at 2048 output tokens. The JSON truncated and ~85% of runs
// failed with "No object generated: could not parse the response." Batches
// must stay small, and one failed batch must not drop the others' polish.
// ---------------------------------------------------------------------------

const generateObject = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateObject }));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: vi.fn(() => "model") }));
vi.mock("@/lib/cost-tracker/log", () => ({ logUsage: vi.fn(async () => {}) }));

const { polishInsights, POLISH_CHUNK_SIZE } = await import(
  "@/lib/insights/llm-polish"
);

function insight(n: number): DetectedInsight {
  return {
    kind: "traffic_drop",
    category: "traffic",
    severity: "info",
    title: `raw ${n}`,
    body: "raw body",
  } as unknown as DetectedInsight;
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test";
  generateObject.mockReset();
});

describe("polishInsights chunking", () => {
  it("splits a 27-insight run into calls of at most POLISH_CHUNK_SIZE and keeps order", async () => {
    generateObject.mockImplementation(async ({ prompt }: { prompt: string }) => {
      const ids = [...prompt.matchAll(/^id: (i\d+)$/gm)].map((m) => m[1]);
      expect(ids.length).toBeLessThanOrEqual(POLISH_CHUNK_SIZE);
      const titles = [...prompt.matchAll(/^raw_title: (.*)$/gm)].map((m) => m[1]);
      return {
        object: {
          insights: ids.map((id, k) => ({
            id,
            title: `polished ${titles[k]}`,
            body: "b",
            suggestedAction: "a",
          })),
        },
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    });

    const input = Array.from({ length: 27 }, (_, i) => insight(i));
    const out = await polishInsights(input);

    expect(generateObject).toHaveBeenCalledTimes(3);
    expect(out.map((o) => o.title)).toEqual(input.map((_, i) => `polished raw ${i}`));
  });

  it("falls back to raw copy only for the batch that failed", async () => {
    let call = 0;
    generateObject.mockImplementation(async ({ prompt }: { prompt: string }) => {
      if (call++ === 1) throw new Error("No object generated");
      const ids = [...prompt.matchAll(/^id: (i\d+)$/gm)].map((m) => m[1]);
      return {
        object: {
          insights: ids.map((id) => ({ id, title: "P", body: "b", suggestedAction: "a" })),
        },
        usage: {},
      };
    });

    const out = await polishInsights(Array.from({ length: 25 }, (_, i) => insight(i)));

    expect(out).toHaveLength(25);
    expect(out.filter((o) => o.title === "P")).toHaveLength(15);
    expect(out[10].title).toBe("raw 10");
  });
});
