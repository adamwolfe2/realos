import { describe, it, expect } from "vitest";
import { classifyMentions } from "@/lib/aeo/classify-mentions";
import type { AiLlmMention } from "@/lib/seo/dataforseo";

function mention(
  name: string,
  position: number,
  citedUrl: string | null = null,
): AiLlmMention {
  return { name, position, citedUrl, kind: "other" };
}

describe("lib/aeo/classify-mentions — classifyMentions", () => {
  const target = {
    name: "Telegraph Commons",
    websiteUrl: "https://telegraphcommons.com",
  };

  it("returns zero SoV on empty mentions array", () => {
    const r = classifyMentions([], target);
    expect(r.shareOfVoice).toBe(0);
    expect(r.classified).toEqual([]);
    expect(r.selfCount).toBe(0);
    expect(r.competitorCount).toBe(0);
  });

  it("marks an exact-name mention as self", () => {
    const r = classifyMentions([mention("Telegraph Commons", 1)], target);
    expect(r.selfCount).toBe(1);
    expect(r.competitorCount).toBe(0);
    expect(r.shareOfVoice).toBe(1);
    expect(r.classified[0].kind).toBe("self");
  });

  it("is case-insensitive on name match", () => {
    const r = classifyMentions([mention("telegraph commons", 1)], target);
    expect(r.classified[0].kind).toBe("self");
  });

  it("matches host from citedUrl when name doesn't match", () => {
    const r = classifyMentions(
      [mention("TGC Apts", 1, "https://telegraphcommons.com/units")],
      target,
    );
    expect(r.classified[0].kind).toBe("self");
  });

  it("matches subdomain of brand host as self", () => {
    const r = classifyMentions(
      [mention("TGC", 1, "https://leasing.telegraphcommons.com")],
      target,
    );
    expect(r.classified[0].kind).toBe("self");
  });

  it("computes 50% SoV with one self + one competitor", () => {
    const r = classifyMentions(
      [
        mention("Telegraph Commons", 1),
        mention("Berkeley Riverwalk", 2, "https://riverwalk.com"),
      ],
      target,
    );
    expect(r.selfCount).toBe(1);
    expect(r.competitorCount).toBe(1);
    expect(r.shareOfVoice).toBeCloseTo(0.5);
  });

  it("marks every non-self entity as competitor when target identity is known", () => {
    const r = classifyMentions(
      [mention("Some Other Building", 1), mention("Another", 2)],
      target,
    );
    expect(r.selfCount).toBe(0);
    expect(r.competitorCount).toBe(2);
    expect(r.shareOfVoice).toBe(0);
    expect(r.classified.every((c) => c.kind === "competitor")).toBe(true);
  });

  it("falls back to 'other' for everything when target has no identity", () => {
    const r = classifyMentions(
      [mention("Some Building", 1), mention("Other Building", 2)],
      { name: null, websiteUrl: null },
    );
    expect(r.classified.every((c) => c.kind === "other")).toBe(true);
    expect(r.selfCount).toBe(0);
    expect(r.competitorCount).toBe(0);
    expect(r.shareOfVoice).toBe(0);
  });

  it("respects aliases", () => {
    const r = classifyMentions(
      [mention("TGCC", 1)],
      { name: "Telegraph Commons", websiteUrl: null, aliases: ["TGCC"] },
    );
    expect(r.classified[0].kind).toBe("self");
  });

  it("preserves position + citedUrl on classified output", () => {
    const r = classifyMentions(
      [mention("Telegraph Commons", 3, "https://telegraphcommons.com/about")],
      target,
    );
    expect(r.classified[0].position).toBe(3);
    expect(r.classified[0].citedUrl).toBe(
      "https://telegraphcommons.com/about",
    );
  });
});
