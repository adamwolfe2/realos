import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { parseAiAnalysis } from "@/lib/reports/generate";

const valid = {
  summary: "s",
  actions: [{ priority: "high", title: "t", observation: "o", action: "a" }],
};

describe("parseAiAnalysis", () => {
  it("parses a ```json fenced response", () => {
    const out = parseAiAnalysis("```json\n" + JSON.stringify(valid) + "\n```");
    expect(out.actions).toHaveLength(1);
  });
  it("rejects JSON missing actions", () => {
    expect(() => parseAiAnalysis('{"summary":"x"}')).toThrow();
  });
  it("rejects non-JSON text", () => {
    expect(() => parseAiAnalysis("sorry")).toThrow();
  });
});
