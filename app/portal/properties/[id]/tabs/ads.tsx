import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import {
  getPropertyAds,
  centsToUsdShort,
} from "@/lib/properties/queries";
import { prisma } from "@/lib/db";
import { adLibraryConfigured } from "@/lib/integrations/ad-library";
import {
  AdLibraryPanel,
  type AdLibraryAdvertiserView,
} from "@/components/portal/ad-library/ad-library-panel";

export async function AdsTab({
  orgId,
  propertyId,
}: {
  orgId: string;
  propertyId: string;
}) {
  const [data, advertisersRaw] = await Promise.all([
    getPropertyAds(orgId, propertyId),
    prisma.adLibraryAdvertiser.findMany({
      where: { orgId, propertyId },
      orderBy: { createdAt: "desc" },
      include: {
        ads: {
          orderBy: [
            { status: "asc" },
            { adDeliveryStart: "desc" },
          ],
        },
      },
    }),
  ]);

  const advertisers: AdLibraryAdvertiserView[] = advertisersRaw.map((a) => ({
    id: a.id,
    displayName: a.displayName,
    searchKind: a.searchKind,
    searchValue: a.searchValue,
    lastScannedAt: a.lastScannedAt?.toISOString() ?? null,
    lastScanError: a.lastScanError ?? null,
    ads: a.ads.map((ad) => ({
      id: ad.id,
      externalId: ad.externalId,
      status: ad.status,
      creativeBody: ad.creativeBody,
      creativeTitle: ad.creativeTitle,
      linkUrl: ad.linkUrl,
      imageUrl: ad.imageUrl,
      videoUrl: ad.videoUrl,
      publisherPlatforms: ad.publisherPlatforms,
      adCreationTime: ad.adCreationTime?.toISOString() ?? null,
      adDeliveryStart: ad.adDeliveryStart?.toISOString() ?? null,
      adDeliveryStop: ad.adDeliveryStop?.toISOString() ?? null,
      spendLow: ad.spendLow,
      spendHigh: ad.spendHigh,
      impressionsLow: ad.impressionsLow,
      impressionsHigh: ad.impressionsHigh,
      currency: ad.currency,
    })),
  }));
  const adLibrarySection = (
    <DashboardSection
      title="Public Ad Library"
      eyebrow="Live tracker"
      description="Real ads pulled from Meta's public Ad Library — no customer credentials required. Updates daily and tracks new launches + ads going inactive."
    >
      <AdLibraryPanel
        propertyId={propertyId}
        advertisers={advertisers}
        configured={adLibraryConfigured()}
      />
    </DashboardSection>
  );

  if (data.campaigns.length === 0) {
    return (
      <div className="space-y-3">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <KpiTile label="Spend (28d)" value="—" />
          <KpiTile label="Leads (28d)" value="—" />
          <KpiTile label="Campaigns" value={0} />
          <KpiTile label="CPL" value="—" />
        </section>
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-5">
          <p className="text-sm font-semibold text-foreground">
            No campaigns linked to this property
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground leading-snug max-w-md">
            Connect Google Ads or Meta Ads to see spend, CPL, and
            attribution. Until then, the Ad Library tracker below shows
            what&apos;s already running publicly.
          </p>
        </div>
        {adLibrarySection}
      </div>
    );
  }

  const cpl =
    data.totalLeads28d > 0
      ? centsToUsdShort(Math.round(data.totalSpendCents28d / data.totalLeads28d))
      : "—";

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Spend (28d)"
          value={centsToUsdShort(data.totalSpendCents28d)}
          spark={data.spendSparkline}
        />
        <KpiTile
          label="Leads (28d)"
          value={data.totalLeads28d}
          hint="Attributed via campaign name match"
        />
        <KpiTile
          label="Campaigns"
          value={data.campaigns.length}
          hint="Linked to property"
        />
        <KpiTile label="CPL" value={cpl} />
      </section>

      <DashboardSection
        title="Campaigns"
        eyebrow="Per campaign, last 28 days"
      >
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead className="text-[10px] tracking-widest uppercase text-muted-foreground">
              <tr>
                <th className="text-left font-semibold pb-2">Campaign</th>
                <th className="text-left font-semibold pb-2">Platform</th>
                <th className="text-left font-semibold pb-2">Status</th>
                <th className="text-right font-semibold pb-2">Spend</th>
                <th className="text-right font-semibold pb-2">Leads</th>
                <th className="text-right font-semibold pb-2">CPL</th>
                <th className="text-right font-semibold pb-2">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="py-2.5 text-xs text-foreground max-w-[260px] truncate">
                    {c.name}
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">
                    {c.platform}
                  </td>
                  <td className="py-2.5">
                    <StatusChip status={c.status} />
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-xs">
                    {centsToUsdShort(c.spendCents28d)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-xs">
                    {c.leads28d}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {c.cplCents == null ? "—" : centsToUsdShort(c.cplCents)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {c.conversionPct == null ? "—" : `${c.conversionPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>
      {adLibrarySection}
    </div>
  );
}

function StatusChip({ status }: { status: string | null }) {
  const s = (status ?? "").toUpperCase();
  const isActive = s === "ENABLED" || s === "ACTIVE";
  return (
    <span
      className={
        isActive
          ? "inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-primary/10 text-primary"
          : "inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-muted text-muted-foreground"
      }
    >
      {s || "UNKNOWN"}
    </span>
  );
}
