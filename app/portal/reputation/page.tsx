import type { Metadata } from "next";
import Link from "next/link";
import { Star, AlertTriangle, MessageCircle, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { requireScope } from "@/lib/tenancy/scope";
import {
  loadPortfolioReputationMetrics,
  loadPortfolioReputationFeed,
  type PortfolioReputationFeedItem,
} from "@/lib/reputation/portfolio";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { SourceLogo, sourceLabel } from "@/components/portal/reputation/source-logo";
import type { MentionSource, Sentiment } from "@prisma/client";

export const metadata: Metadata = { title: "Reputation" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/reputation — Portfolio-wide brand health view.
//
// Until now the Reddit / Google / Yelp scanner was buried inside per-property
// detail tabs. This page surfaces the same data rolled up across every
// property in the org so operators get a one-click answer to "how is my
// brand looking right now?". Per-property drill-down stays at
// /portal/properties/[id]?tab=reputation.
// ---------------------------------------------------------------------------

const SENTIMENT_TONE: Record<Sentiment, string> = {
  POSITIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NEUTRAL: "bg-muted text-muted-foreground border-border",
  NEGATIVE: "bg-rose-50 text-rose-700 border-rose-200",
  MIXED: "bg-amber-50 text-amber-700 border-amber-200",
};

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  POSITIVE: "Positive",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negative",
  MIXED: "Mixed",
};

function truncate(input: string, max = 220): string {
  const s = input.trim().replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default async function PortfolioReputationPage() {
  const scope = await requireScope();
  const [metrics, feed] = await Promise.all([
    loadPortfolioReputationMetrics(scope.orgId),
    loadPortfolioReputationFeed(scope.orgId, 30),
  ]);

  const sentimentByKey = new Map(
    metrics.sentimentBreakdown.map((s) => [s.sentiment, s.count])
  );
  const positive = sentimentByKey.get("POSITIVE") ?? 0;
  const negative = sentimentByKey.get("NEGATIVE") ?? 0;
  const mixed = sentimentByKey.get("MIXED") ?? 0;
  const neutral = sentimentByKey.get("NEUTRAL") ?? 0;

  const propertyHealthSorted = [...metrics.propertyHealth].sort((a, b) => {
    // Properties with negative mentions or low ratings first.
    const aRisk = a.negativeCount * 2 + (a.googleRating ? 5 - a.googleRating : 0);
    const bRisk = b.negativeCount * 2 + (b.googleRating ? 5 - b.googleRating : 0);
    return bRisk - aRisk;
  });

  return (
    <div className="space-y-4">
      {/* Page heading */}
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Brand health
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Reputation
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reviews and mentions across Google, Reddit, Yelp, and the open web —
            rolled up across every property.
          </p>
        </div>
        <Link
          href="/portal/properties"
          className="text-xs font-medium text-foreground hover:text-primary"
        >
          Manage properties →
        </Link>
      </header>

      {/* Top KPIs */}
      <section
        aria-label="Reputation KPIs"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        <KpiTile
          label="Avg Google rating"
          value={
            metrics.googleAvgRating != null
              ? metrics.googleAvgRating.toFixed(1)
              : "—"
          }
          hint={
            metrics.googleReviewCount > 0
              ? `${metrics.googleReviewCount.toLocaleString()} reviews`
              : "No reviews yet"
          }
          icon={<Star className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Total mentions"
          value={metrics.totalMentions.toLocaleString()}
          hint={`${metrics.newLast30d} new in 30d`}
          icon={<MessageCircle className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Negative share"
          value={metrics.negativePct != null ? `${metrics.negativePct}%` : "—"}
          hint={`${negative} negative mentions`}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Unreviewed"
          value={metrics.unreviewedCount.toLocaleString()}
          hint="Need your attention"
          icon={<MessageCircle className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Flagged"
          value={metrics.flaggedCount.toLocaleString()}
          hint="Marked for follow-up"
          icon={<Flag className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Properties tracked"
          value={metrics.propertyHealth.length.toLocaleString()}
          hint="Each scanned independently"
          icon={<Star className="h-3.5 w-3.5" />}
        />
      </section>

      {/* Sentiment + sources + monthly volume */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardSection
          title="Sentiment"
          eyebrow="Across all mentions"
          description="What people actually feel"
        >
          <div className="space-y-1.5">
            <SentimentBar
              label="Positive"
              count={positive}
              total={metrics.totalMentions}
              tone="bg-emerald-500"
            />
            <SentimentBar
              label="Negative"
              count={negative}
              total={metrics.totalMentions}
              tone="bg-rose-500"
            />
            <SentimentBar
              label="Mixed"
              count={mixed}
              total={metrics.totalMentions}
              tone="bg-amber-500"
            />
            <SentimentBar
              label="Neutral"
              count={neutral}
              total={metrics.totalMentions}
              tone="bg-slate-400"
            />
          </div>
        </DashboardSection>

        <DashboardSection
          title="By source"
          eyebrow="Where the chatter lives"
          description="Volume by platform"
        >
          {metrics.sourceBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No mentions yet. Run a scan from any property.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {metrics.sourceBreakdown
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((row) => (
                  <li
                    key={row.source}
                    className="flex items-center justify-between gap-2 py-1"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <SourceLogo
                        source={row.source as MentionSource}
                        url=""
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="text-xs font-medium text-foreground truncate">
                        {sourceLabel(row.source as MentionSource, "")}
                      </span>
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      {row.count.toLocaleString()}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection
          title="Monthly volume"
          eyebrow="Last 6 months"
          description="Mentions per month, with negative shaded"
        >
          <MonthlyVolume data={metrics.monthlyVolume} />
        </DashboardSection>
      </section>

      {/* Property health table */}
      <DashboardSection
        title="Property health"
        eyebrow="Risk-sorted"
        description="Worst signals at the top so you know where to focus"
      >
        {propertyHealthSorted.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No properties yet. Add one to start scanning reputation.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="text-left text-[10px] tracking-widest uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 md:px-2 py-2 font-medium">Property</th>
                  <th className="px-2 py-2 font-medium text-right">Google</th>
                  <th className="px-2 py-2 font-medium text-right">Reviews</th>
                  <th className="px-2 py-2 font-medium text-right">Mentions</th>
                  <th className="px-2 py-2 font-medium text-right">Negative</th>
                  <th className="px-2 py-2 font-medium text-right">Unreviewed</th>
                  <th className="px-2 py-2 font-medium text-right" />
                </tr>
              </thead>
              <tbody>
                {propertyHealthSorted.map((p) => (
                  <tr
                    key={p.propertyId}
                    className="border-b border-border last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 md:px-2 py-2.5 font-medium text-foreground">
                      {p.propertyName}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {p.googleRating != null ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-current text-amber-500" />
                          {p.googleRating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                      {p.googleReviewCount.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {p.totalMentions.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {p.negativeCount > 0 ? (
                        <span className="text-rose-700 font-medium">
                          {p.negativeCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {p.unreviewedCount > 0 ? (
                        <span className="font-medium">{p.unreviewedCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Link
                        href={`/portal/properties/${p.propertyId}?tab=reputation`}
                        className="text-xs font-medium text-foreground hover:text-primary whitespace-nowrap"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* Recent mentions feed */}
      <DashboardSection
        title="Recent mentions"
        eyebrow="Live feed"
        description="The latest 30 across every property"
      >
        {feed.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No mentions yet. Run a scan from any property to seed the feed.
          </p>
        ) : (
          <ul className="divide-y divide-border -my-2">
            {feed.map((m) => (
              <FeedRow key={m.id} mention={m} />
            ))}
          </ul>
        )}
      </DashboardSection>
    </div>
  );

  function SentimentBar({
    label,
    count,
    total,
    tone,
  }: {
    label: string;
    count: number;
    total: number;
    tone: string;
  }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div>
        <div className="flex items-center justify-between text-xs mb-0.5">
          <span className="text-foreground">{label}</span>
          <span className="text-muted-foreground tabular-nums">
            {count.toLocaleString()} · {pct}%
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${tone}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }
}

function MonthlyVolume({
  data,
}: {
  data: Array<{ month: string; count: number; negative: number }>;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d) => {
        const height = (d.count / max) * 100;
        const negPct = d.count > 0 ? (d.negative / d.count) * 100 : 0;
        return (
          <div
            key={d.month}
            className="flex-1 flex flex-col items-center gap-1 group"
            title={`${d.month}: ${d.count} (${d.negative} negative)`}
          >
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full bg-slate-200 group-hover:bg-slate-300 rounded-t-sm relative transition-colors"
                style={{ height: `${Math.max(height, 4)}%` }}
              >
                {d.negative > 0 ? (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-rose-400 rounded-t-sm"
                    style={{ height: `${negPct}%` }}
                  />
                ) : null}
              </div>
            </div>
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {d.month.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FeedRow({ mention }: { mention: PortfolioReputationFeedItem }) {
  const when = mention.publishedAt;
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-0.5">
          <SourceLogo source={mention.source} url={mention.sourceUrl} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                {sourceLabel(mention.source, mention.sourceUrl)}
              </span>
              <span aria-hidden="true" className="text-muted-foreground">·</span>
              <Link
                href={`/portal/properties/${mention.propertyId}?tab=reputation`}
                className="text-xs font-medium text-foreground hover:text-primary truncate"
              >
                {mention.propertyName}
              </Link>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {mention.rating != null ? (
                <span className="inline-flex items-center gap-0.5 text-xs text-foreground">
                  <Star className="h-3 w-3 fill-current text-amber-500" />
                  {mention.rating.toFixed(1)}
                </span>
              ) : null}
              {mention.sentiment ? (
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${SENTIMENT_TONE[mention.sentiment]}`}
                >
                  {SENTIMENT_LABEL[mention.sentiment]}
                </span>
              ) : null}
              {mention.flagged ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-700">
                  <Flag className="h-3 w-3" />
                </span>
              ) : null}
            </div>
          </div>
          {mention.title ? (
            <p className="text-xs font-medium text-foreground mb-0.5">
              {mention.title}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
            {truncate(mention.excerpt)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {mention.authorName ? (
              <>
                <span className="truncate max-w-[120px]">{mention.authorName}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            {when ? (
              <span>{formatDistanceToNow(when, { addSuffix: true })}</span>
            ) : null}
            <span aria-hidden="true">·</span>
            <a
              href={mention.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline-offset-2 hover:underline"
            >
              View source
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}
