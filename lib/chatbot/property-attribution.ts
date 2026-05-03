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
//   1. URL contains the property's slug as a substring  ← strongest signal
//   2. URL contains the property's name (lowercased,
//      whitespace stripped) as a substring             ← softer signal
//   3. Single-property tenant — only one option        ← safe fallback
//   4. Multi-property tenant + ambiguous URL → null    ← honest "unknown"
// ---------------------------------------------------------------------------

export type PropertyAttributionInput = {
  id: string;
  slug: string;
  name: string;
};

export function resolvePropertyForChatPage(
  pageUrl: string | undefined | null,
  properties: PropertyAttributionInput[]
): string | null {
  if (properties.length === 0) return null;
  if (properties.length === 1) return properties[0].id;

  if (pageUrl) {
    const haystack = pageUrl.toLowerCase();
    const bySlug = properties.find(
      (p) => p.slug && haystack.includes(p.slug.toLowerCase())
    );
    if (bySlug) return bySlug.id;
    const byName = properties.find((p) => {
      if (!p.name) return false;
      const compact = p.name.toLowerCase().replace(/\s+/g, "");
      return compact.length >= 4 && haystack.includes(compact);
    });
    if (byName) return byName.id;
  }

  return null;
}
