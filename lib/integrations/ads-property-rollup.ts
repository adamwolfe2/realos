import { AdPlatform, LeadStatus } from "@prisma/client";
import { TOURED_OR_LATER } from "./ads-insights-math";

// Per-property view of paid ads: what each property spent on Google and
// Meta, and what that spend turned into once renters reached the leasing
// system (leads, tours, signed leases). Spend from campaigns that serve the
// whole portfolio is kept in its own row instead of being split by guess.

export type PropertyAdRollup = {
  propertyId: string | null;
  name: string;
  googleCents: number;
  metaCents: number;
  spendCents: number;
  conversions: number;
  leads: number;
  tours: number;
  signed: number;
};


export function rollupAdsByProperty(input: {
  properties: readonly { id: string; name: string }[];
  campaigns: readonly { id: string; propertyId: string | null; platform: AdPlatform }[];
  campaignTotals: readonly { campaignId: string; spendCents: number; conversions: number }[];
  leadGroups: readonly { propertyId: string | null; status: LeadStatus; count: number }[];
}): PropertyAdRollup[] {
  const names = new Map(input.properties.map((p) => [p.id, p.name]));
  const rows = new Map<string | null, PropertyAdRollup>();
  const row = (propertyId: string | null): PropertyAdRollup => {
    const key = propertyId && names.has(propertyId) ? propertyId : null;
    const existing = rows.get(key);
    if (existing) return existing;
    const fresh: PropertyAdRollup = {
      propertyId: key,
      name: key ? names.get(key)! : "Whole portfolio",
      googleCents: 0, metaCents: 0, spendCents: 0, conversions: 0, leads: 0, tours: 0, signed: 0,
    };
    rows.set(key, fresh);
    return fresh;
  };

  const campaignById = new Map(input.campaigns.map((c) => [c.id, c]));
  for (const t of input.campaignTotals) {
    const c = campaignById.get(t.campaignId);
    if (!c) continue;
    const r = row(c.propertyId);
    r.spendCents += t.spendCents;
    r.conversions += t.conversions;
    if (c.platform === AdPlatform.GOOGLE_ADS) r.googleCents += t.spendCents;
    if (c.platform === AdPlatform.META) r.metaCents += t.spendCents;
  }
  for (const g of input.leadGroups) {
    const r = row(g.propertyId);
    r.leads += g.count;
    if (TOURED_OR_LATER.has(g.status)) r.tours += g.count;
    if (g.status === LeadStatus.SIGNED) r.signed += g.count;
  }

  return [...rows.values()].sort((a, b) => {
    if (!a.propertyId !== !b.propertyId) return a.propertyId ? -1 : 1;
    return b.spendCents - a.spendCents || b.leads - a.leads;
  });
}

export function sumRollups(rows: readonly PropertyAdRollup[]) {
  return rows.reduce(
    (t, r) => ({ leads: t.leads + r.leads, tours: t.tours + r.tours, signed: t.signed + r.signed }),
    { leads: 0, tours: 0, signed: 0 },
  );
}
