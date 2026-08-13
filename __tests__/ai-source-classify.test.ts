import { describe, it, expect } from "vitest";
import { classifySource } from "@/lib/attribution/source-taxonomy";

// AI-referral attribution (2026-08-14, slice 11) routes through the
// canonical taxonomy — these pin the AI category + the hostname-parse
// property that killed the standalone classifier (substring matching on
// the full URL booked Google SERPs mentioning "perplexity.ai" as AI).

describe("classifySource — AI engines", () => {
  it("classifies AI referrer hosts to category ai", () => {
    for (const [ref, label] of [
      ["https://chatgpt.com/", "ChatGPT"],
      ["https://chat.openai.com/c/abc", "ChatGPT"],
      ["https://www.perplexity.ai/search?q=x", "Perplexity"],
      ["https://gemini.google.com/app", "Gemini"],
      ["https://copilot.microsoft.com/", "Copilot"],
      ["https://claude.ai/chat/x", "Claude"],
    ] as const) {
      const src = classifySource(null, ref);
      expect(src.category, ref).toBe("ai");
      expect(src.label, ref).toBe(label);
    }
  });

  it("classifies AI utm_source without a referrer", () => {
    expect(classifySource("chatgpt", null).category).toBe("ai");
    expect(classifySource("copilot", null).label).toBe("Copilot");
  });

  it("does not classify lookalike URLs as AI (hostname parse, not substring)", () => {
    // Google SERP whose QUERY mentions an AI engine — the standalone
    // classifier's worst false positive.
    expect(
      classifySource(null, "https://www.google.com/search?q=perplexity.ai+reviews").category,
    ).not.toBe("ai");
    // Path/query fragments naming an engine on an unrelated host.
    expect(
      classifySource(null, "https://example.com/floorplans?ref=chatgpt.com").category,
    ).not.toBe("ai");
  });
});
