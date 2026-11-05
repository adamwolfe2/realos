import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { aggregateAeoByQuestion } from "@/lib/reports/generate";

const onePager = readFileSync(
  "components/portal/reports/property-one-pager.tsx",
  "utf8",
);

describe("aggregateAeoByQuestion", () => {
  it("groups by prompt, counts CITED, sorts most-asked first, caps", () => {
    const rows = aggregateAeoByQuestion([
      { prompt: "best student apartments berkeley", status: "NOT_CITED" },
      { prompt: "best student apartments berkeley", status: "COMPETITOR_CITED" },
      { prompt: "best student apartments berkeley", status: "CITED" },
      { prompt: " tell me about telegraph commons ", status: "CITED" },
      { prompt: "tell me about telegraph commons", status: "CITED" },
      { prompt: "", status: "CITED" },
    ]);
    expect(rows).toEqual([
      { prompt: "best student apartments berkeley", total: 3, cited: 1 },
      { prompt: "tell me about telegraph commons", total: 2, cited: 2 },
    ]);
    expect(
      aggregateAeoByQuestion(
        rows.flatMap((r) => Array(3).fill({ prompt: r.prompt, status: "CITED" })),
        1,
      ),
    ).toHaveLength(1);
  });
});

describe("one-pager narrative + AI-by-question", () => {
  it("drops zero rows and gates every new block on data being present", () => {
    expect(onePager).toContain("(aeoStats?.byQuestion ?? []).filter((q) => q.total > 0)");
    expect(onePager).toContain("{aeoQuestionRows.length > 0 ? (");
    expect(onePager).toContain("{aiSummary ? (");
    expect(onePager).toContain("{aiActions.length > 0 ? (");
  });
});

describe("AI narrative prompt", () => {
  it("only sees figures the client one-pager renders (no ad spend, CPL, tours, funnel, occupancy, ad rows)", () => {
    const gen = readFileSync("lib/reports/generate.ts", "utf8");
    const start = gen.indexOf("const prompt = `You are writing the narrative");
    const end = gen.indexOf("Respond with ONLY valid JSON", start);
    expect(start).toBeGreaterThan(0);
    const prompt = gen.slice(start, end);
    for (const banned of [
      "adSpendUsd",
      "costPerLead",
      "kpis.tours",
      "snapshot.funnel",
      "adPerformance",
      "occupancyStats",
      "monthlyRentRollUsd",
    ]) {
      expect(prompt).not.toContain(banned);
    }
  });
});
