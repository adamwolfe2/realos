/**
 * Identity resolution (2026-08-26 slice 1,
 * .claude/specs/2026-08-26-aeo-report-generator-handoff.md).
 *
 * The /audit quiz posts a URL and no name, so the domain splitter decided
 * who four engines were asked about: `theeddyresidences.com` became
 * "Theeddy Residences", `thewarwickhillcrest.com` became
 * "Thewarwickhillcrest". The homepage carries the real name in three
 * places; these pin the precedence and the floor.
 */
import { describe, expect, it } from "vitest";
import { resolveIdentity } from "@/lib/audit/derive-identity";

function crawl(overrides: {
  html?: string | null;
  title?: string | null;
  resolvedUrl?: string | null;
}) {
  return {
    html: overrides.html ?? null,
    title: overrides.title ?? null,
    resolvedUrl: overrides.resolvedUrl ?? null,
  };
}

const SCHEMA = (name: string, type = "ApartmentComplex") =>
  `<script type="application/ld+json">{"@context":"https://schema.org",
    "@type":"${type}","name":"${name}",
    "address":{"@type":"PostalAddress","addressLocality":"Berkeley"}}</script>`;

describe("resolveIdentity", () => {
  it("uses what the prospect typed above everything else", () => {
    const id = resolveIdentity({
      supplied: "  The Warwick  ",
      domain: "thewarwickhillcrest.com",
      crawl: crawl({ html: SCHEMA("Warwick Hillcrest Apartments") }),
    });
    expect(id.name).toBe("The Warwick");
    expect(id.nameSource).toBe("supplied");
    expect(id.confidence).toBe("high");
  });

  it("reads schema.org name off a name-bearing node", () => {
    const id = resolveIdentity({
      supplied: null,
      domain: "theeddyresidences.com",
      crawl: crawl({ html: SCHEMA("The Eddy Residences") }),
    });
    expect(id.name).toBe("The Eddy Residences");
    expect(id.nameSource).toBe("schema");
  });

  it("ignores a name on a node type that isn't the property", () => {
    // A WebSite/BreadcrumbList name is the site's nav, not the entity.
    const html = `<script type="application/ld+json">
      {"@type":"WebSite","name":"Home - Official Site"}</script>`;
    const id = resolveIdentity({
      supplied: null,
      domain: "liveatmosaic.com",
      crawl: crawl({ html, title: "Mosaic | Apartments in Austin, TX" }),
    });
    expect(id.nameSource).toBe("title");
    expect(id.name).toBe("Mosaic");
  });

  it("abstains from schema when an operator lists several communities", () => {
    const html = `<script type="application/ld+json">{"@graph":[
      {"@type":"ApartmentComplex","name":"Avalon Berkeley"},
      {"@type":"ApartmentComplex","name":"Avalon Oakland"}]}</script>`;
    const id = resolveIdentity({
      supplied: null,
      domain: "avaloncommunities.com",
      crawl: crawl({ html, title: "AvalonBay Communities" }),
    });
    expect(id.nameSource).toBe("title");
    expect(id.name).toBe("AvalonBay Communities");
  });

  it("takes og:site_name when schema has no usable name", () => {
    const html = `<meta property="og:site_name" content="The James DT" />`;
    const id = resolveIdentity({
      supplied: null,
      domain: "thejamesdt.com",
      crawl: crawl({ html, title: "Luxury Living in Downtown Detroit" }),
    });
    expect(id.name).toBe("The James DT");
    expect(id.nameSource).toBe("og");
  });

  it("reads og:site_name with the attributes in either order", () => {
    const html = `<meta content="Telegraph Commons" property="og:site_name">`;
    expect(
      resolveIdentity({ supplied: null, domain: "x.com", crawl: crawl({ html }) }).name,
    ).toBe("Telegraph Commons");
  });

  it("cleans a title down to the name", () => {
    const cases: Array<[string, string]> = [
      ["Telegraph Commons | Student Housing Near UC Berkeley Campus", "Telegraph Commons"],
      ["Aquatic Higby | Apartment Community | 3015 San Pablo Ave., Berkeley, CA", "Aquatic Higby"],
      ["255 Cal - San Francisco's Flagship Workplace", "255 Cal"],
      ["Home | The Eddy Residences", "The Eddy Residences"],
      ["Mosaic Apartments, Austin, TX", "Mosaic Apartments"],
    ];
    for (const [title, expected] of cases) {
      const id = resolveIdentity({ supplied: null, domain: "x.com", crawl: crawl({ title }) });
      expect(id.name, title).toBe(expected);
      expect(id.nameSource).toBe("title");
      expect(id.confidence).toBe("medium");
    }
  });

  it("refuses a title that is a description, not a name", () => {
    // The Warwick's real title. "Apartments for Rent in Hillcrest" would
    // have become the audited entity.
    const id = resolveIdentity({
      supplied: null,
      domain: "thewarwickhillcrest.com",
      crawl: crawl({ title: "Apartments for Rent in Hillcrest | The Warwick Apartments" }),
    });
    expect(id.nameSource).toBe("domain");
    expect(id.confidence).toBe("low");
  });

  it("refuses a whole-sentence title", () => {
    const id = resolveIdentity({
      supplied: null,
      domain: "liveatmosaic.com",
      crawl: crawl({ title: "See why residents love living at our community in Austin" }),
    });
    expect(id.nameSource).toBe("domain");
  });

  it("falls back to the domain splitter, flagged low, when the crawl failed", () => {
    const id = resolveIdentity({ supplied: null, domain: "liveatmosaic.com", crawl: null });
    expect(id.name).toBe("Liveatmosaic");
    expect(id.nameSource).toBe("domain");
    expect(id.confidence).toBe("low");
    expect(id.resolvedUrl).toBeNull();
  });

  it("carries the resolved URL through every branch", () => {
    const resolvedUrl = "https://www.telegraphcommons.com/";
    for (const input of [
      { supplied: "Typed", crawl: crawl({ resolvedUrl }) },
      { supplied: null, crawl: crawl({ resolvedUrl, html: SCHEMA("Telegraph Commons") }) },
      { supplied: null, crawl: crawl({ resolvedUrl, title: "Telegraph Commons | Berkeley" }) },
      { supplied: null, crawl: crawl({ resolvedUrl }) },
    ]) {
      expect(
        resolveIdentity({ ...input, domain: "telegraphcommons.com" }).resolvedUrl,
      ).toBe(resolvedUrl);
    }
  });

  it("survives malformed JSON-LD and never returns an empty name", () => {
    const id = resolveIdentity({
      supplied: null,
      domain: "livehigby.com",
      crawl: crawl({ html: `<script type="application/ld+json">{oops</script>` }),
    });
    expect(id.name.length).toBeGreaterThan(1);
    expect(id.nameSource).toBe("domain");
  });
});
