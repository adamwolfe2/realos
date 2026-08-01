import sanitizeHtml from "sanitize-html";

// ---------------------------------------------------------------------------
// sanitizeContentHtml — allowlist sanitizer for ContentDraft.htmlBody.
//
// htmlBody is persisted verbatim from the portal content editor (Tiptap
// StarterKit — see app/portal/content/[id]/editor-client.tsx) and from the
// AI content-chat edit route, then rendered via dangerouslySetInnerHTML in
// two places: the public preview page (app/preview/content/[id]/page.tsx)
// and the agency admin review UI
// (app/admin/content-approvals/[id]/detail-client.tsx). Neither write path
// validates HTML shape beyond a max-length check, so a stored payload could
// contain a <script> tag or an onerror handler. Sanitizing at render time
// (rather than only at write time) neutralizes anything already stored,
// not just future writes.
//
// The allowlist covers every tag the editor's StarterKit config
// (@tiptap/starter-kit@3) can actually emit: headings (limited to h1-h3
// by editor-client.tsx, h4-h6 kept here as harmless slack), paragraphs,
// lists, blockquote, bold/italic (strong/em), strike (s), underline (u),
// inline code + code blocks (code/pre), links (a), line breaks (br), and
// horizontal rules (hr). StarterKit v3 bundles Link, Strike, and
// Underline by default (unlike v2) — all three are enabled here since
// editor-client.tsx never sets link/strike/underline: false.
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "ul", "ol", "li",
  "blockquote", "strong", "b", "em", "i", "s", "u",
  "code", "pre", "a", "br", "hr",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
};

export function sanitizeContentHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // Only allow safe URL schemes on links; strips javascript:/data: etc.
    allowedSchemes: ["http", "https", "mailto"],
    // Force noopener/noreferrer on any rendered link regardless of author input.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  });
}
