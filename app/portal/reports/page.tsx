import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  marketableScopedPropertyClause,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/portal/ui/data-table";
import { createReport } from "@/lib/actions/reports";
import { cn } from "@/lib/utils";
import { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Client reports" };
export const dynamic = "force-dynamic";

type Search = {
  kind?: string;
  status?: string;
  property?: string;
  properties?: string;
  sort?: string;
  dir?: string;
};

// Sortable columns map straight onto indexed-ish scalar fields, so the sort
// is a one-line orderBy swap — no extra queries.
const SORT_KEYS = ["period", "generated", "shared", "views"] as const;
type SortKey = (typeof SORT_KEYS)[number];

function parseSortKey(raw: string | undefined): SortKey {
  return SORT_KEYS.includes(raw as SortKey) ? (raw as SortKey) : "generated";
}

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
    // Default (no selection) scopes to enabled properties; org-wide
    // reports (propertyId=null — portfolio/monthly rollups) stay visible.
    ...(await marketableScopedPropertyClause(scope, propertyIds, "propertyId", {
      defaultIncludesOrgRows: true,
    })),
  };
  if (sp.kind === "weekly" || sp.kind === "monthly" || sp.kind === "custom") {
    where.kind = sp.kind;
  }
  if (sp.status === "draft" || sp.status === "shared" || sp.status === "archived") {
    where.status = sp.status;
  }

  const sortKey = parseSortKey(sp.sort);
  const sortDir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  const orderBy: Prisma.ClientReportOrderByWithRelationInput =
    sortKey === "period"
      ? { periodStart: sortDir }
      : sortKey === "shared"
        ? { sharedAt: sortDir }
        : sortKey === "views"
          ? { viewCount: sortDir }
          : { generatedAt: sortDir };

  const hrefForSort = (key: string): string => {
    const params = new URLSearchParams();
    if (sp.kind) params.set("kind", sp.kind);
    if (sp.status) params.set("status", sp.status);
    if (sp.property) params.set("property", sp.property);
    if (sp.properties) params.set("properties", sp.properties);
    params.set("sort", key);
    params.set("dir", key === sortKey && sortDir === "desc" ? "asc" : "desc");
    return `/portal/reports?${params.toString()}`;
  };

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
    orderBy,
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
  type ReportRow = (typeof reports)[number];

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
    const effectiveTitle = (r: ReportRow): string =>
      (r.headline?.trim() ||
        `${r.periodStart.toISOString()}_${r.periodEnd.toISOString()}`).toLowerCase();
    const groups = new Map<string, ReportRow[]>();
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

  const isDim = (r: ReportRow): boolean => dupeBadge.get(r.id) === "outdated";

  const columns: DataTableColumn<ReportRow>[] = [
    {
      key: "period",
      header: "Report",
      sortable: true,
      accessor: (r) => (
        <div className={cn("min-w-0", isDim(r) && "opacity-60")}>
          <p className="text-xs font-semibold text-foreground truncate leading-tight">
            {r.headline ||
              `${formatDate(r.periodStart)} to ${formatDate(r.periodEnd)}`}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
            {kindLabel(r.kind)} · {r.property ? r.property.name : "Portfolio"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "110px",
      accessor: (r) => <StatusPill status={r.status} dim={isDim(r)} />,
    },
    {
      key: "version",
      header: "Version",
      width: "130px",
      hideOnMobile: true,
      accessor: (r) => {
        const badge = dupeBadge.get(r.id) ?? null;
        if (badge === "most-recent") {
          return (
            <span
              title="Most recently shared version of a duplicate set"
              className="ls-pill ls-pill-success uppercase tracking-wide"
            >
              Most recent
            </span>
          );
        }
        if (badge === "outdated") {
          return (
            <span
              title="A newer report with the same title and period has been shared. Consider archiving."
              className="ls-pill ls-pill-warning uppercase tracking-wide"
            >
              Outdated
            </span>
          );
        }
        return <span className="text-muted-foreground/50">—</span>;
      },
    },
    {
      key: "generated",
      header: "Generated",
      sortable: true,
      width: "120px",
      hideOnMobile: true,
      accessor: (r) => (
        <span className={cn("text-muted-foreground", isDim(r) && "opacity-60")}>
          {formatDate(r.generatedAt)}
        </span>
      ),
    },
    {
      key: "shared",
      header: "Shared",
      sortable: true,
      width: "120px",
      hideOnMobile: true,
      accessor: (r) =>
        r.sharedAt ? (
          <span className={cn("text-muted-foreground", isDim(r) && "opacity-60")}>
            {formatDate(r.sharedAt)}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "views",
      header: "Views",
      sortable: true,
      align: "right",
      width: "80px",
      accessor: (r) =>
        r.viewCount > 0 ? (
          <span className={cn(isDim(r) && "opacity-60")}>
            {r.viewCount.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground/50">0</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client reports"
        title="Weekly and monthly reviews"
        description="Generate a frozen snapshot of the numbers, add a note, then share a clean link with your client. Nothing is sent automatically — every report is reviewed before it is shared."
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
              className="inline-flex items-center rounded-[2px] bg-primary text-primary-foreground px-3.5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
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
        className="group flex items-center justify-between gap-3 ls-card p-4 transition hover:border-primary/40"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] bg-primary/10 text-primary">
            <BarChart3 className="h-4.5 w-4.5" />
          </span>
          <div>
            <div className="text-[13.5px] font-semibold text-foreground">Portfolio funnel</div>
            <div className="text-[12px] text-muted-foreground">
              Traffic → leads → tours → applications across every property — one page for managers.
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary group-hover:underline">
          View
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </Link>

      {/* Filters: property scope sits beside the kind/status filters so
          the operator picks "which properties" + "which kinds of reports"
          at the same level. The multi-select lives outside the form (it
          drives the URL directly) and the hidden field below preserves
          the property selection across kind/status submits. */}
      <div className="ls-card p-4 flex flex-wrap items-end gap-3">
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
          {sp.sort ? <input type="hidden" name="sort" value={sp.sort} /> : null}
          {sp.dir ? <input type="hidden" name="dir" value={sp.dir} /> : null}
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
            className="inline-flex items-center rounded-[2px] border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
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

      {/* List — DataTable v2 (dense rows, URL-driven sort) replaces the
          rounded-xl card list. */}
      <DataTable<ReportRow>
        columns={columns}
        rows={reports}
        getRowHref={(r) => `/portal/reports/${r.id}`}
        sort={{ by: sortKey, dir: sortDir, hrefForSort }}
        density="compact"
        emptyState={
          <EmptyState
            title="Generate your first report"
            body="Use the Generate report button up top to capture this period's leads, tours, ad spend, and organic traffic as a frozen snapshot. Add a note, then copy a shareable link for your client. Nothing is sent automatically."
          />
        }
      />
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

function StatusPill({ status, dim }: { status: string; dim?: boolean }) {
  // Wave-3 tone mapping preserved, routed through the ls-pill system
  // (StatusChip convention, status-chip.tsx): a shared report is a positive
  // terminal state → success green; draft is neutral gray (work in
  // progress, no signal); archived is dimmed neutral.
  const tone = status === "shared" ? "ls-pill-success" : "ls-pill-neutral";
  return (
    <span
      className={cn(
        "ls-pill uppercase tracking-wide",
        tone,
        (status === "archived" || dim) && "opacity-60",
      )}
    >
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
