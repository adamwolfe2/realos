import { describe, it, expect } from "vitest";
import { sanitizeContentHtml } from "@/lib/security/sanitize-content-html";

// ---------------------------------------------------------------------------
// Regression tests for the stored-XSS fix on ContentDraft.htmlBody.
// htmlBody is persisted verbatim from the portal editor / AI chat-edit route
// (no HTML-shape validation) then rendered via dangerouslySetInnerHTML in
// app/preview/content/[id]/page.tsx (public) and
// app/admin/content-approvals/[id]/detail-client.tsx (agency admin). This
// sanitizer must strip anything outside the documented TipTap-output subset.
// ---------------------------------------------------------------------------

describe("sanitizeContentHtml", () => {
  it("strips <script> tags entirely", () => {
    const out = sanitizeContentHtml(
      '<p>hello</p><script>alert(document.cookie)</script>',
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(document.cookie)");
    expect(out).toContain("<p>hello</p>");
  });

  it("strips event handler attributes", () => {
    const out = sanitizeContentHtml(
      '<p onclick="alert(1)">click</p><img src=x onerror="alert(2)">',
    );
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    // img isn't in the allowlist at all — dropped along with its handler.
    expect(out).not.toContain("<img");
  });

  it("strips javascript: URLs on links but keeps safe http(s) links", () => {
    const out = sanitizeContentHtml(
      '<a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a>',
    );
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href="https://example.com"');
  });

  it("forces noopener/noreferrer + target=_blank on links", () => {
    const out = sanitizeContentHtml('<a href="https://example.com">link</a>');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it("keeps the documented TipTap-output subset intact", () => {
    const html =
      "<h1>Title</h1><p>Body <strong>bold</strong> <em>em</em></p>" +
      "<ul><li>one</li><li>two</li></ul><blockquote>quote</blockquote>" +
      "<pre><code>const x = 1;</code></pre>";
    const out = sanitizeContentHtml(html);
    expect(out).toBe(html);
  });

  it("drops unknown tags but keeps their safe text content", () => {
    const out = sanitizeContentHtml("<style>body{display:none}</style><p>ok</p>");
    expect(out).not.toContain("<style");
    expect(out).toContain("<p>ok</p>");
  });
});
