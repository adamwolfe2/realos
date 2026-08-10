import { describe, expect, it } from "vitest";
import { summarizeAttributionFlow } from "@/lib/attribution/proof-model";

describe("attribution flow summary", () => {
  it("separates LeaseStack sources and excludes imported PMS leads", () => {
    const summary = summarizeAttributionFlow([
      { source: "CHATBOT", stage: "New lead", verification: "leasestack_only" },
      { source: "CHATBOT", stage: "Applied", verification: "leasestack_only" },
      { source: "FORM", stage: "Applied", verification: "leasestack_only" },
      { source: "PIXEL_OUTREACH", stage: "Signed", verification: "verified" },
      { source: "ORGANIC", stage: "Approved", verification: "leasestack_only" },
      { source: "OTHER", stage: "Applied", verification: "imported" },
    ]);

    expect(summary).toEqual({
      captured: 5,
      chatbot: 2,
      forms: 1,
      visitorPixel: 1,
      other: 1,
      applied: 4,
      signed: 1,
    });
  });

  it("returns an honest zero state", () => {
    expect(summarizeAttributionFlow([])).toEqual({
      captured: 0,
      chatbot: 0,
      forms: 0,
      visitorPixel: 0,
      other: 0,
      applied: 0,
      signed: 0,
    });
  });
});
