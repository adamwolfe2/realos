/**
 * AEO discovery-prompts fix (2026-08-13,
 * .claude/specs/2026-08-13-aeo-discovery-prompts-fix.md).
 *
 * The prospect audit's old fan-out was a tautology: all 5 prompts were
 * branded and a name echo counted as CITED, so every property read
 * all-engines-cited. These tests pin the fix:
 *   1. locale derivation (deterministic tiers) from crawled HTML
 *   2. prompt split — discovery prompts must NEVER contain the brand
 *   3. verdict semantics — aware requires a domain citation on branded
 *      answers; discovered comes only from discovery answers; competitor
 *      names come only from discovery answers (unless branded-only mode)
 */
import { describe, expect, it } from "vitest";
import {
  parseLocaleFromCrawl,
  stripHtmlToText,
} from "@/lib/audit/derive-locale";
import {
  buildProspectPrompts,
  classifyEngineAnswers,
} from "@/lib/signals/compute";
import { parseCitation } from "@/lib/aeo/parse";

const BRAND = "Telegraph Commons";
const DOMAIN = "telegraphcommons.com";

function crawl(overrides: {
  html?: string | null;
  title?: string | null;
  description?: string | null;
  schemaTypes?: string[];
  h1FirstText?: string | null;
  canonical?: string | null;
}) {
  return {
    html: overrides.html ?? null,
    title: overrides.title ?? null,
    description: overrides.description ?? null,
    schemaTypes: overrides.schemaTypes ?? [],
    h1FirstText: overrides.h1FirstText ?? null,
    canonical: overrides.canonical ?? null,
  };
}

/** Two communities in one JSON-LD block — the operator-site shape. */
const TWO_ADDRESS_HTML = `<script type="application/ld+json">
  {"@graph":[
    {"@type":"ApartmentComplex","name":"Sister Property",
     "address":{"@type":"PostalAddress","addressLocality":"Berkeley","addressRegion":"CA"}},
    {"@type":"ApartmentComplex","name":"Telegraph Commons",
     "address":{"@type":"PostalAddress","addressLocality":"Oakland","addressRegion":"CA"}}
  ]}
</script>`;

describe("parseLocaleFromCrawl", () => {
  it("extracts city + region from JSON-LD PostalAddress", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@type":"ApartmentComplex",
       "name":"Telegraph Commons",
       "address":{"@type":"PostalAddress","addressLocality":"Berkeley",
                  "addressRegion":"CA","postalCode":"94704"}}
    </script></head><body></body></html>`;
    const locale = parseLocaleFromCrawl(crawl({ html }));
    expect(locale.city).toBe("Berkeley");
    expect(locale.region).toBe("CA");
    expect(locale.source).toBe("schema");
  });

  it("finds PostalAddress nested inside @graph arrays", () => {
    const html = `<script type="application/ld+json">
      {"@graph":[{"@type":"WebSite"},{"@type":"LocalBusiness",
        "location":{"address":{"addressLocality":"Austin","addressRegion":"TX"}}}]}
    </script>`;
    const locale = parseLocaleFromCrawl(crawl({ html }));
    expect(locale.city).toBe("Austin");
    expect(locale.region).toBe("TX");
  });

  it("falls back to a City, ST pattern in the title", () => {
    const locale = parseLocaleFromCrawl(
      crawl({ title: "Luxury Apartments in Berkeley, CA | Telegraph Commons" }),
    );
    expect(locale.city).toBe("Berkeley");
    expect(locale.region).toBe("CA");
    expect(locale.source).toBe("meta");
  });

  it("rejects a City, XX pattern with a bogus state code", () => {
    const locale = parseLocaleFromCrawl(
      crawl({ title: "Widgets, QQ — Best Prices" }),
    );
    expect(locale.city).toBeNull();
    expect(locale.source).toBe("none");
  });

  it("returns none when nothing is derivable (and on null crawl)", () => {
    expect(parseLocaleFromCrawl(crawl({})).source).toBe("none");
    expect(parseLocaleFromCrawl(null).city).toBeNull();
  });

  it("abstains when two properties are in the markup and nothing corroborates", () => {
    // Trusting the first address audited a sibling community's city.
    // Abstaining sends this to the LLM tier, which reads the whole page.
    const locale = parseLocaleFromCrawl(crawl({ html: TWO_ADDRESS_HTML }));
    expect(locale.city).toBeNull();
    expect(locale.source).toBe("none");
  });

  it("picks the address the title corroborates, not the first one", () => {
    const locale = parseLocaleFromCrawl(
      crawl({
        html: TWO_ADDRESS_HTML,
        title: "Telegraph Commons — Apartments in Oakland",
      }),
    );
    expect(locale.city).toBe("Oakland");
    expect(locale.source).toBe("schema");
  });

  it("picks the address the H1 or canonical corroborates", () => {
    expect(
      parseLocaleFromCrawl(crawl({ html: TWO_ADDRESS_HTML, h1FirstText: "Now leasing in Oakland" })).city,
    ).toBe("Oakland");
    expect(
      parseLocaleFromCrawl(crawl({ html: TWO_ADDRESS_HTML, canonical: "https://x.com/oakland/lofts" })).city,
    ).toBe("Oakland");
  });

  it("still resolves when the same city is repeated across blocks", () => {
    const html = `<script type="application/ld+json">
        {"address":{"addressLocality":"Denver","addressRegion":"CO"}}
      </script>
      <script type="application/ld+json">
        {"address":{"addressLocality":"denver"}}
      </script>`;
    const locale = parseLocaleFromCrawl(crawl({ html }));
    expect(locale.city).toBe("Denver");
    expect(locale.region).toBe("CO");
  });

  it("survives malformed JSON-LD blocks", () => {
    const html = `<script type="application/ld+json">{not json</script>
      <script type="application/ld+json">{"address":{"addressLocality":"Denver","addressRegion":"CO"}}</script>`;
    expect(parseLocaleFromCrawl(crawl({ html })).city).toBe("Denver");
  });
});

describe("stripHtmlToText", () => {
  it("drops scripts/styles/tags and collapses whitespace", () => {
    const text = stripHtmlToText(
      "<script>var x=1;</script><style>.a{}</style><h1>Berkeley   living</h1>",
    );
    expect(text).toBe("Berkeley living");
  });
});

describe("buildProspectPrompts", () => {
  it("splits 2 branded + 3 discovery when a city is known — discovery prompts never contain the brand", () => {
    const prompts = buildProspectPrompts(BRAND, DOMAIN, {
      city: "Berkeley",
      region: "CA",
      neighborhood: null,
      category: "apartments",
      amenity: null,
      source: "schema",
    });
    expect(prompts).toHaveLength(5);
    const branded = prompts.filter((p) => p.kind === "branded");
    const discovery = prompts.filter((p) => p.kind === "discovery");
    expect(branded).toHaveLength(2);
    expect(discovery).toHaveLength(3);
    for (const p of discovery) {
      expect(p.text.toLowerCase()).not.toContain("telegraph");
      expect(p.text.toLowerCase()).not.toContain(DOMAIN);
      expect(p.text).toContain("Berkeley");
    }
    for (const p of branded) {
      expect(p.text).toContain(BRAND);
    }
  });

  it("uses neighborhood + amenity variants when available", () => {
    const prompts = buildProspectPrompts(BRAND, DOMAIN, {
      city: "Berkeley",
      region: "CA",
      neighborhood: "Southside",
      category: "student apartments",
      amenity: "rooftop deck",
      source: "llm",
    });
    const texts = prompts.filter((p) => p.kind === "discovery").map((p) => p.text);
    expect(texts.some((t) => t.includes("rooftop deck"))).toBe(true);
    expect(texts.some((t) => t.includes("Southside"))).toBe(true);
  });

  it("falls back to the legacy 5 branded prompts without a city", () => {
    const prompts = buildProspectPrompts(BRAND, DOMAIN, {
      city: null,
      region: null,
      neighborhood: null,
      category: "apartments",
      amenity: null,
      source: "none",
    });
    expect(prompts).toHaveLength(5);
    expect(prompts.every((p) => p.kind === "branded")).toBe(true);
    expect(prompts.every((p) => p.text.includes(BRAND))).toBe(true);
  });

  it("falls back to branded-only on a null locale", () => {
    const prompts = buildProspectPrompts(BRAND, DOMAIN, null);
    expect(prompts.every((p) => p.kind === "branded")).toBe(true);
  });
});

describe("classifyEngineAnswers — verdict semantics", () => {
  const target = { name: BRAND, websiteUrl: DOMAIN };

  it("a name echo on a BRANDED answer counts for NOTHING (the old tautology)", () => {
    const parse = parseCitation(
      `${BRAND} is a well-reviewed building with modern amenities.`,
      target,
    );
    expect(parse.status).toBe("CITED"); // parser still matches the name…
    const verdict = classifyEngineAnswers([{ kind: "branded", parse }]);
    expect(verdict.aware).toBe(false); // …but no domain citation → not aware
    expect(verdict.discovered).toBe(false);
    expect(verdict.legacyCited).toBe(true); // legacy semantics preserved for fallback mode
  });

  it("a domain citation on a BRANDED answer = aware, not discovered", () => {
    const parse = parseCitation(
      `You can find details at https://telegraphcommons.com/floorplans.`,
      target,
    );
    const verdict = classifyEngineAnswers([{ kind: "branded", parse }]);
    expect(verdict.aware).toBe(true);
    expect(verdict.discovered).toBe(false);
    expect(verdict.sources[0]).toContain("telegraphcommons.com/floorplans");
  });

  it("a name match in a DISCOVERY answer = discovered", () => {
    const parse = parseCitation(
      `For Berkeley I'd look at:\n1. Telegraph Commons\n2. The Whitley Apartments`,
      target,
    );
    const verdict = classifyEngineAnswers([{ kind: "discovery", parse }]);
    expect(verdict.discovered).toBe(true);
    expect(verdict.aware).toBe(false);
  });

  it("competitors come from DISCOVERY answers only", () => {
    const discoveryParse = parseCitation(
      `Top picks:\n1. The Whitley Apartments\n2. Park Lane Lofts`,
      target,
    );
    const brandedParse = parseCitation(
      `Common complaints:\n1. Broken Facilities Everywhere\n2. Noise Problems Nightly`,
      target,
    );
    const verdict = classifyEngineAnswers([
      { kind: "discovery", parse: discoveryParse },
      { kind: "branded", parse: brandedParse },
    ]);
    expect(verdict.discovered).toBe(false);
    expect(verdict.competitors).toContain("The Whitley Apartments");
    // Branded-answer noise ("Broken Facilities…") must NOT leak in.
    expect(
      verdict.competitors.some((c) => c.toLowerCase().includes("broken")),
    ).toBe(false);
  });

  it("branded-only fallback keeps legacy competitor collection", () => {
    const brandedParse = parseCitation(
      `Consider:\n1. The Whitley Apartments`,
      target,
    );
    const withFlag = classifyEngineAnswers(
      [{ kind: "branded", parse: brandedParse }],
      { brandedCompetitors: true },
    );
    expect(withFlag.competitors).toContain("The Whitley Apartments");
    const withoutFlag = classifyEngineAnswers([
      { kind: "branded", parse: brandedParse },
    ]);
    expect(withoutFlag.competitors).toHaveLength(0);
  });

  it("empty answer set → all false", () => {
    const verdict = classifyEngineAnswers([]);
    expect(verdict).toEqual({
      discovered: false,
      aware: false,
      legacyCited: false,
      sources: [],
      competitors: [],
    });
  });
});
