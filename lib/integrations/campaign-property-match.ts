// Links an ad campaign to a property by its name, so per-property ad
// reporting works without anyone tagging campaigns by hand.
//
// "Lair | Search | Fall 27" -> The Lair. "TC - Meta Leads" -> nothing
// (initials are too ambiguous; the manual picker covers those). A name that
// names two different properties also links to nothing.

export type PropertyRef = { id: string; name: string };

function words(input: string): string {
  return ` ${input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

// "The Lair" -> "lair", "Telegraph Commons" -> "telegraph commons".
function propertyKey(name: string): string {
  return words(name).trim().replace(/^the /, "");
}

export function matchCampaignToProperty(
  campaignName: string,
  properties: readonly PropertyRef[],
): string | null {
  const haystack = words(campaignName);
  const hits = properties
    .map((p) => ({ id: p.id, key: propertyKey(p.name) }))
    .filter((h) => h.key.length >= 3 && haystack.includes(` ${h.key} `));
  // "Higby" inside "Higby One" is the same mention, not a second property.
  const distinct = hits.filter(
    (h) => !hits.some((o) => o.key !== h.key && words(o.key).includes(` ${h.key} `)),
  );
  const ids = new Set(distinct.map((h) => h.id));
  return ids.size === 1 ? [...ids][0] : null;
}
