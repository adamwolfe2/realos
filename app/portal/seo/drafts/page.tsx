import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { DraftStatus } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { TargetQueryManager } from "@/components/portal/seo/target-query-manager";
import { StatusChipStrip } from "@/components/portal/ui/status-chip-strip";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/portal/ui/data-table";

export const metadata: Metadata = { title: "Content drafts" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/seo/drafts — operator cross-property view of every content
// draft they've sent for review. Mirrors /admin/content-drafts shape
// but scoped to the calling org + the operator's property-RBAC set.
//
// Default filter = PENDING_REVIEW + CHANGES_REQUESTED so operators see
// what needs their attention first. Chip strip switches to APPROVED /
// SHIPPED / REJECTED for audit.
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: Array<{
  value: DraftStatus | "ACTIVE";
  label: string;
}> = [
  { value: "ACTIVE", label: "Active" },
  { value: DraftStatus.PENDING_REVIEW, label: "Pending review" },
  { value: DraftStatus.CHANGES_REQUESTED, label: "Changes requested" },
  { value: DraftStatus.APPROVED, label: "Approved" },
  { value: DraftStatus.SHIPPED, label: "Shipped" },
  { value: DraftStatus.REJECTED, label: "Rejected" },
];

// Draft status tones. Matches /portal/content list + admin queue.
// Terminal states (approved/shipped) use the success-green family, never
// blue-as-success.
const STATUS_TONE: Record<string, string> = {
  GENERATING:        "bg-muted text-muted-foreground",
  PENDING_REVIEW:    "bg-primary/10 text-primary",
  APPROVED:          "bg-success/15 text-success font-semibold",
  CHANGES_REQUESTED: "bg-muted text-foreground",
  REJECTED:          "bg-muted text-muted-foreground line-through",
  SHIPPED:           "bg-success text-success-foreground",
  EXPIRED:           "bg-muted text-muted-foreground/70",
};

function fmtAge(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(0, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function PortalDraftsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;

  const requested = sp.status ?? "ACTIVE";
  const filter = STATUS_OPTIONS.find((o) => o.value === requested)
    ? (requested as (typeof STATUS_OPTIONS)[number]["value"])
    : "ACTIVE";

  const where: Record<string, unknown> = { ...tenantWhere(scope) };
  if (scope.allowedPropertyIds) {
    where.propertyId = { in: scope.allowedPropertyIds };
  }
  if (filter === "ACTIVE") {
    where.status = {
      in: [
        DraftStatus.GENERATING,
        DraftStatus.PENDING_REVIEW,
        DraftStatus.CHANGES_REQUESTED,
      ],
    };
  } else {
    where.status = filter as DraftStatus;
  }

  const [drafts, statusCounts] = await Promise.all([
    prisma.contentDraft.findMany({
      where: where as never,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        format: true,
        brief: true,
        targetQuery: true,
        status: true,
        estimatedScore: true,
        submittedAt: true,
        reviewedAt: true,
        reviewNotes: true,
        createdAt: true,
        propertyId: true,
        property: { select: { name: true } },
      },
    }),
    prisma.contentDraft.groupBy({
      by: ["status"],
      where: {
        ...tenantWhere(scope),
        ...(scope.allowedPropertyIds
          ? { propertyId: { in: scope.allowedPropertyIds } }
          : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map(statusCounts.map((s) => [s.status, s._count._all]));
  const activeCount =
    (countMap.get("GENERATING") ?? 0) +
    (countMap.get("PENDING_REVIEW") ?? 0) +
    (countMap.get("CHANGES_REQUESTED") ?? 0);

  type DraftRow = (typeof drafts)[number];
  const columns: DataTableColumn<DraftRow>[] = [
    {
      key: "draft",
      header: "Draft",
      // max-w cap + line-clamp (not truncate): `truncate` = nowrap, and with
      // table-layout:auto a 200-char brief pins the column at its min-content
      // width, shoving Status/Score/Age off-screen (the known grid-item
      // min-content overflow trap).
      accessor: (d) => (
        <div className="min-w-0 max-w-[420px]">
          <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">
            {d.brief}
          </p>
          {d.targetQuery ? (
            <p className="text-[10px] font-mono text-muted-foreground truncate leading-tight mt-0.5">
              target: {d.targetQuery}
            </p>
          ) : null}
          {d.reviewNotes ? (
            <p className="text-[11px] text-foreground line-clamp-2 leading-tight mt-0.5">
              <span className="font-medium text-primary">Notes:</span>{" "}
              {d.reviewNotes}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "format",
      header: "Format",
      width: "140px",
      hideOnMobile: true,
      accessor: (d) => (
        <span className="rounded-[2px] bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-primary">
          {d.format.replace(/_/g, " ").toLowerCase()}
        </span>
      ),
    },
    {
      key: "property",
      header: "Property",
      width: "160px",
      hideOnMobile: true,
      accessor: (d) =>
        d.property?.name ? (
          <span className="text-[11px] text-muted-foreground">
            {d.property.name}
          </span>
        ) : null,
    },
    {
      key: "status",
      header: "Status",
      width: "150px",
      accessor: (d) => {
        const tone = STATUS_TONE[d.status] ?? STATUS_TONE.GENERATING;
        return (
          <span
            className={`rounded-[2px] px-1.5 py-0.5 text-[10px] font-mono uppercase ${tone}`}
          >
            {d.status.replace(/_/g, " ").toLowerCase()}
          </span>
        );
      },
    },
    {
      key: "score",
      header: "Score",
      width: "70px",
      align: "right",
      accessor: (d) =>
        d.estimatedScore != null ? (
          <span className="font-mono text-muted-foreground">
            {d.estimatedScore}
          </span>
        ) : null,
    },
    {
      key: "age",
      header: "Age",
      width: "60px",
      align: "right",
      accessor: (d) => (
        <span className="text-muted-foreground">
          {fmtAge(d.submittedAt ?? d.createdAt)}
        </span>
      ),
    },
  ];

  // Target-query CRUD is per-property; this cross-property drafts inbox has
  // no single property in context, so — same featured-property rule as
  // /portal/seo/agent — scope it to the first LIVE marketable property,
  // falling back to the first marketable property.
  const marketableWhere = {
    ...marketablePropertyWhere(scope.orgId),
    ...(scope.allowedPropertyIds
      ? { id: { in: scope.allowedPropertyIds } }
      : {}),
  };
  const featuredProperty =
    (await prisma.property.findFirst({
      where: { ...marketableWhere, launchStatus: "LIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })) ??
    (await prisma.property.findFirst({
      where: marketableWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }));

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/portal/seo/agent"
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          &larr; SEO Agent
        </Link>
      </div>

      <PageHeader
        eyebrow="Content drafts"
        title="Your drafts inbox"
        description="Every AI-generated draft across your portfolio. LeaseStack reviews each one before anything ships."
      />

      <StatusChipStrip
        items={STATUS_OPTIONS.map((opt) => ({
          label: opt.label,
          href: `/portal/seo/drafts?status=${opt.value}`,
          count:
            opt.value === "ACTIVE" ? activeCount : (countMap.get(opt.value) ?? 0),
          active: opt.value === filter,
        }))}
      />

      <DataTable<DraftRow>
        columns={columns}
        rows={drafts}
        getRowHref={(d) => `/portal/seo/agent/drafts/${d.id}`}
        density="compact"
        emptyState={
          <div className="rounded-[2px] border border-dashed border-border bg-card p-8 text-center">
            <p className="text-[13px] font-medium text-foreground">
              {filter === "ACTIVE"
                ? "No drafts in flight."
                : `No ${STATUS_OPTIONS.find((o) => o.value === filter)?.label.toLowerCase()} drafts.`}
            </p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Open the SEO Agent for a property and click <span className="font-medium">Generate draft</span>.
            </p>
            <Link
              href="/portal/seo/agent"
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
            >
              Open SEO Agent →
            </Link>
          </div>
        }
      />

      {featuredProperty ? (
        <div className="space-y-1.5">
          {/* Codex review 2026-07-29: never silently bind CRUD to an
              unnamed property — say which one this manages. */}
          <p className="text-[11px] text-muted-foreground">
            Target queries for{" "}
            <span className="font-semibold text-foreground">
              {featuredProperty.name}
            </span>
            {" — "}switch properties from the{" "}
            <Link href="/portal/seo/agent" className="underline">
              SEO Agent
            </Link>
            .
          </p>
          <TargetQueryManager propertyId={featuredProperty.id} />
        </div>
      ) : null}
    </div>
  );
}
