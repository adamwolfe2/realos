import { describe, it, expect } from "vitest";
import { extractBrandLogo, toAbsoluteHttpUrl } from "@/lib/audit/brand-logo";

const BASE = "https://thewarwickhillcrest.com/";

describe("extractBrandLogo", () => {
  it("prefers schema.org Organization.logo over markup further down", () => {
    const html = `<head><script type="application/ld+json">
      {"@type":"Organization","logo":"https://cdn.x.com/warwick.svg"}
      </script></head><body><img class="logo" src="/wrong.png"></body>`;
    expect(extractBrandLogo(html, BASE)).toBe("https://cdn.x.com/warwick.svg");
  });

  it("reads logo declared as an ImageObject", () => {
    const html = `<script type="application/ld+json">
      {"logo":{"@type":"ImageObject","url":"/img/mark.png"}}</script>`;
    expect(extractBrandLogo(html, BASE)).toBe(
      "https://thewarwickhillcrest.com/img/mark.png",
    );
  });

  it("falls back to an <img> tagged as a logo, regardless of attribute order", () => {
    const html = `<body><img src="/assets/logo-dark.svg" class="site-logo" alt="Warwick"></body>`;
    expect(extractBrandLogo(html, BASE)).toBe(
      "https://thewarwickhillcrest.com/assets/logo-dark.svg",
    );
  });

  it("takes the first candidate from a srcset", () => {
    const html = `<img class="logo" srcset="/a.png 1x, /b.png 2x">`;
    expect(extractBrandLogo(html, BASE)).toBe(
      "https://thewarwickhillcrest.com/a.png",
    );
  });

  it("matches on a logo-ish filename when no attribute says logo", () => {
    expect(
      extractBrandLogo(`<img src="/media/warwick-logo-2x.png" alt="">`, BASE),
    ).toBe("https://thewarwickhillcrest.com/media/warwick-logo-2x.png");
  });

  it("falls back to apple-touch-icon but never to a favicon", () => {
    expect(
      extractBrandLogo(`<link rel="apple-touch-icon" href="/touch.png">`, BASE),
    ).toBe("https://thewarwickhillcrest.com/touch.png");
    // A 16-32px .ico blown up to hero size looks broken. No logo is better.
    expect(extractBrandLogo(`<link rel="icon" href="/fav.ico">`, BASE)).toBeNull();
    expect(
      extractBrandLogo(`<link rel="shortcut icon" href="/fav.ico">`, BASE),
    ).toBeNull();
  });

  it("returns null for empty, missing, or logo-less HTML", () => {
    expect(extractBrandLogo(null, BASE)).toBeNull();
    expect(extractBrandLogo("", BASE)).toBeNull();
    expect(extractBrandLogo("<body><p>no logo here</p></body>", BASE)).toBeNull();
  });

  it("ignores a 'logo' match buried deep in the page", () => {
    const html = "x".repeat(130_000) + `<img class="logo" src="/footer.png">`;
    expect(extractBrandLogo(html, BASE)).toBeNull();
  });
});

describe("toAbsoluteHttpUrl", () => {
  it("rejects non-http(s) schemes a crawled page could inject", () => {
    for (const bad of [
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "javascript:alert(1)",
      "file:///etc/passwd",
      "",
      null,
      undefined,
    ]) {
      expect(toAbsoluteHttpUrl(bad, BASE)).toBeNull();
    }
  });

  it("resolves relative, protocol-relative, and absolute forms", () => {
    expect(toAbsoluteHttpUrl("/a.png", BASE)).toBe(
      "https://thewarwickhillcrest.com/a.png",
    );
    expect(toAbsoluteHttpUrl("//cdn.x.com/a.png", BASE)).toBe(
      "https://cdn.x.com/a.png",
    );
    expect(toAbsoluteHttpUrl("https://cdn.x.com/a.png", BASE)).toBe(
      "https://cdn.x.com/a.png",
    );
  });
});

describe("never brands the report as LeaseStack", () => {
  it("skips a 'powered by LeaseStack' badge and keeps looking", () => {
    const html = `<body>
      <img class="powered-logo" src="https://leasestack.co/apple-icon.png">
      <img class="site-logo" src="/warwick.svg">
    </body>`;
    expect(extractBrandLogo(html, BASE)).toBe(
      "https://thewarwickhillcrest.com/warwick.svg",
    );
  });

  it("returns null rather than our own mark when that's all there is", () => {
    for (const own of [
      `<img class="logo" src="https://leasestack.co/apple-icon.png?v=3">`,
      `<img class="logo" src="https://www.leasestack.co/logo.svg">`,
      `<img class="logo" src="https://cdn.leasestack.co/logo.svg">`,
      `<link rel="apple-touch-icon" href="https://realos.vercel.app/icon.png">`,
    ]) {
      expect(extractBrandLogo(own, BASE)).toBeNull();
    }
  });

  it("still resolves relative paths against the entered domain", () => {
    // The audited site is the base — a bare "/logo.png" can only ever
    // become the prospect's own host, never ours.
    expect(
      extractBrandLogo(`<img class="logo" src="/logo.png">`, "https://livehigby.com/"),
    ).toBe("https://livehigby.com/logo.png");
  });
});

describe("real-world markup", () => {
  it("decodes HTML entities so the src is actually fetchable", () => {
    // Next.js image URLs arrive as ?url=x&amp;w=384 (telegraphcommons.com).
    const html = `<img class="logo" src="/_next/image?url=%2Flogo.png&amp;w=384&amp;q=75">`;
    expect(extractBrandLogo(html, BASE)).toBe(
      "https://thewarwickhillcrest.com/_next/image?url=%2Flogo.png&w=384&q=75",
    );
  });

  it("rejects a .ico even when declared as the schema.org logo", () => {
    // Wix does exactly this (livehigby.com).
    const html = `<script type="application/ld+json">
      {"logo":"https://static.parastorage.com/client/pfavico.ico"}</script>`;
    expect(extractBrandLogo(html, BASE)).toBeNull();
  });

  it("skips the .ico logo and takes a real mark further down", () => {
    const html = `<script type="application/ld+json">{"logo":"/fav.ico"}</script>
      <img class="logo" src="/real-logo.svg">`;
    expect(extractBrandLogo(html, BASE)).toBe(
      "https://thewarwickhillcrest.com/real-logo.svg",
    );
  });
});
