import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  parsePropertyFilter,
  propertyWhereFragment,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { createReport } from "@/lib/actions/reports";
import { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Client reports" };
export const dynamic = "force-dynamic";

type Search = {
  kind?: string;
  status?: string;
  property?: string;
  properties?: string;
};

export default async function ReportsListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const gate = await requireModule("moduleInsights");
  if (gate) return gate;

  const scope = await requireScope();
  const sp = await searchParams;

  const propertyIds = await parsePropertyFilter(sp, scope.orgId);
  const where: Prisma.ClientReportWhereInput = {
    ...tenantWhere(scope),
    ...propertyWhereFragment(scope, propertyIds),
  };
  if (sp.kind === "weekly" || sp.kind === "monthly" || sp.kind === "custom") {
    where.kind = sp.kind;
  }
  if (sp.status === "draft" || sp.status === "shared" || sp.status === "archived") {
    where.status = sp.status;
  }

  // Property list for the picker. Hidden when the org only has one
  // property (single-asset tenants don't need to choose). Narrowed to
  // the user's allowed set via UserPropertyAccess.
  const allProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const properties = visibleProperties(scope, allProperties);

  const reports = await prisma.clientReport.findMany({
    where,
    orderBy: { generatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      generatedAt: true,
      sharedAt: true,
      viewCount: true,
      headline: true,
      property: { select: { id: true, name: true } },
    },
  });

  // Bug #115 (was #8): three reports with identical title "End of Month
  // Report 5/22" (2 SHARED + 1 GENERATED) made it impossible to tell which
  // version was actually live for the client. We don't auto-archive (data
  // loss risk) — instead we flag the duplicates so the operator can decide.
  // Group reports by (effective title, kind, periodStart) and:
  //   - badge the most recently SHARED row in each group as "Most recent"
  //   - badge older rows in the same group as "Outdated" + dim them
  // Reports with a unique title in their (kind, periodStart) bucket render
  // unchanged.
  type DupeBadge = "most-recent" | "outdated" | null;
  const dupeBadge = new Map<string, DupeBadge>();
  {
    const effectiveTitle = (r: (typeof reports)[number]): string =>
      (r.headline?.trim() ||
        `${r.periodStart.toISOString()}_${r.periodEnd.toISOString()}`).toLowerCase();
    const groups = new Map<string, typeof reports>();
    for (const r of reports) {
      const propertyKey = r.property?.id ?? "__portfolio__";
      const key = `${r.kind}::${propertyKey}::${r.periodStart.toISOString()}::${effectiveTitle(r)}`;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    for (const arr of groups.values()) {
      if (arr.length < 2) continue;
      // Pick "latest shared" = highest sharedAt among status === "shared".
      // Fall back to highest generatedAt if nothing is shared yet.
      const shared = arr.filter((r) => r.status === "shared" && r.sharedAt);
      const winner = shared.length
        ? shared.reduce((best, r) =>
            (r.sharedAt as Date) > (best.sharedAt as Date) ? r : best,
          )
        : arr.reduce((best, r) =>
            r.generatedAt > best.generatedAt ? r : best,
          );
      for (const r of arr) {
        if (r.id === winner.id) {
          dupeBadge.set(r.id, "most-recent");
        } else {
          dupeBadge.set(r.id, "outdated");
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client reports"
        title="Weekly and monthly reviews"
        description="Generate a frozen snapshot of the numbers, add a personal note, then share a clean link with your client. Nothing auto-sends. You review every report before it leaves the building."
        actions={
          <form
            action={generateReport}
            className="flex flex-wrap items-end gap-2"
          >
            {properties.length > 1 ? (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  Scope
                </span>
                <select
                  name="propertyId"
                  defaultValue=""
                  className="ls-select px-3 py-2 text-sm min-w-[200px]"
                  aria-label="Property scope"
                >
                  <option value="">Whole portfolio · all properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1">
              <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                Period
              </span>
              <select
                name="kind"
                defaultValue="monthly"
                className="ls-select px-3 py-2 text-sm"
                aria-label="Report period"
              >
                <option value="weekly">Weekly (7d)</option>
                <option value="monthly">Monthly (28d)</option>
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Generate report
            </button>
          </form>
        }
      />

      {/* Quick link to the portfolio funnel — the one-page traffic→application
          roll-up across every property, for sharing with managers. */}
      <Link
        href="/portal/reports/portfolio"
        className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-4.5 w-4.5" />
          </span>
          <div>
            <div className="text-[13.5px] font-semibold text-foreground">Portfolio funnel</div>
            <div className="text-[12px] text-muted-foreground">
              Traffic → leads → tours → applications across every property — one page for managers.
            </div>
          </div>
        </div>
        <span className="text-[13px] font-semibold text-primary group-hover:underline">View →</span>
      </Link>

      {/* Filters: property scope sits beside the kind/status filters so
          the operator picks "which properties" + "which kinds of reports"
          at the same level. The multi-select lives outside the form (it
          drives the URL directly) and the hidden field below preserves
          the property selection across kind/status submits. */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Properties
          </span>
          <PropertyMultiSelect
            properties={properties}
            orgId={scope.orgId}
          />
        </div>
        <form
          action="/portal/reports"
          className="flex flex-wrap items-end gap-3"
        >
          {sp.properties ? (
            <input type="hidden" name="properties" value={sp.properties} />
          ) : null}
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
              Kind
            </span>
            <select
              name="kind"
              defaultValue={sp.kind ?? ""}
              className="ls-select px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
              Status
            </span>
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className="ls-select px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="shared">Shared</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Apply filters
          </button>
          <Link
            href="/portal/reports"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Reset
          </Link>
        </form>
      </div>

      {/* List */}
      {reports.length === 0 ? (
        <EmptyState
          title="Generate your first report"
          body="Use the Generate report button up top to capture this period's leads, tours, ad spend, and organic traffic as a frozen snapshot. Add a personal note, then copy a shareable link for your client. Nothing auto-sends."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {reports.map((r) => {
              const badge = dupeBadge.get(r.id) ?? null;
              const dim = badge === "outdated";
              return (
              <Link
                key={r.id}
                href={`/portal/reports/${r.id}`}
                className={
                  "flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted transition-colors" +
                  (dim ? " opacity-60" : "")
                }
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                      {kindLabel(r.kind)}
                    </span>
                    <StatusPill status={r.status} />
                    {r.property ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {r.property.name}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                        Portfolio
                      </span>
                    )}
                    {badge === "most-recent" ? (
                      <span
                        title="Most recently shared version of a duplicate set"
                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded"
                      >
                        Most recent
                      </span>
                    ) : null}
                    {badge === "outdated" ? (
                      <span
                        title="A newer report with the same title and period has been shared. Consider archiving."
                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded"
                      >
                        Outdated
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm font-semibold text-foreground truncate">
                    {r.headline ||
                      `${formatDate(r.periodStart)} to ${formatDate(r.periodEnd)}`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Generated {formatDate(r.generatedAt)}
                    {r.sharedAt ? ` \u00b7 Shared ${formatDate(r.sharedAt)}` : ""}
                    {r.viewCount > 0 ? ` \u00b7 ${r.viewCount} views` : ""}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Open</span>
              </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server actions bound to the two generator buttons.
// ---------------------------------------------------------------------------

async function generateReport(formData: FormData): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const kindRaw = (formData.get("kind") ?? "monthly").toString();
  const kind =
    kindRaw === "weekly" || kindRaw === "monthly" || kindRaw === "custom"
      ? (kindRaw as "weekly" | "monthly" | "custom")
      : "monthly";
  const propertyIdRaw = formData.get("propertyId");
  const propertyId =
    typeof propertyIdRaw === "string" && propertyIdRaw.length > 0
      ? propertyIdRaw
      : null;
  const res = await createReport(kind, { propertyId });
  redirect(`/portal/reports/${res.id}`);
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: string }) {
  // Tones follow the StatusChip convention (status-chip.tsx): a shared
  // report is a positive terminal state → success green; draft is neutral
  // gray (work in progress, no signal); archived is dimmed neutral.
  const tone =
    status === "shared"
      ? "bg-success/10 text-success"
      : status === "archived"
        ? "bg-muted text-muted-foreground/70"
        : "bg-muted text-muted-foreground";
  return (
    <span className={"text-xs uppercase tracking-wide px-1.5 py-0.5 rounded " + tone}>
      {status}
    </span>
  );
}

function kindLabel(kind: string): string {
  if (kind === "weekly") return "Weekly";
  if (kind === "monthly") return "Monthly";
  return "Custom";
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
