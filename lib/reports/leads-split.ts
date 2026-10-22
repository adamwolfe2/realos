// Leads KPI sub-label: the headline counts every Lead in the window, but some
// were created by the AppFolio sync from rental applications (the applicant,
// not someone LeaseStack captured). Splitting them keeps the headline while
// crediting honestly (SG/TC 2026-10: 35 captured, 45 from AppFolio).
// Null when the snapshot predates the field or there are no AppFolio leads.
export function leadsSplitNote(kpis: {
  leads: number;
  leadsFromAppfolio?: number;
}): string | null {
  const fromAppfolio = kpis.leadsFromAppfolio ?? 0;
  if (fromAppfolio <= 0) return null;
  const captured = Math.max(0, kpis.leads - fromAppfolio);
  return `${captured.toLocaleString("en-US")} captured by LeaseStack · ${fromAppfolio.toLocaleString("en-US")} from AppFolio applications`;
}
