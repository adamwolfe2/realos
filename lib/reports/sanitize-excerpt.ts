// ---------------------------------------------------------------------------
// sanitize-excerpt
//
// Mention excerpts come from three places:
//   1. Google / Yelp reviews — clean, sentence-form prose.
//   2. Reddit / forum threads — readable but with stray markdown.
//   3. Web crawls (BBB, ApartmentRatings, etc.) — full-page scrapes that
//      include site nav, footers, language switchers, table-of-contents
//      bullets, and other chrome. Rendered as-is, these are unreadable
//      walls of broken text that destroy the report's credibility.
//
// This helper produces a clean ~240-char preview suitable for a card. It:
//   • strips markdown syntax (headings, lists, bold, links, images, code)
//   • drops nav-like short lines (single-word menu items, repeated chrome)
//   • collapses whitespace
//   • truncates at a word boundary with an ellipsis
//
// A `Read full →` link to the sourceUrl is the user's affordance for the
// complete content. We never try to show the full scraped page inline.
// ---------------------------------------------------------------------------

const DEFAULT_MAX_CHARS = 240;

// Lowercased exact-match nav phrases that show up across most scraped
// review/business-profile pages. Order doesn't matter; lookup is O(1).
const NAV_PHRASES = new Set([
  "menu",
  "main menu",
  "open menu",
  "close menu",
  "main",
  "home",
  "overview",
  "about",
  "about us",
  "contact",
  "contact us",
  "reviews",
  "complaints",
  "ratings",
  "sign in",
  "sign-in",
  "log in",
  "login",
  "sign up",
  "register",
  "search",
  "subscribe",
  "share",
  "share this",
  "copy link",
  "copy this link",
  "follow",
  "follow us",
  "next",
  "previous",
  "back",
  "back to top",
  "skip to main content",
  "view all",
  "see all",
  "show more",
  "show less",
  "read more",
  "read less",
  "languages",
  "consumers",
  "businesses",
  "more resources",
  "featured content",
  "table of contents",
  "scam tracker",
  "report a scam",
  "file a complaint",
  "industry tip",
  "business details",
  "bbb accreditation",
  "bbb accreditation & rating",
  "get a quote",
  "write a review",
  "leave a review",
  "service area",
  "directions",
  "call now",
  "visit website",
  "open in maps",
  "trending",
  "popular",
  "categories",
]);

/**
 * Returns a clean 240-char preview of a scraped mention excerpt.
 *
 * @param raw - The stored excerpt text. May contain markdown, nav junk,
 *              null/undefined.
 * @param maxChars - Soft maximum for the preview. Cuts at a word boundary
 *                   so the actual return value can be slightly shorter.
 */
export function sanitizeMentionExcerpt(
  raw: string | null | undefined,
  maxChars: number = DEFAULT_MAX_CHARS,
): string {
  if (!raw) return "";

  // 1. Strip markdown control syntax. We keep the content (link labels,
  //    bold body, etc.) but lose the punctuation that frames it.
  let text = raw
    // images
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    // links — keep label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // headings (#, ##, ### ...)
    .replace(/^\s*#{1,6}\s+/gm, "")
    // unordered list bullets
    .replace(/^\s*[-*+]\s+/gm, "")
    // ordered list numbers ("1. " "12. ")
    .replace(/^\s*\d{1,3}\.\s+/gm, "")
    // blockquote marker
    .replace(/^\s*>\s+/gm, "")
    // fenced code / inline code
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    // bold / italic (** _ *)
    .replace(/\*{1,3}([^*]+?)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+?)_{1,3}/g, "$1")
    // table cell separator
    .replace(/\|/g, " ")
    // bare URLs
    .replace(/\bhttps?:\/\/\S+/g, "")
    // stray html entities
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");

  // 2. Split into lines and drop nav-like junk. Lines that look like
  //    real prose (>= 40 chars OR contain sentence punctuation) survive.
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  const cleaned = lines.filter((line) => {
    const lower = line.toLowerCase();
    if (NAV_PHRASES.has(lower)) return false;
    // Short lines without sentence punctuation are usually menu items.
    if (line.length < 40 && !/[.!?]/.test(line)) return false;
    // Phone numbers + addresses as standalone lines aren't useful preview.
    if (/^[\d\s().+\-,]+$/.test(line)) return false;
    return true;
  });

  // 3. If filtering wiped everything (some review platforms strip
  //    punctuation), fall back to the un-filtered prose so we still show
  //    something useful instead of an empty card.
  let preview = cleaned.join(" ").replace(/\s+/g, " ").trim();
  if (preview.length < 40) {
    preview = lines.join(" ").replace(/\s+/g, " ").trim();
  }

  // 4. Word-boundary truncate.
  if (preview.length <= maxChars) return preview;
  const slice = preview.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd().replace(/[,;:.!?-]+$/, "")}…`;
}

/**
 * Returns true when the sanitized preview is shorter than the original
 * excerpt — i.e. the card should render a "Read full →" affordance.
 */
export function isExcerptTruncated(
  raw: string | null | undefined,
  maxChars: number = DEFAULT_MAX_CHARS,
): boolean {
  if (!raw) return false;
  const sanitized = sanitizeMentionExcerpt(raw, maxChars);
  // Account for ellipsis at end.
  const sanitizedLen = sanitized.endsWith("…")
    ? sanitized.length - 1
    : sanitized.length;
  // Strip whitespace from raw for fair comparison.
  const rawCondensed = raw.replace(/\s+/g, " ").trim().length;
  return sanitizedLen < rawCondensed;
}
