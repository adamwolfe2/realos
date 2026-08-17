import { describe, expect, it } from "vitest";
import { fillSnippet, KIT_SECTIONS, kitUrl } from "@/lib/sales-kit/kit";

describe("sales kit", () => {
  it("builds absolute rep-tagged URLs", () => {
    expect(kitUrl("/ai-visibility", "https://leasestack.co", "norman")).toBe(
      "https://leasestack.co/ai-visibility?ref=norman",
    );
  });

  it("does not double up an existing query string", () => {
    const url = kitUrl("/audit?x=1", "https://leasestack.co", "norman");
    expect(url).toBe("https://leasestack.co/audit?x=1&ref=norman");
  });

  it("fills every placeholder occurrence", () => {
    const out = fillSnippet("{{first}} — see {{link}} ({{link}})", "L", "Dana");
    expect(out).toBe("Dana — see L (L)");
  });

  it("falls back when no first name is given", () => {
    expect(fillSnippet("{{first}} — {{link}}", "L", "  ")).toBe(
      "Hi there — L",
    );
  });

  it("leaves no unfilled placeholders in any catalogue snippet", () => {
    for (const section of KIT_SECTIONS) {
      for (const link of section.links) {
        expect(link.href.startsWith("/")).toBe(true);
        if (!link.snippet) continue;
        const filled = fillSnippet(link.snippet, "L", "Dana");
        expect(filled).not.toContain("{{");
      }
    }
  });
});
