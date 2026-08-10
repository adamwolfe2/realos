import { describe, expect, it } from "vitest";
import {
  parseAttributionDateRange,
  parseAttributionSource,
} from "@/lib/attribution/proof-filters";

describe("attribution proof filters", () => {
  it("uses an inclusive UTC range for page and export parity", () => {
    const range = parseAttributionDateRange(
      "2026-07-01",
      "2026-07-31",
      new Date("2026-08-09T12:00:00.000Z"),
    );

    expect(range.fromDate.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(range.toDate.toISOString()).toBe("2026-07-31T23:59:59.000Z");
    expect(range.fromIso).toBe("2026-07-01");
    expect(range.toIso).toBe("2026-07-31");
  });

  it("rejects invalid sources and unsafe date windows", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const range = parseAttributionDateRange("2024-01-01", "2026-08-09", now);

    expect(parseAttributionSource("CHATBOT")).toBe("CHATBOT");
    expect(parseAttributionSource("NOT_A_SOURCE")).toBeNull();
    expect(range.fromIso).toBe("2026-07-10");
    expect(range.toIso).toBe("2026-08-09");
  });
});
