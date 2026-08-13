/** Only ever link out to http(s). Mention/source URLs are third-party
 *  API data persisted verbatim — a `javascript:` value must render as
 *  text, never as a clickable href (2026-08-14 review). */
export function safeHttpUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  return /^https?:\/\//i.test(u.trim()) ? u.trim() : null;
}
