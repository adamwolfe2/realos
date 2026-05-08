import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { getPropertyTraffic } from "@/lib/properties/queries";
import { prisma } from "@/lib/db";
import { LeadStatus, type LeadSource } from "@prisma/client";

// Bug #29 — Operators want to see, on the Traffic tab, where leads
// drop off and which channels convert at what rates. The new
// `getChannelConversion` block below pulls Lead → Tour → Application
// → Signed counts grouped by lead source, so the operator can see
// per-channel funnel performance next to traffic data.
const SOURCE_LABEL: Record<LeadSource, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  ORGANIC: "Organic",
  CHATBOT: "Chatbot",
  FORM: "Web form",
  PIXEL_OUTREACH: "Pixel",
  REFERRAL: "Referral",
  DIRECT: "Direct",
  EMAIL_CAMPAIGN: "Email",
  COLD_EMAIL: "Cold email",
  MANUAL: "Manual",
  OTHER: "Other",
};

type ChannelRow = {
  source: LeadSource;
  leads: number;
  tours: number;
  applications: number;
  signed: number;
};

async function getChannelConversion(
  orgId: string,
  propertyId: string,
  since: Date,
): Promise<ChannelRow[]> {
  const leads = await prisma.lead.findMany({
    where: { orgId, propertyId, createdAt: { gte: since } },
    select: {
      id: true,
      source: true,
      status: true,
      _count: { select: { tours: true, applications: true } },
    },
  });
  const map = new Map<LeadSource, ChannelRow>();
  for (const lead of leads) {
    const row =
      map.get(lead.source) ?? {
        source: lead.source,
        leads: 0,
        tours: 0,
        applications: 0,
        signed: 0,
      };
    row.leads++;
    if (lead._count.tours > 0) row.tours++;
    if (lead._count.applications > 0) row.applications++;
    if (lead.status === LeadStatus.SIGNED) row.signed++;
    map.set(lead.source, row);
  }
  return Array.from(map.values()).sort((a, b) => b.leads - a.leads);
}

export async function TrafficTab({
  orgId,
  propertyId,
  propertyMeta,
}: {
  orgId: string;
  propertyId: string;
  propertyMeta: { slug: string; name: string };
}) {
  const since28d = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const [traffic, channelRows] = await Promise.all([
    getPropertyTraffic(orgId, propertyId, propertyMeta),
    getChannelConversion(orgId, propertyId, since28d),
  ]);

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

      {/* Bug #29 — channel conversion. Per-source breakdown of how
          leads moved (or didn't) through tours → apps → signed. The
          conversion ratios show channel ROI at a glance, separate
          from raw lead count, so the operator sees if e.g. Google
          Ads sends a lot of leads but few sign, while Organic sends
          fewer but converts higher. */}
      {channelRows.length > 0 ? (
        <DashboardSection
          title="Channel conversion (28d)"
          eyebrow="Lead → tour → app → signed"
          description="Per-source funnel performance. Conversion rates show where the channel drops off."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] tracking-widest uppercase text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold pb-2">Source</th>
                  <th className="text-right font-semibold pb-2">Leads</th>
                  <th className="text-right font-semibold pb-2">Tours</th>
                  <th className="text-right font-semibold pb-2">→ Tour %</th>
                  <th className="text-right font-semibold pb-2">Apps</th>
                  <th className="text-right font-semibold pb-2">→ App %</th>
                  <th className="text-right font-semibold pb-2">Signed</th>
                  <th className="text-right font-semibold pb-2">→ Signed %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {channelRows.map((row) => {
                  const tourRate = row.leads > 0
                    ? Math.round((row.tours / row.leads) * 100)
                    : null;
                  const appRate = row.tours > 0
                    ? Math.round((row.applications / row.tours) * 100)
                    : row.leads > 0
                      ? Math.round((row.applications / row.leads) * 100)
                      : null;
                  const signedRate = row.leads > 0
                    ? Math.round((row.signed / row.leads) * 100)
                    : null;
                  return (
                    <tr key={row.source}>
                      <td className="py-2 text-xs font-medium text-foreground">
                        {SOURCE_LABEL[row.source]}
                      </td>
                      <td className="py-2 text-right tabular-nums text-xs font-semibold">
                        {row.leads.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums text-xs">
                        {row.tours.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {tourRate != null ? `${tourRate}%` : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums text-xs">
                        {row.applications.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {appRate != null ? `${appRate}%` : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums text-xs">
                        {row.signed.toLocaleString()}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums text-xs font-semibold ${
                          signedRate != null && signedRate >= 5
                            ? "text-emerald-700"
                            : signedRate != null && signedRate > 0
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {signedRate != null ? `${signedRate}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tour, application, and signed counts derived from each lead&apos;s
            associated records. → % columns show drop-off rates relative to
            the prior stage.
          </p>
        </DashboardSection>
      ) : null}

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
