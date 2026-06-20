import { describe, it, expect } from "vitest";
import {
  serializeJsonLd,
  serializeJsonLdForTemplateLiteral,
} from "@/lib/seo/serialize-json-ld";

// ---------------------------------------------------------------------------
// Regression tests for P1-1: stored XSS via unescaped JSON-LD injection.
// Operator/AI content containing </script> must never break out of the
// <script type="application/ld+json"> block on a public tenant page.
// ---------------------------------------------------------------------------

const MALICIOUS = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  name: 'Pets? </script><script>alert(document.cookie)</script>',
  note: 'Quotes "x" & ampersands & a backslash C:\\temp and ${injection}',
  url: "https://example.com/a?b=1&c=2",
};

describe("serializeJsonLd (direct React render)", () => {
  it("escapes < > & so no closing tag can be parsed", () => {
    const out = serializeJsonLd(MALICIOUS);
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).toContain("\\u003c");
    expect(out).toContain("\\u0026");
  });

  it("still parses back to the identical object (crawler-equivalent)", () => {
    const out = serializeJsonLd(MALICIOUS);
    expect(JSON.parse(out)).toEqual(MALICIOUS);
  });
});

describe("serializeJsonLdForTemplateLiteral (generated MDX/JSX)", () => {
  // Faithfully simulate what MDX does: the generated source embeds the result
  // in a backtick template literal that is evaluated at render time.
  function evalAsTemplateLiteral(body: string): string {
    // eslint-disable-next-line no-new-func
    return new Function(`return \`${body}\`;`)() as string;
  }

  it("evaluates back to EXACTLY the HTML-safe serializeJsonLd output", () => {
    const body = serializeJsonLdForTemplateLiteral(MALICIOUS);
    const evaluated = evalAsTemplateLiteral(body);
    expect(evaluated).toBe(serializeJsonLd(MALICIOUS));
  });

  it("the evaluated __html contains no </script> and parses to the original", () => {
    const body = serializeJsonLdForTemplateLiteral(MALICIOUS);
    const evaluated = evalAsTemplateLiteral(body);
    expect(evaluated).not.toContain("</script>");
    expect(evaluated).not.toContain("<");
    // Crawler decodes the < escapes back to the real content.
    expect(JSON.parse(evaluated)).toEqual(MALICIOUS);
  });

  it("does not let ${} expressions execute inside the template literal", () => {
    const body = serializeJsonLdForTemplateLiteral({ x: "${7*7}" });
    const evaluated = evalAsTemplateLiteral(body);
    expect(JSON.parse(evaluated)).toEqual({ x: "${7*7}" });
    expect(evaluated).not.toContain("49");
  });
});
