import { describe, it, expect } from "vitest";
import { deriveStarterQueries } from "@/lib/seo/derive-queries";

// ---------------------------------------------------------------------------
// Unit tests for deriveStarterQueries(). Pure logic — no DB, no API.
// Covers:
//   - Empty / nameless property → 0 queries (graceful)
//   - Residential subtype mapping (student housing, multifamily, senior, etc.)
//   - Commercial subtype mapping (office, retail, industrial, etc.)
//   - Fallback to propertyType when subtype is missing
//   - 4-query cap enforced
//   - Dedupe of accidental collisions
//   - Intent tagging
// ---------------------------------------------------------------------------

function makeProp(over: Partial<Parameters<typeof deriveStarterQueries>[0]>) {
  return {
    name: "",
    city: null,
    state: null,
    addressLine1: null,
    residentialSubtype: null,
    commercialSubtype: null,
    propertyType: null,
    ...over,
  } as Parameters<typeof deriveStarterQueries>[0];
}

describe("deriveStarterQueries", () => {
  it("returns 0 queries for a fully empty property", () => {
    expect(deriveStarterQueries(makeProp({}))).toEqual([]);
  });

  it("returns just the branded query when only name is set", () => {
    const result = deriveStarterQueries(
      makeProp({ name: "Telegraph Commons" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      query: "Telegraph Commons",
      intent: "branded",
    });
  });

  it("generates 4 queries for a fully populated student-housing property", () => {
    const result = deriveStarterQueries(
      makeProp({
        name: "Telegraph Commons",
        city: "Milwaukee",
        residentialSubtype: "STUDENT_HOUSING",
        propertyType: "RESIDENTIAL",
      }),
    );
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.intent)).toEqual([
      "branded",
      "local",
      "local",
      "transactional",
    ]);
    expect(result[1].query).toBe("student housing in Milwaukee");
    expect(result[2].query).toBe("student housing near Milwaukee");
    expect(result[3].query).toBe("student housing for rent Milwaukee");
  });

  it("maps each residential subtype to its canonical label", () => {
    const subtypeCases: Array<[string, string]> = [
      ["STUDENT_HOUSING", "student housing"],
      ["MULTIFAMILY", "apartments"],
      ["SENIOR_LIVING", "senior living"],
      ["SINGLE_FAMILY_RENTAL", "rental homes"],
      ["CO_LIVING", "co-living"],
      ["SHORT_TERM_RENTAL", "short-term rentals"],
    ];
    for (const [subtype, label] of subtypeCases) {
      const result = deriveStarterQueries(
        makeProp({
          name: "X",
          city: "Madison",
          residentialSubtype: subtype as never,
          propertyType: "RESIDENTIAL",
        }),
      );
      const local = result.find((r) => r.query.startsWith(`${label} in `));
      expect(local?.query, `subtype=${subtype}`).toBe(`${label} in Madison`);
    }
  });

  it("maps each commercial subtype to its canonical label", () => {
    const cases: Array<[string, string]> = [
      ["OFFICE", "office space"],
      ["RETAIL", "retail space"],
      ["INDUSTRIAL", "industrial space"],
      ["MIXED_USE", "mixed-use space"],
      ["FLEX_SPACE", "flex space"],
      ["MEDICAL_OFFICE", "medical office space"],
    ];
    for (const [subtype, label] of cases) {
      const result = deriveStarterQueries(
        makeProp({
          name: "X",
          city: "Chicago",
          commercialSubtype: subtype as never,
          propertyType: "COMMERCIAL",
        }),
      );
      const found = result.find((r) => r.query.startsWith(`${label} in `));
      expect(found?.query, `subtype=${subtype}`).toBe(`${label} in Chicago`);
    }
  });

  it("falls back to propertyType when subtype is null", () => {
    const residential = deriveStarterQueries(
      makeProp({
        name: "X",
        city: "Austin",
        propertyType: "RESIDENTIAL",
      }),
    );
    expect(residential.some((r) => r.query === "apartments in Austin")).toBe(true);

    const commercial = deriveStarterQueries(
      makeProp({
        name: "X",
        city: "Austin",
        propertyType: "COMMERCIAL",
      }),
    );
    expect(
      commercial.some((r) => r.query === "commercial space in Austin"),
    ).toBe(true);
  });

  it("never returns more than 4 queries", () => {
    const result = deriveStarterQueries(
      makeProp({
        name: "Telegraph Commons",
        city: "Milwaukee",
        residentialSubtype: "STUDENT_HOUSING",
        propertyType: "RESIDENTIAL",
      }),
    );
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it("dedupes when branded name accidentally equals a derived query", () => {
    const result = deriveStarterQueries(
      makeProp({
        // Contrived but possible: branded name shadows a derived query.
        name: "apartments in Madison",
        city: "Madison",
        residentialSubtype: "MULTIFAMILY",
        propertyType: "RESIDENTIAL",
      }),
    );
    const seen = new Set<string>();
    for (const r of result) {
      expect(seen.has(r.query.toLowerCase())).toBe(false);
      seen.add(r.query.toLowerCase());
    }
  });

  it("does not produce a transactional query without a city", () => {
    const result = deriveStarterQueries(
      makeProp({
        name: "X",
        residentialSubtype: "STUDENT_HOUSING",
        propertyType: "RESIDENTIAL",
      }),
    );
    const hasTransactional = result.some(
      (r) => r.intent === "transactional",
    );
    expect(hasTransactional).toBe(false);
  });
});
