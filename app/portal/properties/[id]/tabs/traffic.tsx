import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { getPropertyTraffic } from "@/lib/properties/queries";

export async function TrafficTab({
  orgId,
  propertyId,
  propertyMeta,
}: {
  orgId: string;
  propertyId: string;
  propertyMeta: { slug: string; name: string };
}) {
  const traffic = await getPropertyTraffic(orgId, propertyId, propertyMeta);

  if (!traffic.mapped) {
    return (
      <EmptyTab
        title="Traffic not yet mapped"
        body="GSC and GA4 rows are keyed by URL, not property. Give this property a slug (or confirm its marketing URL) to surface per-property organic performance."
      />
    );
  }

  const hasAnyData =
    traffic.topQueries.length > 0 ||
    traffic.topLandingPages.length > 0 ||
    traffic.totalSessions28d > 0;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Organic sessions (28d)"
          value={traffic.totalSessions28d.toLocaleString()}
          spark={traffic.sessionsSparkline}
        />
        <KpiTile
          label="Query clicks (28d)"
          value={traffic.totalClicks28d.toLocaleString()}
          hint="From matching GSC queries"
        />
        <KpiTile
          label="Landing pages"
          value={traffic.topLandingPages.length}
          hint="Unique URLs (28d)"
        />
        <KpiTile
          label="Top queries"
          value={traffic.topQueries.length}
          hint="Matching property name/slug"
        />
      </section>

      {!hasAnyData ? (
        <EmptyTab
          title="No organic data yet"
          body={`We looked for URLs containing "${propertyMeta.slug}" but found nothing in the last 28 days. Once GSC and GA4 sync, this view fills out.`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardSection
            title="Top queries (28d)"
            eyebrow="GSC"
            description="Queries mentioning this property"
          >
            {traffic.topQueries.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No matching queries yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[10px] tracking-widest uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold pb-2">Query</th>
                    <th className="text-right font-semibold pb-2">Clicks</th>
                    <th className="text-right font-semibold pb-2">Impr.</th>
                    <th className="text-right font-semibold pb-2">Pos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {traffic.topQueries.map((q) => (
                    <tr key={q.query}>
                      <td className="py-2 text-xs truncate max-w-[240px] text-foreground">
                        {q.query}
                      </td>
                      <td className="py-2 text-right tabular-nums text-xs">
                        {q.clicks.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {q.impressions.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {q.position.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DashboardSection>

          <DashboardSection
            title="Top landing pages (28d)"
            eyebrow="GA4"
            description="URLs containing the property slug"
          >
            {traffic.topLandingPages.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No matching landing pages yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {traffic.topLandingPages.map((p) => (
                  <li
                    key={p.url}
                    className="flex items-baseline justify-between gap-3 text-xs"
                  >
                    <span className="truncate text-foreground">
                      {shortenUrl(p.url)}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {p.sessions.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>
        </div>
      )}
    </div>
  );
}

function shortenUrl(u: string): string {
  try {
    const url = new URL(u);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.host}${path}`;
  } catch {
    return u.length > 60 ? `${u.slice(0, 57)}${"\u2026"}` : u;
  }
}

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
