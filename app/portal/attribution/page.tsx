import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Download,
  FileSearch,
  Users,
} from "lucide-react";
import { LeadSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  effectivePropertyIds,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { getAttributionProof } from "@/lib/attribution/proof";
import {
  parseAttributionDateRange,
  parseAttributionSource,
} from "@/lib/attribution/proof-filters";
import { getAppFolioStatus } from "@/lib/integrations/appfolio-status";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { RangePresetControl } from "@/components/portal/attribution/range-preset-control";
import { StatusChip } from "@/components/portal/ui/status-chip";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { SourceLogo } from "@/components/portal/attribution/source-logo";
import { getSource } from "@/lib/attribution/source-taxonomy";
import type { TrafficSourceSummaryRow } from "@/lib/attribution/proof-model";

export const metadata: Metadata = { title: "Lead to lease proof" };
export const dynamic = "force-dynamic";

const SOURCE_OPTIONS: Array<{ value: LeadSource; label: string }> = [
  { value: LeadSource.CHATBOT, label: "Chatbot" },
  { value: LeadSource.FORM, label: "Popups and forms" },
  { value: LeadSource.GOOGLE_ADS, label: "Google Ads" },
  { value: LeadSource.META_ADS, label: "Meta Ads" },
  { value: LeadSource.ORGANIC, label: "Organic" },
  { value: LeadSource.DIRECT, label: "Direct" },
  { value: LeadSource.REFERRAL, label: "Referral" },
  { value: LeadSource.MANUAL, label: "Manual" },
  { value: LeadSource.OTHER, label: "Other / imported" },
];

const SOURCE_FILTERS: Array<{ value: LeadSource | null; label: string }> = [
  { value: null, label: "All" },
  ...SOURCE_OPTIONS,
];

export default async function AttributionPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    property?: string;
    properties?: string;
    source?: string;
  }>;
}) {
  const gate = await requireModule("moduleAttribution");
  if (gate) return gate;

  const scope = await requireScope();
  const params = await searchParams;
  const range = parseAttributionDateRange(params.from, params.to);
  const requestedIds = await parsePropertyFilter(params, scope.orgId);

  const allProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const properties = visibleProperties(scope, allProperties);
  const tenantValid = (requestedIds ?? []).filter((id) =>
    properties.some((property) => property.id === id),
  );
  const gatedIds = effectivePropertyIds(
    scope,
    tenantValid.length > 0 ? tenantValid : null,
  );
  const propertyIds = gatedIds ?? properties.map((property) => property.id);
  const source = parseAttributionSource(params.source);

  const [proof, appfolio] = await Promise.all([
    getAttributionProof({
      orgId: scope.orgId,
      propertyIds,
      includeOrgLevel: gatedIds === null,
      fromDate: range.fromDate,
      toDate: range.toDate,
      source,
    }),
    getAppFolioStatus(scope.orgId),
  ]);

  const exportParams = new URLSearchParams({
    from: range.fromIso,
    to: range.toIso,
  });
  if (params.properties) exportParams.set("properties", params.properties);
  if (source) exportParams.set("source", source);

  return (
    <div className="space-y-4 ls-page-fade">
      <PageHeader
        eyebrow="Attribution"
        title="Lead to lease proof"
        description="See where every lead came from and which LeaseStack leads became verified AppFolio outcomes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/api/tenant/attribution/export?${exportParams.toString()}`}
              className="inline-flex h-9 items-center gap-2 border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Link>
            <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 border border-border bg-secondary/40 px-3 py-2.5">
        <RangePresetControl
          basePath="/portal/attribution"
          activeDays={range.dayCount}
          properties={params.properties}
          source={source ?? undefined}
        />
        <nav
          aria-label="Filter leads by source"
          className="flex min-w-0 flex-1 flex-wrap gap-1 border border-border bg-background p-1"
        >
          {SOURCE_FILTERS.map((option) => {
            const active = source === option.value;
            return (
              <Link
                key={option.value ?? "all"}
                href={sourceFilterHref({
                  source: option.value,
                  from: range.fromIso,
                  to: range.toIso,
                  properties: params.properties,
                })}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "shrink-0 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    : "shrink-0 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-primary-dark"
                }
              >
                {option.label}
              </Link>
            );
          })}
        </nav>
        <AppFolioHealth status={appfolio} />
      </div>

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="LeaseStack leads"
          value={proof.summary.captured.toLocaleString()}
          hint={`${proof.summary.imported.toLocaleString()} imported leads labeled separately`}
          icon={<Users className="h-4 w-4" />}
          variant="accent"
        />
        <KpiTile
          label="Applied"
          value={proof.summary.applied.toLocaleString()}
          hint="Lead status or AppFolio application"
          icon={<FileSearch className="h-4 w-4" />}
        />
        <KpiTile
          label="Verified signed"
          value={proof.summary.verifiedSigned.toLocaleString()}
          hint="Matched AppFolio resident and lease"
          icon={<BadgeCheck className="h-4 w-4" />}
        />
        <KpiTile
          label="Needs review"
          value={proof.summary.reviewNeeded.toLocaleString()}
          hint="Possible matches, never counted as signed"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </section>

      <TrafficSourcesPanel rows={proof.trafficSources} />

      <section className="ls-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Lead proof ledger
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Source, identity, stage, and outcome evidence for every lead in this window.
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {proof.rows.length.toLocaleString()} rows
          </span>
        </div>

        {proof.rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              variant="bare"
              icon={<FileSearch className="h-4 w-4" />}
              title="No leads in this window"
              body="Try a wider date range or another property."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-secondary/70 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Lead</th>
                  <th className="px-4 py-2.5 font-semibold">Source and proof</th>
                  <th className="px-4 py-2.5 font-semibold">First seen</th>
                  <th className="px-4 py-2.5 font-semibold">Current stage</th>
                  <th className="px-4 py-2.5 font-semibold">PMS outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {proof.rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-secondary/35">
                    <td className="px-4 py-3">
                      <Link
                        href={`/portal/leads/${row.id}`}
                        className="font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                      <div className="mt-1 max-w-56 truncate text-muted-foreground">
                        {row.email ?? row.phone ?? "Identity incomplete"}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {row.propertyName ?? "Unassigned property"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge row={row} />
                      {row.trafficSourceId ? (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-foreground">
                          <SourceLogo logo={row.trafficSourceId} size={14} />
                          <span>via {row.trafficSourceLabel}</span>
                        </div>
                      ) : null}
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {row.provenance}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-foreground">
                      {formatDate(row.firstTouchAt)}
                      <div className="mt-1 font-sans text-[10px] text-muted-foreground">
                        Captured {formatDate(row.capturedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">
                        {row.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ProofState row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {proof.reviewRows.length > 0 ? (
        <section className="ls-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Match review queue
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              These candidates are excluded from verified ROI until an operator confirms them.
            </p>
          </div>
          <div className="divide-y divide-border">
            {proof.reviewRows.map((row) => (
              <div
                key={row.decisionId}
                className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-center"
              >
                <div>
                  <div className="ls-eyebrow">
                    AppFolio outcome
                  </div>
                  <div className="mt-1 font-semibold text-foreground">
                    {row.residentName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.residentEmail ?? row.residentPhone ?? "Identity incomplete"}
                  </div>
                </div>
                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                  {row.confidence}%
                  <div className="font-sans text-[10px]">{row.method}</div>
                </div>
                <div>
                  <div className="ls-eyebrow">
                    Suggested LeaseStack lead
                  </div>
                  <div className="mt-1 font-semibold text-foreground">
                    {row.candidateLeadName ?? "Multiple possible leads"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.propertyName ?? "Unassigned property"}
                  </div>
                </div>
                {row.candidateLeadId ? (
                  <Link
                    href={`/portal/leads/${row.candidateLeadId}`}
                    className="inline-flex h-8 items-center justify-center border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    Review match
                  </Link>
                ) : (
                  <Link
                    href="/portal/leads"
                    className="inline-flex h-8 items-center justify-center border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    Find lead
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProofState({
  row,
}: {
  row: Awaited<ReturnType<typeof getAttributionProof>>["rows"][number];
}) {
  if (row.verification === "verified") {
    return (
      <div>
        <StatusChip
          status="live"
          label={`Verified${row.matchConfidence !== null ? ` · ${row.matchConfidence}%` : ""}`}
        />
        <div className="mt-1 text-[10px] text-muted-foreground">
          {row.outcomeEvidence}
          {row.matchMethod ? ` · ${row.matchMethod}` : ""}
        </div>
      </div>
    );
  }
  if (row.verification === "review_needed") {
    return (
      <div>
        <StatusChip
          status="stale"
          label={`Review needed${row.matchConfidence !== null ? ` · ${row.matchConfidence}%` : ""}`}
        />
        <div className="mt-1 text-[10px] text-muted-foreground">
          Not counted as signed
        </div>
      </div>
    );
  }
  if (row.verification === "imported") {
    return (
      <div>
        <StatusChip status="not_connected" label="Imported from PMS" />
        <div className="mt-1 text-[10px] text-muted-foreground">
          Excluded from LeaseStack-generated ROI
        </div>
      </div>
    );
  }
  return (
    <div>
      <StatusChip status="not_connected" label="LeaseStack only" />
      <div className="mt-1 text-[10px] text-muted-foreground">
        {row.outcomeEvidence}
      </div>
    </div>
  );
}

// Where website leads first came from (Zillow, Google, ChatGPT...), from the
// first-touch source the embeds record. Tracked channels get brand-colored
// bars scaled against each other; untracked leads are a footnote, not a bar,
// so history from before tracking never dwarfs the real channels.
const CATEGORY_LABEL: Record<string, string> = {
  ils: "Listing site",
  search: "Search",
  ai: "AI assistant",
  paid: "Paid ads",
  social: "Social",
  local: "Local and reviews",
  campus: "Campus housing",
  owned: "Owned",
  referral: "Referring site",
  direct: "Typed in or bookmarked",
  leasing: "Leasing",
  other: "Other",
};

function TrafficSourcesPanel({ rows }: { rows: TrafficSourceSummaryRow[] }) {
  const tracked = rows.filter((row) => row.id !== "untracked");
  const untracked = rows.find((row) => row.id === "untracked")?.leads ?? 0;
  const trackedTotal = tracked.reduce((sum, row) => sum + row.leads, 0);
  if (tracked.length === 0 && untracked === 0) return null;
  const max = Math.max(...tracked.map((row) => row.leads), 1);
  const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

  return (
    <section className="ls-card overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Where leads came from</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The site or platform that sent each lead: tracked on your website, or as recorded in AppFolio where marked.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{trackedTotal.toLocaleString()}</span>{" "}
          {trackedTotal === 1 ? "lead" : "leads"} with a known source
        </span>
      </div>

      {tracked.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          No tracked leads in this window yet. New leads are tagged automatically as they come in.
        </p>
      ) : (
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-5 py-2 font-semibold">Source</th>
              <th className="hidden px-2 py-2 font-semibold md:table-cell">Share</th>
              <th className="w-20 px-2 py-2 text-right font-semibold">Leads</th>
              <th className="w-20 px-2 py-2 text-right font-semibold">Applied</th>
              <th className="w-20 py-2 pl-2 pr-5 text-right font-semibold">Signed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tracked.map((row) => {
              const src = getSource(row.id);
              const share = trackedTotal > 0 ? Math.round((row.leads / trackedTotal) * 100) : 0;
              return (
                <tr key={`${row.id}:${row.label}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <SourceLogo logo={row.id} size={32} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{row.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {CATEGORY_LABEL[src.category] ?? "Other"}
                          {row.reportedByAppfolio > 0
                            ? ` · ${row.reportedByAppfolio === row.leads ? "all" : row.reportedByAppfolio} per AppFolio`
                            : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden w-[42%] px-2 py-3 md:table-cell">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.max((row.leads / max) * 100, 3)}%`,
                            background: row.id === "referral" ? "#64748B" : src.color,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {share}%
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                    {row.leads.toLocaleString()}
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {row.applied.toLocaleString()}
                  </td>
                  <td className="py-3 pl-2 pr-5 text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {row.signed.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {untracked > 0 ? (
        <p className="border-t border-border bg-secondary/40 px-5 py-2.5 text-[11px] text-muted-foreground">
          {plural(untracked, "lead")} in this window have no recorded source, mostly captured before
          source tracking started on Nov 11, 2026. They are not counted above.
        </p>
      ) : null}
    </section>
  );
}

function SourceBadge({
  row,
}: {
  row: Awaited<ReturnType<typeof getAttributionProof>>["rows"][number];
}) {
  const style =
    row.verification === "imported"
      ? "bg-slate-100 text-slate-700"
      : row.source === LeadSource.CHATBOT
        ? "bg-primary/15 text-primary-dark"
        : row.source === LeadSource.FORM
          ? "bg-sky-100 text-sky-800"
          : "bg-accent text-primary-dark";

  return (
    <span className={`inline-flex px-2 py-1 text-[11px] font-semibold ${style}`}>
      {row.sourceLabel}
    </span>
  );
}

function sourceFilterHref(args: {
  source: LeadSource | null;
  from: string;
  to: string;
  properties?: string;
}): string {
  const query = new URLSearchParams({ from: args.from, to: args.to });
  if (args.properties) query.set("properties", args.properties);
  if (args.source) query.set("source", args.source);
  return `/portal/attribution?${query.toString()}`;
}

function AppFolioHealth({
  status,
}: {
  status: Awaited<ReturnType<typeof getAppFolioStatus>>;
}) {
  const spec =
    status.state === "synced"
      ? { status: "live" as const, label: "AppFolio outcomes live" }
      : status.state === "syncing"
        ? { status: "connecting" as const, label: "AppFolio syncing" }
        : status.state === "failed"
          ? { status: "error" as const, label: "AppFolio sync failed" }
          : status.state === "partial" || status.stale
            ? { status: "stale" as const, label: "AppFolio needs attention" }
            : { status: "not_connected" as const, label: "AppFolio not connected" };
  return (
    <Link href="/portal/connect" className="ml-auto">
      <StatusChip status={spec.status} label={spec.label} />
    </Link>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
