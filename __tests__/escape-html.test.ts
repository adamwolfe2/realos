import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/escape-html";
import { escapeHtml as sharedEscapeHtml } from "@/lib/email/shared";

describe("escapeHtml", () => {
  it("escapes & < > \" ' (ampersand first, no double-escaping)", () => {
    expect(escapeHtml(`<a href='x' title="y">Tom & Jerry</a>`)).toBe(
      "&lt;a href=&#39;x&#39; title=&quot;y&quot;&gt;Tom &amp; Jerry&lt;/a&gt;",
    );
  });

  it("is the same function re-exported from lib/email/shared", () => {
    expect(sharedEscapeHtml).toBe(escapeHtml);
  });
});
