// Pure helpers for the /api/public/chatbot/demo lead-magnet route.
// Split out of the route file (Next route modules may only export
// handlers/config) so they stay unit-testable.

/** Normalize prospect input into a public http(s) URL, or null.
 *  Rejects localhost / RFC-1918 / dotless hosts — hygiene, since the
 *  actual fetching happens remotely via Firecrawl. */
export function normalizeDemoUrl(raw: string): URL | null {
  const withScheme = /^https?:\/\//i.test(raw.trim())
    ? raw.trim()
    : `https://${raw.trim()}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (
    !host.includes(".") ||
    host === "localhost" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  ) {
    return null;
  }
  return url;
}

/** "Telegraph Commons | Student Housing in Berkeley" → "Telegraph Commons". */
export function derivePropertyName(title: string, hostname: string): string {
  const first = title.split(/\s*[|–—·:]\s*|\s+-\s+/)[0]?.trim() ?? "";
  if (first.length >= 2 && first.length <= 80) return first;
  const host = hostname.replace(/^www\./, "").split(".")[0] ?? hostname;
  return host.charAt(0).toUpperCase() + host.slice(1);
}
