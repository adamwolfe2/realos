import { describe, it, expect } from "vitest";
import { conversionPct, sourceLabel } from "@/lib/reports/portfolio-funnel";

describe("portfolio funnel helpers", () => {
  it("conversionPct computes step-down percentage", () => {
    expect(conversionPct(50, 200)).toBe(25);
    expect(conversionPct(1, 3)).toBe(33);
  });

  it("conversionPct guards division by zero", () => {
    expect(conversionPct(5, 0)).toBeUndefined();
    expect(conversionPct(0, 0)).toBeUndefined();
  });

  it("conversionPct caps at 100 when a later stage exceeds the prior", () => {
    // Records can arrive out of order within the window (an application synced
    // for a lead created before the window). Never show >100%.
    expect(conversionPct(12, 10)).toBe(100);
  });

  it("conversionPct is 0 when numerator is 0 but prior has volume", () => {
    expect(conversionPct(0, 40)).toBe(0);
  });

  it("sourceLabel humanizes known enum values and passes through unknowns", () => {
    expect(sourceLabel("GOOGLE_ADS")).toBe("Google Ads");
    expect(sourceLabel("CHATBOT")).toBe("Chatbot");
    expect(sourceLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});
