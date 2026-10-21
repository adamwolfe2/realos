import { isPlausibleBuildingName } from "@/lib/aeo/parse";

// Neighborhood / region strings AI engines name when answering location
// queries (Norman, May 22: "Downtown Berkeley" ranked as a competitor).
// Easy to extend per market.
const NEIGHBORHOOD_NOISE = new Set([
  "downtown berkeley", "north berkeley", "south berkeley", "west berkeley",
  "east berkeley", "southside", "elmwood", "telegraph", "berkeley", "oakland",
  "albany", "el cerrito", "emeryville", "richmond", "bay area", "east bay",
  "san francisco", "north oakland", "downtown oakland",
]);

// "The Standard Berkeley (Downtown)" -> "The Standard Berkeley"
export function cleanCompetitorName(raw: string): string | null {
  const name = raw.replace(/\s*\([^)]*\)/g, "").replace(/[:;,.\s]+$/, "").trim();
  if (NEIGHBORHOOD_NOISE.has(name.toLowerCase())) return null;
  return isPlausibleBuildingName(name) ? name : null;
}

// Collapses spellings of one building: "The Standard", "The Standard at
// Berkeley" and "The Standard Berkeley" share the key "standard".
export function competitorKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\s+apartments?$/, "")
    .replace(/\s+(at\s+)?berkeley$/, "")
    .trim();
}

// Counts mentions per building, labelled with its most frequent spelling.
export function rankCompetitors(
  namesPerCheck: string[][],
  limit = 5,
): Array<{ name: string; mentions: number }> {
  const groups = new Map<string, { mentions: number; spellings: Map<string, number> }>();
  for (const names of namesPerCheck) {
    const seen = new Set<string>();
    for (const raw of names) {
      const name = cleanCompetitorName(raw);
      if (!name) continue;
      const key = competitorKey(name);
      if (seen.has(key)) continue; // one mention per answer
      seen.add(key);
      const g = groups.get(key) ?? { mentions: 0, spellings: new Map() };
      g.mentions += 1;
      g.spellings.set(name, (g.spellings.get(name) ?? 0) + 1);
      groups.set(key, g);
    }
  }
  return [...groups.values()]
    .map((g) => ({
      name: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      mentions: g.mentions,
    }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, limit);
}
