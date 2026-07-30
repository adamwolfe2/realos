// Pure merge for the AEO Share-of-Voice tab. Combines two independent
// classifications of the same 30d window:
//   - topEntities:      AeoMentionSnapshot.mentions (self/competitor/other)
//   - competitorRollup: AeoCitationCheck.competitorsCited (competitor names only)
// Kept as a plain function (no "use client", no React) so it's unit
// testable without a DOM and reusable server-side.

export type MergeEntityInput = {
  name: string;
  kind: "self" | "competitor" | "other";
  count: number;
};

export type MergeRollupInput = {
  name: string;
  count: number;
};

export type MergedEntity = {
  name: string;
  kind: "self" | "competitor";
  count: number;
};

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function mergeEntities(
  topEntities: MergeEntityInput[],
  competitorRollup: MergeRollupInput[],
): MergedEntity[] {
  // Self names win the key unconditionally — a name can't be "you" in one
  // table and a rival in the other. Any competitor/other row sharing a
  // self's name is cross-property classification noise: dropped, never
  // summed into self, never rendered as a competitor.
  const selfNames = new Set(
    topEntities.filter((e) => e.kind === "self").map((e) => normalize(e.name)),
  );

  const selfByKey = new Map<string, MergedEntity>();
  for (const e of topEntities) {
    if (e.kind !== "self") continue;
    const k = normalize(e.name);
    const existing = selfByKey.get(k);
    if (!existing || e.count > existing.count) {
      selfByKey.set(k, { name: e.name, kind: "self", count: e.count });
    }
  }

  const competitorByKey = new Map<string, MergedEntity>();
  for (const e of topEntities) {
    if (e.kind !== "competitor") continue; // "other" dropped: not a competitor
    const k = normalize(e.name);
    if (selfNames.has(k)) continue;
    const existing = competitorByKey.get(k);
    if (!existing || e.count > existing.count) {
      competitorByKey.set(k, { name: e.name, kind: "competitor", count: e.count });
    }
  }

  for (const c of competitorRollup) {
    const k = normalize(c.name);
    if (selfNames.has(k)) continue;
    const existing = competitorByKey.get(k);
    if (!existing) {
      competitorByKey.set(k, { name: c.name, kind: "competitor", count: c.count });
      continue;
    }
    // Same 30d window, two different tables counting overlapping events —
    // in DataForSEO mode one engine response writes both an
    // AeoMentionSnapshot mention and an AeoCitationCheck competitorsCited
    // entry for the same name. Summing would double-count that shared
    // write; max never undercounts either source.
    const mergedCount = Math.max(existing.count, c.count);
    // Rollup strictly higher → its casing wins. Tie keeps the existing
    // (topEntities-sourced) name per spec.
    const name = c.count > existing.count ? c.name : existing.name;
    competitorByKey.set(k, { name, kind: "competitor", count: mergedCount });
  }

  return [...selfByKey.values(), ...competitorByKey.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 15);
}
