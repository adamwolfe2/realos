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

export const metadata: Metadata = { title: "Lead to lease proof" };
export const dynamic = "force-dynamic";

const SOURCE_OPTIONS: Array<{ value: LeadSource; label: string }> = [
  { value: LeadSource.CHATBOT, label: "Chatbot" },
  { value: LeadSource.FORM, label: "Forms and popups" },
  { value: LeadSource.PIXEL_OUTREACH, label: "Visitor pixel" },
  { value: LeadSource.GOOGLE_ADS, label: "Google Ads" },
  { value: LeadSource.META_ADS, label: "Meta Ads" },
  { value: LeadSource.ORGANIC, label: "Organic" },
  { value: LeadSource.DIRECT, label: "Direct" },
  { value: LeadSource.REFERRAL, label: "Referral" },
  { value: LeadSource.MANUAL, label: "Manual" },
  { value: LeadSource.OTHER, label: "Other / imported" },
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
        <form action="/portal/attribution" className="flex items-center gap-2">
          <input type="hidden" name="from" value={range.fromIso} />
          <input type="hidden" name="to" value={range.toIso} />
          {params.properties ? (
            <input type="hidden" name="properties" value={params.properties} />
          ) : null}
          <label htmlFor="attribution-source" className="sr-only">
            Source channel
          </label>
          <select
            id="attribution-source"
            name="source"
            defaultValue={source ?? ""}
            className="ls-select h-8 min-w-40 px-3 text-xs"
          >
            <option value="">All source channels</option>
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-8 bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Apply
          </button>
        </form>
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

      <section className="ls-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            Proof funnel
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One window, one cohort. Unconnected stages say Not tracked instead of showing a false zero.
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="flex min-w-max divide-x divide-border">
            {proof.funnel.map((stage) => (
              <div key={stage.key} className="w-36 px-4 py-3">
                <div className="ls-eyebrow">{stage.label}</div>
                <div className="mt-1 font-mono text-xl font-medium tabular-nums text-foreground">
                  {stage.tracked ? stage.count.toLocaleString() : "Not tracked"}
                </div>
                <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  {stage.provenance}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
                  <th className="px-4 py-2.5 font-semibold">First touch</th>
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
                      <div className="font-medium text-foreground">
                        {row.sourceLabel}
                      </div>
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
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
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
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
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
