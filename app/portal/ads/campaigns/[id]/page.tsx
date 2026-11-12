import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdPlatform, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { propertyInScope, requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { realAdAccountWhere } from "@/lib/integrations/real-ad-account";
import { fatigue, FATIGUE_DROP, parseAdsRange, TOURED_OR_LATER, weeklyFunnel } from "@/lib/integrations/ads-insights-math";
import { Logo, Metric as Stat, MetricStrip, PageTitle, Panel, Pill, change } from "@/components/portal/overview/kit";
import { AdCreativeGallery, type CreativeItem } from "../../ad-creative-gallery";
import { RangeTabs } from "../../range-tabs";
import { WeeklyProgress } from "../../weekly-progress";
import { FunnelBar } from "../../funnel-bar";
import { CampaignTrend } from "./campaign-trend";

export const metadata: Metadata = { title: "Campaign" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const LEADS_SHOWN = 15;

const STAGE_LABEL: Partial<Record<LeadStatus, string>> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TOUR_SCHEDULED: "Tour booked",
  TOURED: "Toured",
  APPLICATION_SENT: "Application sent",
  APPLIED: "Applied",
  APPROVED: "Approved",
  SIGNED: "Signed",
  LOST: "Lost",
  UNQUALIFIED: "Unqualified",
};

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// /portal/ads/campaigns/[id]: one campaign end to end. Daily trend, its
// ads, the leads it brought in and how far each got. Read-only.
export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; leads?: string }>;
}) {
  const scope = await requireScope();
  const gate = (await requireModule("moduleGoogleAds")) && (await requireModule("moduleMetaAds"));
  if (gate) return gate;
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const days = parseAdsRange(sp.range);
  const showAllLeads = sp.leads === "all";

  const realAccountFilter = await realAdAccountWhere(scope.orgId);
  const campaign = await prisma.adCampaign.findFirst({
    where: { ...tenantWhere(scope), id, adAccount: realAccountFilter },
    select: {
      id: true,
      name: true,
      platform: true,
      status: true,
      objective: true,
      dailyBudgetCents: true,
      externalCampaignId: true,
      propertyId: true,
      property: { select: { name: true } },
      adAccount: { select: { externalAccountId: true, displayName: true } },
    },
  });
  if (!campaign || !propertyInScope(scope, campaign.propertyId)) notFound();

  const now = Date.now();
  const start = new Date(now - days * DAY);
  const priorStart = new Date(now - 2 * days * DAY);

  const [daily, prior, creatives, creativeDaily, leads] = await Promise.all([
    prisma.adMetricDaily.findMany({
      where: { campaignId: campaign.id, date: { gte: start } },
      orderBy: { date: "asc" },
      select: { date: true, spendCents: true, clicks: true, impressions: true, conversions: true },
    }),
    prisma.adMetricDaily.aggregate({
      where: { campaignId: campaign.id, date: { gte: priorStart, lt: start } },
      _sum: { spendCents: true, clicks: true, conversions: true },
    }),
    prisma.adCreative.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, platform: true, name: true, status: true, format: true, thumbnailUrl: true, headline: true, body: true, landingUrl: true },
    }),
    prisma.adCreativeMetricDaily.findMany({
      where: { adCreative: { campaignId: campaign.id }, date: { gte: start } },
      select: { adCreativeId: true, date: true, impressions: true, clicks: true, spendCents: true, conversions: true },
    }),
    // Leads credit a campaign through the source detail the leasing system
    // stored (the campaign name / utm_campaign). Any lead source: AppFolio
    // maps an unrecognised source label to OTHER, so filtering by platform
    // first would drop exactly these leads. Exact match (no insensitive
    // equals: that compiles to an unescaped ILIKE).
    prisma.lead.findMany({
      where: {
        orgId: scope.orgId,
        sourceDetail: { in: [...new Set([campaign.name, campaign.name.trim()])] },
        createdAt: { gte: start },
        ...(scope.allowedPropertyIds ? { propertyId: { in: scope.allowedPropertyIds } } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, status: true, createdAt: true, sourceDetail: true, property: { select: { name: true } } },
    }),
  ]);

  const totals = daily.reduce(
    (t, d) => ({ spend: t.spend + d.spendCents, clicks: t.clicks + d.clicks, impressions: t.impressions + d.impressions, conv: t.conv + d.conversions }),
    { spend: 0, clicks: 0, impressions: 0, conv: 0 },
  );
  const tours = leads.filter((l) => TOURED_OR_LATER.has(l.status)).length;
  const signed = leads.filter((l) => l.status === LeadStatus.SIGNED).length;
  const weeks = weeklyFunnel(daily, leads);

  const byCreative = new Map<string, typeof creativeDaily>();
  for (const r of creativeDaily) byCreative.set(r.adCreativeId, [...(byCreative.get(r.adCreativeId) ?? []), r]);
  const creativeItems: CreativeItem[] = creatives.map((c) => {
    const rows = byCreative.get(c.id) ?? [];
    const f = fatigue(rows);
    return {
      ...c,
      campaignName: null,
      impressions: rows.reduce((t, r) => t + r.impressions, 0),
      clicks: rows.reduce((t, r) => t + r.clicks, 0),
      spendCents: rows.reduce((t, r) => t + r.spendCents, 0),
      leads: Math.round(rows.reduce((t, r) => t + r.conversions, 0)),
      fatigueDrop: f && f.drop >= FATIGUE_DROP ? f.drop : null,
    };
  });

  const manageUrl =
    campaign.platform === AdPlatform.GOOGLE_ADS
      ? `https://ads.google.com/aw/campaigns?campaignId=${encodeURIComponent(campaign.externalCampaignId ?? "")}`
      : `https://business.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${encodeURIComponent(campaign.externalCampaignId ?? "")}&act=${encodeURIComponent(campaign.adAccount.externalAccountId)}`;
  const platform = campaign.platform === AdPlatform.GOOGLE_ADS ? "Google Ads" : "Meta";
  const paused = /PAUSED|REMOVED|DELETED|ARCHIVED/i.test(campaign.status ?? "");

  return (
    <div className="w-full space-y-5">
      <Link href="/portal/ads" className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--t-muted)] hover:text-[var(--t-ink)]">
        <ArrowLeft className="h-3.5 w-3.5" /> Paid ads
      </Link>
      <PageTitle
        title={campaign.name}
        subtitle={[
          platform,
          campaign.property?.name ?? "Whole portfolio",
          campaign.dailyBudgetCents ? `${dollars(campaign.dailyBudgetCents)}/day budget` : null,
          campaign.objective,
        ].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={paused ? "neutral" : "good"}>{paused ? "Paused" : "Running"}</Pill>
            <RangeTabs current={days} params={{}} basePath={`/portal/ads/campaigns/${campaign.id}`} />
            <a
              href={manageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[var(--t-border)] bg-white px-3 text-[12.5px] text-[var(--t-text)] hover:text-[var(--t-ink)]"
            >
              <Logo slug={campaign.platform === AdPlatform.GOOGLE_ADS ? "google-ads" : "meta-ads"} size={13} />
              Open in {platform}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        }
      />

      <MetricStrip cols={6}>
        <Stat label="Spend" value={dollars(totals.spend)} delta={change(totals.spend, prior._sum.spendCents ?? 0)} note={`Last ${days} days vs the ${days} before`} />
        <Stat label="Clicks" value={totals.clicks.toLocaleString()} delta={change(totals.clicks, prior._sum.clicks ?? 0)} note={totals.impressions ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)}% click rate` : "No impressions"} />
        <Stat label="Conversions" value={Math.round(totals.conv).toLocaleString()} delta={change(totals.conv, prior._sum.conversions ?? 0)} note={totals.conv ? `${dollars(Math.round(totals.spend / totals.conv))} each, as reported` : "As reported by the platform"} />
        <Stat label="Leads" value={leads.length.toLocaleString()} note={leads.length ? `${dollars(Math.round(totals.spend / leads.length))} per lead` : "None matched yet"} />
        <Stat label="Tours" value={tours.toLocaleString()} note={leads.length ? `${Math.round((tours / leads.length) * 100)}% of leads` : "—"} />
        <Stat label="Signed leases" value={signed.toLocaleString()} note={signed ? `${dollars(Math.round(totals.spend / signed))} per lease` : "None yet in this range"} />
      </MetricStrip>
      <FunnelBar funnel={{ leads: leads.length, tours, signed }} />

      <Panel title="Daily spend vs conversions" aside={`Last ${days} days`}>
        {daily.length ? (
          <CampaignTrend points={daily.map((d) => ({ date: d.date.toISOString().slice(0, 10), spendCents: d.spendCents, conversions: d.conversions }))} />
        ) : (
          <p className="text-[13px] text-[var(--t-muted)]">No spend in this range.</p>
        )}
      </Panel>

      <WeeklyProgress weeks={weeks} />

      <Panel title="Ads in this campaign" aside="Ranked by cost per lead · we only read, never edit">
        {creativeItems.length ? (
          <AdCreativeGallery items={creativeItems} />
        ) : (
          <p className="text-[13px] text-[var(--t-muted)]">No ads synced for this campaign yet.</p>
        )}
      </Panel>

      <Panel title="Leads from this campaign" aside={`${leads.length} in the last ${days} days`} flush className="overflow-x-auto">
        {leads.length ? (
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-b border-[var(--t-divider)]">
              <tr className="ls-eyebrow">
                <th className="px-4 py-2 text-left">Lead</th>
                <th className="px-4 py-2 text-left">Property</th>
                <th className="px-4 py-2 text-left">Stage</th>
                <th className="px-4 py-2 text-right">Came in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--t-divider)]">
              {(showAllLeads ? leads : leads.slice(0, LEADS_SHOWN)).map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/portal/leads/${l.id}`} className="font-medium text-[var(--t-ink)] hover:text-[var(--t-accent)] hover:underline underline-offset-2">
                      {[l.firstName, l.lastName].filter(Boolean).join(" ") || "Unnamed lead"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--t-text)]">{l.property?.name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Pill tone={l.status === LeadStatus.SIGNED ? "good" : l.status === LeadStatus.LOST || l.status === LeadStatus.UNQUALIFIED ? "neutral" : TOURED_OR_LATER.has(l.status) ? "brand" : "neutral"}>
                      {STAGE_LABEL[l.status] ?? l.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--t-muted)]">
                    {l.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {leads.length > LEADS_SHOWN && !showAllLeads ? (
          <Link
            href={`/portal/ads/campaigns/${campaign.id}?${new URLSearchParams({ ...(sp.range ? { range: sp.range } : {}), leads: "all" })}`}
            className="block border-t border-[var(--t-divider)] px-4 py-2.5 text-[12.5px] font-medium text-[var(--t-accent)] hover:underline underline-offset-2"
          >
            Show all {leads.length} leads
          </Link>
        ) : null}
        {leads.length ? null : (
          <p className="p-4 text-[13px] text-[var(--t-muted)]">
            No leads matched to this campaign yet. Leads are matched by the campaign name your leasing system records as the lead source detail.
          </p>
        )}
      </Panel>
    </div>
  );
}
