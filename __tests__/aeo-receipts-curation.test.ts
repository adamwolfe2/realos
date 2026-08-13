import { describe, it, expect } from "vitest";
import {
  curateEngineReceipts,
  toReceiptExcerpt,
} from "@/lib/signals/compute";
import { AeoReceiptsBlock } from "@/components/audit/aeo-receipts";

const cited = { status: "CITED" as const, citedUrl: "https://x.com", competitorsCited: [] };
const citedNoUrl = { status: "CITED" as const, competitorsCited: [] };
const compCited = { status: "COMPETITOR_CITED" as const, competitorsCited: ["Rival Lofts"] };
const notCited = { status: "NOT_CITED" as const, competitorsCited: [] };

describe("toReceiptExcerpt", () => {
  it("strips markdown links, headings, and bold", () => {
    const out = toReceiptExcerpt(
      "## Best options\n**Telegraph Commons** is [great](https://tc.com) for students.",
    );
    expect(out).toBe("Best options Telegraph Commons is great for students.");
  });

  it("caps at ~500 chars on a word boundary with ellipsis", () => {
    const long = Array(120).fill("word").join(" ");
    const out = toReceiptExcerpt(long);
    expect(out.length).toBeLessThanOrEqual(501);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/wor…$/); // no mid-word cut
  });

  it("returns short text unchanged", () => {
    expect(toReceiptExcerpt("Plain answer.")).toBe("Plain answer.");
  });
});

describe("curateEngineReceipts", () => {
  it("returns one receipt per prompt-kind, discovery first", () => {
    const receipts = curateEngineReceipts("CHATGPT", [
      { kind: "branded", prompt: "About X?", text: "X is fine.", parse: citedNoUrl },
      { kind: "discovery", prompt: "Best apts?", text: "Try X.", parse: cited },
    ]);
    expect(receipts).toHaveLength(2);
    expect(receipts[0].kind).toBe("discovery");
    expect(receipts[1].kind).toBe("branded");
  });

  it("prefers a CITED discovery answer over a competitor-only one", () => {
    const receipts = curateEngineReceipts("GEMINI", [
      { kind: "discovery", prompt: "p1", text: "Rival Lofts is best.", parse: compCited },
      { kind: "discovery", prompt: "p2", text: "X is the top pick.", parse: cited },
    ]);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].prompt).toBe("p2");
  });

  it("prefers a competitor-citing discovery answer over NOT_CITED", () => {
    const receipts = curateEngineReceipts("CLAUDE", [
      { kind: "discovery", prompt: "p1", text: "I can't say.", parse: notCited },
      { kind: "discovery", prompt: "p2", text: "Rival Lofts wins.", parse: compCited },
    ]);
    expect(receipts[0].prompt).toBe("p2");
  });

  it("prefers a domain-cited branded answer over a bare name echo", () => {
    const receipts = curateEngineReceipts("PERPLEXITY", [
      { kind: "branded", prompt: "p1", text: "X exists somewhere.", parse: citedNoUrl },
      { kind: "branded", prompt: "p2", text: "See x.com for X.", parse: cited },
    ]);
    expect(receipts[0].prompt).toBe("p2");
  });

  it("skips empty answers and returns [] when nothing usable", () => {
    expect(
      curateEngineReceipts("CHATGPT", [
        { kind: "discovery", prompt: "p", text: "   ", parse: notCited },
      ]),
    ).toEqual([]);
  });
});

describe("legacy-audit rendering constraint", () => {
  it("AeoReceiptsBlock renders nothing when the additive field is absent/empty", () => {
    // Legacy findings JSONB has no aeoReceipts — page.tsx defaults to []
    // and the block must contribute zero DOM.
    expect(
      AeoReceiptsBlock({ receipts: [], brandName: "X", competitors: [] }),
    ).toBeNull();
  });
});
