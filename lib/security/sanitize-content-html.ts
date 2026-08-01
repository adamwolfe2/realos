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
// The allowlist matches the tag set lib/content/render-mdx.ts documents as
// the supported TipTap-output subset: h1-h6, p, lists, blockquote,
// strong/em, code/pre, links, line breaks.
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "ul", "ol", "li",
  "blockquote", "strong", "b", "em", "i",
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
