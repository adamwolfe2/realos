import { describe, it, expect } from "vitest";
import { parseCitation, extractCompetitorNames } from "@/lib/aeo/parse";

describe("lib/aeo/parse — parseCitation", () => {
  const target = {
    name: "Telegraph Commons",
    websiteUrl: "https://telegraphcommons.com",
    aliases: ["TGCC"],
  };

  it("returns CITED on exact name match", () => {
    const r = parseCitation(
      "If you're a Berkeley student, check out Telegraph Commons — it's right by campus.",
      target,
    );
    expect(r.status).toBe("CITED");
    expect(r.competitorsCited).toEqual([]);
  });

  it("is case-insensitive on name match", () => {
    const r = parseCitation(
      "TELEGRAPH commons is a popular pick.",
      target,
    );
    expect(r.status).toBe("CITED");
  });

  it("matches via alias", () => {
    const r = parseCitation(
      "Some operators refer to it as TGCC — solid building.",
      target,
    );
    expect(r.status).toBe("CITED");
  });

  it("returns CITED on URL match against the property domain", () => {
    const r = parseCitation(
      "More info at https://telegraphcommons.com/leasing — they have current pricing.",
      target,
    );
    expect(r.status).toBe("CITED");
    expect(r.citedUrl).toContain("telegraphcommons.com");
  });

  it("matches a subdomain of the property domain", () => {
    const r = parseCitation(
      "See pricing at leasing.telegraphcommons.com for the latest.",
      target,
    );
    expect(r.status).toBe("CITED");
    expect(r.citedUrl).toContain("telegraphcommons.com");
  });

  it("returns COMPETITOR_CITED when other apartments are listed but not ours", () => {
    const r = parseCitation(
      `Here are some top picks in Berkeley:
1. The Whitley Apartments
2. Park Lane Residences
3. Berkeley House`,
      target,
    );
    expect(r.status).toBe("COMPETITOR_CITED");
    expect(r.competitorsCited.length).toBeGreaterThan(0);
    expect(r.competitorsCited.join(" ")).toMatch(/whitley|park lane|berkeley house/i);
  });

  it("returns NOT_CITED for generic non-naming advice", () => {
    const r = parseCitation(
      "I don't have specific recommendations, but try browsing Zillow or Apartments.com for current listings in that area.",
      target,
    );
    expect(r.status).toBe("NOT_CITED");
  });

  it("returns NOT_CITED on empty response", () => {
    expect(parseCitation("", target).status).toBe("NOT_CITED");
    expect(parseCitation("   ", target).status).toBe("NOT_CITED");
  });

  it("handles smart quotes around the property name", () => {
    const r = parseCitation(
      "I'd recommend “Telegraph Commons” — solid amenities.",
      target,
    );
    expect(r.status).toBe("CITED");
  });

  it("does not flag the response as COMPETITOR_CITED when own property appears in a list", () => {
    const r = parseCitation(
      `Top picks:
1. Telegraph Commons
2. The Whitley`,
      target,
    );
    expect(r.status).toBe("CITED");
    expect(r.competitorsCited).toEqual([]);
  });
});

describe("lib/aeo/parse — extractCompetitorNames", () => {
  it("filters out owner aliases", () => {
    const text = `1. Telegraph Commons
2. The Whitley Apartments`;
    const competitors = extractCompetitorNames(text, ["Telegraph Commons"]);
    expect(competitors.join(" ")).not.toMatch(/telegraph commons/i);
    expect(competitors.join(" ")).toMatch(/whitley/i);
  });

  it("picks up bold-wrapped names", () => {
    const text = "Consider **The Whitley Apartments** or **Park Lofts** — both are solid.";
    const competitors = extractCompetitorNames(text, []);
    expect(competitors.join(" ")).toMatch(/whitley/i);
    expect(competitors.join(" ")).toMatch(/park lofts/i);
  });

  it("returns an empty list when no plausible names are present", () => {
    const text = "i'm not sure, you could try various options in the area";
    expect(extractCompetitorNames(text, [])).toEqual([]);
  });
});
