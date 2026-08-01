import { describe, it, expect } from "vitest";
import { htmlToMdx } from "@/lib/content/render-mdx";

// ---------------------------------------------------------------------------
// lib/content/render-mdx.ts — sanitize-content-html.ts admits <s> and <u>
// (StarterKit's Strike/Underline extensions), but inlineHtmlToMdx was
// silently stripping both, losing formatting on MDX export. <s> maps to GFM
// strikethrough; <u> has no markdown equivalent so it passes through as raw
// HTML/JSX (MDX bodies already rely on raw HTML surviving — see the
// <script> JSON-LD blocks this module emits).
// ---------------------------------------------------------------------------

describe("htmlToMdx — strike and underline", () => {
  it("converts <s> to GFM strikethrough, recursing into inner formatting", () => {
    expect(htmlToMdx("<p>before <s>gone</s> after</p>")).toBe(
      "before ~~gone~~ after",
    );
    expect(htmlToMdx("<p><s>bold inside: <strong>x</strong></s></p>")).toBe(
      "~~bold inside: **x**~~",
    );
  });

  it("passes <u> through as raw HTML, recursing into inner formatting", () => {
    expect(htmlToMdx("<p>before <u>underlined</u> after</p>")).toBe(
      "before <u>underlined</u> after",
    );
    expect(htmlToMdx("<p><u>bold inside: <strong>x</strong></u></p>")).toBe(
      "<u>bold inside: **x**</u>",
    );
  });

  it("does not let the passthrough <u> break the generic tag-strip pass", () => {
    // An unrecognized tag near <u> should still be stripped while <u> itself
    // survives.
    expect(htmlToMdx("<p><span>keep text</span> <u>kept</u></p>")).toBe(
      "keep text <u>kept</u>",
    );
  });
});
