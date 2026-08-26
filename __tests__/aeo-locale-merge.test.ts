/**
 * The Haiku locale tier stopped short-circuiting on a schema city
 * (2026-08-26, .claude/specs/2026-08-26-aeo-report-generator-handoff.md
 * slice 3). Before this, every audit whose homepage carried an address got
 * city + region and nothing else: neighborhood and amenity were always
 * null and category was always the "apartments"/"senior" two-way default,
 * so discovery prompts read "best apartments in <city>" on 100% of live
 * reports. Markup still wins on city/region; the LLM fills the rest.
 *
 * Separate file from aeo-discovery-prompts.test.ts because it mocks the AI
 * SDK and the cost logger, and that suite must keep exercising the real ones.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  generateObject: vi.fn(),
  logUsage: vi.fn(async () => {}),
}));

vi.mock("ai", () => ({ generateObject: h.generateObject }));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: (id: string) => ({ id }) }));
vi.mock("@/lib/cost-tracker/log", () => ({ logUsage: h.logUsage }));
vi.mock("@/lib/aeo/engines/pricing", () => ({ tokenCostUsd: () => 0.001 }));

import { derivePropertyLocale } from "@/lib/audit/derive-locale";

const SCHEMA_HTML = `<script type="application/ld+json">
  {"@type":"ApartmentComplex","name":"Telegraph Commons",
   "address":{"@type":"PostalAddress","addressLocality":"Berkeley","addressRegion":"CA"}}
</script>`;

function siteCrawl(overrides: Record<string, unknown> = {}) {
  return {
    html: SCHEMA_HTML,
    title: "Telegraph Commons — Student Apartments Near UC Berkeley",
    description: "Furnished student housing steps from campus.",
    schemaTypes: ["ApartmentComplex"],
    h1FirstText: null,
    canonical: null,
    ...overrides,
  } as never;
}

function llmReturns(object: Record<string, unknown>) {
  h.generateObject.mockResolvedValue({
    object: {
      city: null,
      state: null,
      neighborhood: null,
      category: null,
      amenity: null,
      ...object,
    },
    usage: { inputTokens: 1200, outputTokens: 40 },
  });
}

describe("derivePropertyLocale merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("calls the LLM tier even when schema already gave a city", async () => {
    llmReturns({ neighborhood: "Southside", category: "student apartments" });
    const locale = await derivePropertyLocale(siteCrawl(), null);
    expect(h.generateObject).toHaveBeenCalledTimes(1);
    expect(locale.neighborhood).toBe("Southside");
    expect(locale.category).toBe("student apartments");
    expect(locale.amenity).toBeNull();
  });

  it("keeps the schema city even when the LLM names a different one", async () => {
    llmReturns({ city: "Oakland", state: "CA", amenity: "rooftop deck" });
    const locale = await derivePropertyLocale(siteCrawl(), null);
    expect(locale.city).toBe("Berkeley");
    expect(locale.region).toBe("CA");
    expect(locale.source).toBe("schema");
    expect(locale.amenity).toBe("rooftop deck");
  });

  it("takes the LLM state code when the markup omitted addressRegion", async () => {
    const html = SCHEMA_HTML.replace(',"addressRegion":"CA"', "");
    llmReturns({ city: "Berkeley", state: "ca" });
    const locale = await derivePropertyLocale(siteCrawl({ html }), null);
    expect(locale.city).toBe("Berkeley");
    expect(locale.region).toBe("CA");
  });

  it("does not borrow a state code from a disagreeing LLM city", async () => {
    const html = SCHEMA_HTML.replace(',"addressRegion":"CA"', "");
    llmReturns({ city: "Austin", state: "TX" });
    const locale = await derivePropertyLocale(siteCrawl({ html }), null);
    expect(locale.city).toBe("Berkeley");
    expect(locale.region).toBeNull();
  });

  it("resolves an ambiguous two-address page through the LLM tier", async () => {
    const html = `<script type="application/ld+json">
      {"@graph":[
        {"address":{"addressLocality":"Berkeley","addressRegion":"CA"}},
        {"address":{"addressLocality":"Oakland","addressRegion":"CA"}}
      ]}
    </script>
    <body><h1>Now leasing lofts</h1><p>Live in the heart of the city, walk to
    transit, and tour our renovated loft floor plans this week.</p></body>`;
    llmReturns({ city: "Oakland", state: "CA", category: "lofts" });
    const locale = await derivePropertyLocale(siteCrawl({ html, title: null }), null);
    expect(locale.city).toBe("Oakland");
    expect(locale.source).toBe("llm");
    expect(locale.category).toBe("lofts");
  });

  it("falls back to the deterministic locale when the LLM call throws", async () => {
    h.generateObject.mockRejectedValue(new Error("upstream 529"));
    const locale = await derivePropertyLocale(siteCrawl(), null);
    expect(locale.city).toBe("Berkeley");
    expect(locale.category).toBe("apartments");
    expect(locale.source).toBe("schema");
  });

  it("skips the LLM tier with no API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const locale = await derivePropertyLocale(siteCrawl(), null);
    expect(h.generateObject).not.toHaveBeenCalled();
    expect(locale.city).toBe("Berkeley");
  });
});
