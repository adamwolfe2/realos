// Leads KPI sub-label: the headline counts every Lead in the window, but some
// were created by the AppFolio sync from rental applications (the applicant,
// not someone LeaseStack captured). Splitting them keeps the headline while
// crediting honestly (SG/TC 2026-10: 35 captured, 45 from AppFolio).
// "Captured" is counted (no external system), never inferred as the
// remainder; any other imports show as "other". Null when the snapshot
// predates the fields or there are no AppFolio-application leads.
export function leadsSplitNote(kpis: {
  leads: number;
  leadsFromAppfolio?: number;
  leadsCaptured?: number;
}): string | null {
  const fromAppfolio = kpis.leadsFromAppfolio ?? 0;
  if (fromAppfolio <= 0 || kpis.leadsCaptured == null) return null;
  const fmt = (n: number) => n.toLocaleString("en-US");
  const other = Math.max(0, kpis.leads - fromAppfolio - kpis.leadsCaptured);
  return [
    `${fmt(kpis.leadsCaptured)} captured by LeaseStack`,
    `${fmt(fromAppfolio)} from AppFolio applications`,
    ...(other > 0 ? [`${fmt(other)} other`] : []),
  ].join(" · ");
}
