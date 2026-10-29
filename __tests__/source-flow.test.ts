import { describe, expect, it } from "vitest";
import { buildSourceFlow } from "@/lib/leads/source-flow";

describe("buildSourceFlow", () => {
  it("counts a lead at every stage it reached and sorts sources by volume", () => {
    const { rows, totals } = buildSourceFlow([
      { source: "CHATBOT", status: "NEW", count: 5 },
      { source: "CHATBOT", status: "SIGNED", count: 2 },
      { source: "GOOGLE_ADS", status: "APPLIED", count: 3 },
      { source: "GOOGLE_ADS", status: "LOST", count: 1 },
      { source: "META_ADS", status: "TOURED", count: 1 },
    ]);
    expect(rows.map((r) => r.source)).toEqual(["CHATBOT", "GOOGLE_ADS", "META_ADS"]);
    expect(rows[0].counts).toEqual([7, 2, 2, 2]);
    expect(rows[1].counts).toEqual([4, 3, 3, 0]);
    expect(rows[2].counts).toEqual([1, 1, 0, 0]);
    expect(totals).toEqual([12, 6, 5, 2]);
  });

  it("returns empty rows for no data", () => {
    expect(buildSourceFlow([])).toEqual({ rows: [], totals: [0, 0, 0, 0] });
  });
});
