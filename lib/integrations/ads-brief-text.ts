// Facts behind the weekly ads brief, and the rule-written version used when
// Claude is unavailable. Pure: no DB, no network.

export type BriefWeek = {
  spendCents: number;
  googleCents: number;
  metaCents: number;
  conversions: number;
  leads: number;
  tours: number;
  signed: number;
};

export type BriefFacts = {
  weekStart: string; // YYYY-MM-DD (Monday)
  thisWeek: BriefWeek;
  lastWeek: BriefWeek;
  properties: { name: string; spendCents: number; leads: number; signed: number }[];
  bestCampaign: { name: string; costPerConversionCents: number } | null;
  worstCampaign: { name: string; costPerConversionCents: number } | null;
  openSuggestions: string[];
};

export type BriefDecision = { title: string; why: string };
export type Brief = { headline: string; summary: string; decisions: BriefDecision[] };

const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

function delta(now: number, prior: number): string {
  if (!prior) return "";
  const pct = Math.round(((now - prior) / prior) * 100);
  return pct === 0 ? " (flat)" : ` (${pct > 0 ? "+" : ""}${pct}% vs the week before)`;
}

export function fallbackBrief(f: BriefFacts): Brief {
  const t = f.thisWeek;
  const l = f.lastWeek;
  const perLead = t.leads ? ` at ${usd(t.spendCents / t.leads)} per lead` : "";
  const summary = [
    `Ads spent ${usd(t.spendCents)}${delta(t.spendCents, l.spendCents)}: ${usd(t.googleCents)} on Google and ${usd(t.metaCents)} on Meta.`,
    `They brought in ${t.leads} leads${perLead}${delta(t.leads, l.leads)}, ${t.tours} tours and ${t.signed} signed ${t.signed === 1 ? "lease" : "leases"}.`,
    f.bestCampaign ? `Cheapest results came from "${f.bestCampaign.name}" at ${usd(f.bestCampaign.costPerConversionCents)} per conversion.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const decisions: BriefDecision[] = f.openSuggestions.slice(0, 3).map((s) => ({ title: s, why: "Flagged by this week's numbers. Details in Suggestions." }));
  if (decisions.length === 0 && f.worstCampaign && f.bestCampaign && f.worstCampaign.name !== f.bestCampaign.name) {
    decisions.push({
      title: `Review "${f.worstCampaign.name}"`,
      why: `It costs ${usd(f.worstCampaign.costPerConversionCents)} per conversion against ${usd(f.bestCampaign.costPerConversionCents)} for "${f.bestCampaign.name}".`,
    });
  }

  return {
    headline: `${usd(t.spendCents)} in ads, ${t.leads} leads, ${t.signed} signed ${t.signed === 1 ? "lease" : "leases"} last week`,
    summary,
    decisions,
  };
}
