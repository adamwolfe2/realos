// Canonical HTML escaper for string-built HTML (emails, editor seed content,
// server-rendered confirmation pages). Safe for text nodes and quoted
// attribute values (both " and '). Pure, no imports: usable client-side.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
