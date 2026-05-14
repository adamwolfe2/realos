// ---------------------------------------------------------------------------
// stripChatbotMarkdown
//
// Defense-in-depth: the system prompt instructs Claude to write plain prose
// only (no **bold**, no em dashes, no bullet markers), but models occasionally
// slip — especially mid-conversation when the model's default training nudges
// it toward "helpful" markdown. The chat widget renders messages as plain
// text via whitespace-pre-wrap, so any raw markdown shows literally on screen
// (e.g. "**Premium:**" appears as five characters).
//
// This helper sanitizes assistant replies before they reach the renderer.
// Targeted, conservative — we only strip the patterns that show as noise.
// Code blocks and inline code are left alone in case a tenant ever does want
// to share an embed snippet (vanishingly rare for leasing chat but free).
// ---------------------------------------------------------------------------

export function stripChatbotMarkdown(text: string): string {
  if (!text) return text;

  let out = text;

  // **bold** → bold (unwrap, don't drop the content). Run before single-*
  // pass so we don't half-process **foo** into *foo*.
  out = out.replace(/\*\*([^*\n][^*]*?)\*\*/g, "$1");

  // *italic* → italic. Anchored to non-whitespace boundaries so we don't
  // mangle things like " * not list * " or list-like content. We also do
  // not strip lone asterisks (e.g. a footnote marker) — those are kept.
  out = out.replace(/(^|\s)\*(?=\S)([^*\n]+?)\*(?=\s|[.,!?;:)]|$)/g, "$1$2");

  // _italic_ / __bold__ — same idea
  out = out.replace(/__([^_\n][^_]*?)__/g, "$1");
  out = out.replace(/(^|\s)_(?=\S)([^_\n]+?)_(?=\s|[.,!?;:)]|$)/g, "$1$2");

  // Em dashes and en dashes → comma+space. Operator/Norman style: no em
  // dashes anywhere in user-facing copy.
  out = out.replace(/\s*—\s*/g, ", ");
  out = out.replace(/\s*–\s*/g, ", ");

  // Leading bullet markers on their own line: "- foo" or "* foo" or "• foo"
  // → strip the marker. Numbered lists ("1. foo") are kept because Claude
  // sometimes uses them to literally enumerate options the visitor asked
  // for (e.g. "1 bedroom, 2 bedroom, 3 bedroom") and the numbers carry
  // meaning beyond formatting.
  out = out.replace(/^[\s]*[-*•]\s+/gm, "");

  // Markdown headers (### Heading, ## Heading, # Heading) → strip the #s
  out = out.replace(/^[\s]*#{1,6}\s+/gm, "");

  // Collapse runs of 3+ newlines to 2 (single blank line between paragraphs)
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}
