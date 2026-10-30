import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { leaseMonths } from "@/lib/leasing/summary";
import { displayLeadSource, humanLeadSource } from "@/lib/format";

describe("leaseMonths", () => {
  it("counts the months between the lease dates, fractions included", () => {
    // endDate is inclusive: Jan 1 - Dec 31 is a full 365 days.
    expect(leaseMonths({ startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), termMonths: null })).toBeCloseTo(365 / 30.44, 4);
    expect(leaseMonths({ startDate: new Date("2026-08-15"), endDate: new Date("2027-07-31"), termMonths: null })).toBeCloseTo(351 / 30.44, 4);
  });

  it("falls back to the stored term, then 12", () => {
    expect(leaseMonths({ startDate: null, endDate: null, termMonths: 9 })).toBe(9);
    expect(leaseMonths({ startDate: null, endDate: null, termMonths: null })).toBe(12);
    // Bad dates (end before start) never yield zero or negative value.
    expect(leaseMonths({ startDate: new Date("2026-08-01"), endDate: new Date("2026-07-01"), termMonths: null })).toBe(12);
  });
});

describe("displayLeadSource", () => {
  it("labels AppFolio-imported OTHER leads as AppFolio", () => {
    expect(displayLeadSource("OTHER", "appfolio")).toBe("APPFOLIO");
    expect(humanLeadSource("APPFOLIO")).toBe("AppFolio");
  });

  it("leaves every other source alone", () => {
    expect(displayLeadSource("OTHER", null)).toBe("OTHER");
    expect(displayLeadSource("CHATBOT", "appfolio")).toBe("CHATBOT");
  });
});
