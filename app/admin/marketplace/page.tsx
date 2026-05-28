import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { MarketplaceSourceForm } from "@/components/admin/marketplace-source-form";
import { MarketplaceSourceList } from "@/components/admin/marketplace-source-list";

export const metadata: Metadata = { title: "Marketplace sources" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/marketplace
//
// Master-admin surface for configuring which Cursive segments feed the
// public /marketplace pool. Lists every MarketplaceSyncSource with its
// last 3 runs and lead counts, plus a form to register a new source
// and immediately trigger a sync.
//
// Restricted to AGENCY org admins (requireAgency). Same scope used by
// /admin/system, /admin/tenants, etc.
// ---------------------------------------------------------------------------

export default async function AdminMarketplacePage() {
  await requireAgency();

  const sources = await prisma.marketplaceSyncSource.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 3,
      },
      _count: { select: { leads: true } },
    },
  });

  // Aggregate counts for the page-header strip.
  const [availableLeads, totalLeads, totalRuns] = await Promise.all([
    prisma.marketplaceLead.count({ where: { status: "AVAILABLE" } }),
    prisma.marketplaceLead.count(),
    prisma.marketplaceSyncRun.count(),
  ]);

  // Stripe webhook freshness check — most recent PAID purchase is a proxy
  // for "is the checkout.session.completed webhook receiving + processing".
  // If purchases exist but none in the last 7 days, the webhook is likely
  // broken (Stripe endpoint disabled, signing secret rotated without
  // updating env, etc.).
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const lastPaidPurchase = await prisma.marketplacePurchase.findFirst({
    where: { status: "PAID" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, updatedAt: true },
  });
  const hasAnyPurchase =
    (await prisma.marketplacePurchase.count({ take: 1 })) > 0;
  const stalePaidWebhook =
    hasAnyPurchase &&
    (!lastPaidPurchase ||
      Date.now() - lastPaidPurchase.updatedAt.getTime() > SEVEN_DAYS_MS);

  return (
    <div className="space-y-8 px-4 md:px-8 py-6 md:py-10 max-w-[1280px] mx-auto">
      <PageHeader
        title="Marketplace sources"
        description="Each source pulls a Cursive segment into the public /marketplace pool. Weekly cron re-enriches every member; manual sync available below."
      />

      {stalePaidWebhook ? (
        <div className="flex items-start gap-2.5 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle aria-hidden="true" className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="text-sm leading-relaxed text-amber-900">
            <strong className="font-semibold">
              No paid purchases in the last 7 days.
            </strong>{" "}
            {lastPaidPurchase ? (
              <>
                Most recent paid event was{" "}
                {formatDistanceToNow(lastPaidPurchase.updatedAt, {
                  addSuffix: true,
                })}
                .
              </>
            ) : (
              <>The database has purchase rows but none in PAID status.</>
            )}{" "}
            If real purchases happened in this window, the Stripe webhook is
            likely broken (check the endpoint at{" "}
            <code className="font-mono text-xs text-amber-900">
              /api/webhooks/stripe/marketplace
            </code>{" "}
            in the Stripe dashboard, and confirm{" "}
            <code className="font-mono text-xs text-amber-900">
              STRIPE_WEBHOOK_SECRET
            </code>{" "}
            matches).
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile label="Sources" value={String(sources.length)} />
        <StatTile label="Available leads" value={availableLeads.toLocaleString()} />
        <StatTile label="Total leads (all states)" value={totalLeads.toLocaleString()} />
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8">
        <h2 className="text-lg font-medium text-slate-900 mb-1">
          Add a new source
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Paste the AL segment / audience ID, give it a name and default
          property type, and we'll run a sync immediately so you can see
          leads land in <code className="font-mono text-xs text-slate-700">/marketplace</code>.
        </p>
        <MarketplaceSourceForm />
      </section>

      <section>
        <h2 className="text-lg font-medium text-slate-900 mb-4">
          Configured sources
        </h2>
        {sources.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-10 text-center">
            <p className="text-sm text-slate-500">
              No sources yet. Add your first one above.
            </p>
          </div>
        ) : (
          <MarketplaceSourceList
            sources={sources.map((s) => ({
              id: s.id,
              name: s.name,
              kind: s.kind,
              externalId: s.externalId ?? "",
              defaultPropertyType: s.defaultPropertyType,
              defaultMarket: s.defaultMarket,
              minScoreFloor: s.minScoreFloor,
              baselineScore: s.baselineScore,
              defaultPriceCents: s.defaultPriceCents,
              requireFullEnrichment: s.requireFullEnrichment,
              enabled: s.enabled,
              lastRunAt: s.lastRunAt?.toISOString() ?? null,
              lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
              lastIngestedCount: s.lastIngestedCount,
              lastEnrichedCount: s.lastEnrichedCount,
              lastExpiredCount: s.lastExpiredCount,
              leadCount: s._count.leads,
              runs: s.runs.map((r) => ({
                id: r.id,
                status: r.status,
                startedAt: r.startedAt.toISOString(),
                finishedAt: r.finishedAt?.toISOString() ?? null,
                fetchedCount: r.fetchedCount,
                upsertedCount: r.upsertedCount,
                newCount: r.newCount,
                refreshedCount: r.refreshedCount,
                expiredCount: r.expiredCount,
                failedCount: r.failedCount,
                errorMessage: r.errorMessage,
                ago: formatDistanceToNow(r.startedAt, { addSuffix: true }),
              })),
            }))}
          />
        )}
        <p className="mt-4 text-xs text-slate-400 font-mono">
          {totalRuns.toLocaleString()} replenish runs recorded · weekly cron at Mon 06:00 UTC
        </p>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-medium text-slate-900">{value}</p>
    </div>
  );
}
