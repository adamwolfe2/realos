// Rows for the /portal/seo "Sources" panel: one per LeaseStack property in
// view, each with that property's OWN GSC and GA4 connection, so property B's
// sync error is never hidden behind property A's healthy row. A legacy
// org-wide (propertyId NULL) connection gets its own row, only when the
// caller's integration list contains one (the page already excludes NULL rows
// for restricted users and for a property selection).

export type SeoSourceIntegration = {
  propertyId: string | null;
  provider: "GSC" | "GA4";
};

export type SeoSourceRow<I> = {
  key: string;
  propertyId: string | null;
  label: string;
  gsc: I | null;
  ga4: I | null;
};

export function buildSeoSourceRows<I extends SeoSourceIntegration>(
  properties: Array<{ id: string; name: string }>,
  integrations: I[],
): Array<SeoSourceRow<I>> {
  const pick = (propertyId: string | null, provider: "GSC" | "GA4") =>
    integrations.find(
      (i) => i.propertyId === propertyId && i.provider === provider,
    ) ?? null;
  const rows: Array<SeoSourceRow<I>> = properties.map((p) => ({
    key: p.id,
    propertyId: p.id,
    label: p.name,
    gsc: pick(p.id, "GSC"),
    ga4: pick(p.id, "GA4"),
  }));
  const orgGsc = pick(null, "GSC");
  const orgGa4 = pick(null, "GA4");
  if (orgGsc || orgGa4) {
    rows.push({
      key: "org-wide",
      propertyId: null,
      label: "All properties (org-wide)",
      gsc: orgGsc,
      ga4: orgGa4,
    });
  }
  return rows;
}
