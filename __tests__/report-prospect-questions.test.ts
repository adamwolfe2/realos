import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { summarizeProspectQuestions, isQuotable } from "@/lib/reports/prospect-questions";
import { pageLabel } from "@/components/portal/reports/property-one-pager";

const t = (iso: string, ...user: string[]) => ({
  createdAt: new Date(iso),
  messages: user.flatMap((c) => [{ role: "user", content: c }, { role: "assistant", content: "ok" }]),
});

describe("summarizeProspectQuestions", () => {
  it("counts each theme once per conversation and skips empty transcripts", () => {
    const r = summarizeProspectQuestions([
      t("2026-10-01", "How much is a single room?", "what's the price for a double"),
      t("2026-10-02", "Do you have availability for the spring semester?"),
      { createdAt: new Date("2026-10-03"), messages: [] },
    ]);
    expect(r.conversations).toBe(2);
    expect(r.themes.find((x) => x.label === "Pricing")?.count).toBe(1);
    expect(r.themes.find((x) => x.label === "Room types & roommates")?.count).toBe(1);
    expect(r.themes.find((x) => x.label === "Availability")?.count).toBe(1);
    expect(r.examples[0]).toBe("Do you have availability for the spring semester?");
  });

  it("never quotes contact details or quick-reply chips", () => {
    expect(isQuotable("my email is jane@school.edu, can you send info?")).toBe(false);
    expect(isQuotable("Can you call me at 415-917-7505 about a room?")).toBe(false);
    expect(isQuotable("Current availability")).toBe(false);
    expect(isQuotable("I can't see the $756/mo option. How can I find it?")).toBe(false);
    expect(isQuotable("Are the rooms available in 2027 spring semester?")).toBe(true);
  });
});

describe("pageLabel", () => {
  it("labels GA4 paths for a client", () => {
    expect(pageLabel("/")).toBe("Home page");
    expect(pageLabel("/availability/655d627e-e82e-4b0c-89f1-a724311b9a49")).toBe("Unit listings");
    expect(pageLabel("/floor-plans")).toBe("Floor plans");
    expect(pageLabel("https://www.telegraphcommons.com/international")).toBe("International");
    expect(pageLabel("(not set)")).toBe("");
  });
});
