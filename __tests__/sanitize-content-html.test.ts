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

  // -------------------------------------------------------------------------
  // Editor allowlist round-trip. StarterKit v3 (the version installed —
  // see package.json) bundles Link, Strike, and Underline by default in
  // addition to the v2 baseline, so a document exercising every enabled
  // extension in editor-client.tsx must survive sanitization untouched
  // (aside from the always-forced rel/target on links, and the code-block
  // language class, which has no downstream consumer — see
  // lib/content/render-mdx.ts — and is dropped as a documented, harmless
  // normalization).
  // -------------------------------------------------------------------------
  it("round-trips every construct the TipTap editor can emit", () => {
    // Links already carry the forced rel/target (see the "forces
    // noopener/noreferrer" test above) and br/hr are pre-normalized to
    // self-closing form, since sanitize-html always emits void tags that
    // way — matching its own output rather than re-asserting that
    // unrelated behavior here.
    const html =
      "<h1>Heading 1</h1>" +
      "<h2>Heading 2</h2>" +
      "<h3>Heading 3</h3>" +
      "<p>Paragraph with <strong>bold</strong>, <em>italic</em>, " +
      "<s>strike</s>, <u>underline</u>, and <code>inline code</code>.</p>" +
      "<p>Line one<br />line two</p>" +
      '<ul><li>bullet one</li><li>bullet two</li></ul>' +
      '<ol><li>ordered one</li><li>ordered two</li></ol>' +
      "<blockquote>A quoted answer block.</blockquote>" +
      "<pre><code>const x = 1;</code></pre>" +
      "<hr />" +
      '<p><a href="https://example.com" rel="noopener noreferrer" target="_blank">a link</a> and ' +
      '<a href="mailto:hello@example.com" rel="noopener noreferrer" target="_blank">an email link</a>.</p>';
    const out = sanitizeContentHtml(html);
    expect(out).toBe(html);
  });

  it("drops the code-block language class as a harmless normalization", () => {
    const out = sanitizeContentHtml(
      '<pre><code class="language-js">const x = 1;</code></pre>',
    );
    // Content and structure survive; only the unconsumed language class
    // (no highlighter reads it — see lib/content/render-mdx.ts) is stripped.
    expect(out).toBe("<pre><code>const x = 1;</code></pre>");
  });

  it("strips data: URLs on links", () => {
    const out = sanitizeContentHtml(
      '<a href="data:text/html,<script>alert(1)</script>">bad</a>',
    );
    expect(out).not.toContain("data:text/html");
  });
});
