import "server-only";

// ---------------------------------------------------------------------------
// Resolve a chatbot conversation's host page URL to the most likely
// property in the tenant's portfolio. Used by both /api/public/chatbot/lead
// and /api/public/chatbot/chat to attribute captured leads to the right
// property — multi-property tenants previously lost attribution because
// every lead got pinned to the most-recently-updated property regardless
// of where the chat actually happened (audit BUG-08).
//
// Resolution strategy (priority order):
//   1. A host label or path segment equals the property's slug  ← strongest
//      (longest match wins)
//   2. A host label or path segment equals the property's name
//      (lowercased, whitespace and hyphens stripped)    ← softer signal
//   2b. Page host equals exactly one property's websiteUrl host (scheme-less,
//      www and case normalised) ← per-property domains
//   3. Single-property tenant — only one option        ← safe fallback
//   4. Multi-property tenant + ambiguous URL → null    ← honest "unknown"
// ---------------------------------------------------------------------------

export type PropertyAttributionInput = {
  id: string;
  slug: string;
  name: string;
  // Property's own marketing site. When the page host equals exactly one
  // property's websiteUrl host, that property wins (per-property domains).
  websiteUrl?: string | null;
};

function bareHost(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  // websiteUrl is operator-typed and often stored without a scheme
  // ("livehigby.com", "www.x.com/"); URL() rejects those outright.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Longest match wins so "telegraph-commons" beats "telegraph" on the same URL.
function longestMatch<T>(items: T[], key: (item: T) => string | null): T | undefined {
  let best: T | undefined;
  let bestLen = 0;
  for (const item of items) {
    const k = key(item);
    if (k && k.length > bestLen) {
      best = item;
      bestLen = k.length;
    }
  }
  return best;
}

export function resolvePropertyForChatPage(
  pageUrl: string | undefined | null,
  properties: PropertyAttributionInput[],
  options: {
    // Callers with no page context must NOT fall back to "only one
    // property, so it must be that one" when there's no pageUrl at all.
    // Chatbot callers keep the fallback — there's always a page the chat
    // widget is mounted on.
    requireUrlMatch?: boolean;
  } = {}
): string | null {
  if (properties.length === 0) return null;

  if (pageUrl) {
    // Match against hostname + pathname only — NOT the raw URL string.
    // The full string includes the query string, which is visitor-
    // controlled input (e.g. `?x=<slug>`) and would let an anonymous
    // visitor force attribution to an arbitrary building.
    // Whole host labels and path segments only, never substrings: slug
    // "rise" must not win on /blog/sunrise-views.
    let tokens: string[] = [];
    try {
      const u = new URL(pageUrl);
      tokens = [...u.hostname.split("."), ...u.pathname.split("/")]
        .map((t) => t.toLowerCase())
        .filter(Boolean);
    } catch {
      tokens = []; // malformed URL — no match, not a raw-string fallback
    }
    if (tokens.length > 0) {
      const compactTokens = tokens.map((t) => t.replace(/[-_]/g, ""));
      const bySlug = longestMatch(properties, (p) => {
        const slug = p.slug?.toLowerCase();
        return slug && tokens.includes(slug) ? slug : null;
      });
      if (bySlug) return bySlug.id;
      const byName = longestMatch(properties, (p) => {
        if (!p.name) return null;
        const compact = p.name.toLowerCase().replace(/\s+/g, "");
        return compact.length >= 4 && compactTokens.includes(compact) ? compact : null;
      });
      if (byName) return byName.id;
      // Host last: a shared company site (A's websiteUrl = sgre.com) must not
      // swallow B living at sgre.com/southgate-annex. Only a host owned by
      // exactly one property counts.
      const pageHost = bareHost(pageUrl);
      const byHost = pageHost
        ? properties.filter((p) => bareHost(p.websiteUrl) === pageHost)
        : [];
      if (byHost.length === 1) return byHost[0].id;
    }
  }

  if (options.requireUrlMatch) return null;
  if (properties.length === 1) return properties[0].id;

  return null;
}
