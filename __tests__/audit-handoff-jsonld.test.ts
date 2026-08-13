import { describe, it, expect } from "vitest";
import { buildSchemaJsonLd } from "@/lib/audit/recommendations";

describe("buildSchemaJsonLd", () => {
  it("generates ApartmentComplex with full address from locale", () => {
    const out = buildSchemaJsonLd({
      brandName: "Telegraph Commons",
      domain: "telegraphcommons.com",
      city: "Berkeley",
      region: "CA",
      category: "student apartments",
    });
    expect(out).toContain('<script type="application/ld+json">');
    const json = JSON.parse(
      out.replace(/<script[^>]*>/, "").replace("</script>", ""),
    );
    expect(json["@type"]).toBe("ApartmentComplex");
    expect(json.name).toBe("Telegraph Commons");
    expect(json.url).toBe("https://telegraphcommons.com");
    expect(json.address.addressLocality).toBe("Berkeley");
    expect(json.address.addressRegion).toBe("CA");
  });

  it("falls back to LocalBusiness for non-residential and omits address without a city", () => {
    const out = buildSchemaJsonLd({
      brandName: "Acme Offices",
      domain: "acme.com",
      category: "office space",
    });
    const json = JSON.parse(
      out.replace(/<script[^>]*>/, "").replace("</script>", ""),
    );
    expect(json["@type"]).toBe("LocalBusiness");
    expect(json.address).toBeUndefined();
  });
});
