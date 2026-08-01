// Single source for the chatbot install-snippet markup. Was duplicated
// between app/portal/chatbot/page.tsx and chatbot-install-snippet-picker.tsx
// (org-default branch was verbatim-identical) — any new attribute added to
// one would silently drift from the other. Pure string builder, safe to
// import from both a server page and a "use client" component.
export function chatbotSnippet(
  snippetHost: string,
  orgSlug: string,
  propertySlug?: string | null,
): string {
  const propertyAttr = propertySlug ? ` data-property="${propertySlug}"` : "";
  return `<script src="${snippetHost}/embed/chatbot.js" data-slug="${orgSlug}"${propertyAttr} defer></script>`;
}
