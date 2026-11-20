import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The weekly ads brief is one per org, written from every property. On
// "The Lair · Paid ads" it read as The Lair's own brief.

const { WeeklyBrief } = await import("@/app/portal/ads/weekly-brief");

const brief = {
  title: "Spend up 20%, leads flat",
  body: "",
  weekStart: "2026-11-09",
  decisions: [],
  thisWeek: null,
  lastWeek: null,
};

describe("WeeklyBrief label", () => {
  it("says whole portfolio on a single property's view", () => {
    const html = renderToStaticMarkup(createElement(WeeklyBrief, { brief, portfolioWide: true }));
    expect(html).toContain("whole portfolio");
    expect(html).toContain("Covers every property");
  });
  it("stays unlabelled on the portfolio view", () => {
    const html = renderToStaticMarkup(createElement(WeeklyBrief, { brief }));
    expect(html).not.toContain("whole portfolio");
  });
});
