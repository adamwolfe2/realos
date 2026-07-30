import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/portal/ui/data-table";
import { GenerateNeighborhoodDrawer } from "./generate-drawer";

export const metadata: Metadata = { title: "Neighborhood pages" };
export const dynamic = "force-dynamic";

export default async function NeighborhoodPagesIndex() {
  const scope = await requireScope();

  // Property-level RBAC: match every other SEO route (drafts, recommendations,
  // agent, properties) — a restricted user only sees pages/properties within
  // their allowedPropertyIds set.
  const [pages, properties] = await Promise.all([
    prisma.neighborhoodPage.findMany({
      where: {
        orgId: scope.orgId,
        ...(scope.allowedPropertyIds
          ? { propertyId: { in: scope.allowedPropertyIds } }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        city: true,
        state: true,
        neighborhood: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
        propertyId: true,
      },
    }),
    prisma.property.findMany({
      where: {
        orgId: scope.orgId,
        ...(scope.allowedPropertyIds
          ? { id: { in: scope.allowedPropertyIds } }
          : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  type PageRow = (typeof pages)[number];
  const columns: DataTableColumn<PageRow>[] = [
    {
      key: "page",
      header: "Page",
      // max-w cap + line-clamp (not truncate): title is free text and can
      // run long enough to pin the column at min-content width and shove
      // Status/Updated off-screen.
      accessor: (p) => (
        <div className="min-w-0 max-w-[420px]">
          <p className="text-xs font-semibold text-foreground line-clamp-1 leading-tight">
            {p.title || `${p.neighborhood}, ${p.city}`}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
            /n/{p.slug} · {p.neighborhood}
            {p.state ? `, ${p.state}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "110px",
      accessor: (p) => <StatusPill status={p.status} />,
    },
    {
      key: "updated",
      header: "Updated",
      width: "110px",
      align: "right",
      accessor: (p) => (
        <span className="text-[11px] text-muted-foreground">
          {formatDistanceToNow(p.updatedAt, { addSuffix: true })}
        </span>
      ),
    },
  ];

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="SEO"
        title="Neighborhood pages"
        description="Generate per-neighborhood landing pages designed to rank in Google and get cited by AI answer engines. Each page is published to your marketing site at /n/<slug>."
        actions={<GenerateNeighborhoodDrawer properties={properties} />}
      />

      <SectionCard
        label="Existing pages"
        description={
          pages.length === 0
            ? "Generate your first neighborhood page using the button above. Each page is published to your marketing site at /n/<slug>."
            : `${pages.length} page${pages.length === 1 ? "" : "s"} in this workspace.`
        }
      >
        <DataTable<PageRow>
          columns={columns}
          rows={pages}
          getRowHref={(p) => `/portal/seo/neighborhoods/${p.id}`}
          density="compact"
          emptyState={
            <div className="px-2 py-6 text-center">
              <p className="text-[13px] font-semibold text-foreground">
                No neighborhood pages yet.
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground leading-snug max-w-md mx-auto">
                Start with the neighborhood your flagship property anchors —
                that page tends to rank fastest because Google already sees
                you cited there.
              </p>
            </div>
          }
        />
      </SectionCard>
    </div>
  );
}

function StatusPill({ status }: { status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  // Lowercase, rounded-md, 11px — matches the portal-wide status pill
  // grammar (no amber/emerald rainbow; brand-primary vs neutral only).
  const map = {
    DRAFT: { label: "draft", className: "bg-muted text-muted-foreground border border-border" },
    PUBLISHED: { label: "published", className: "bg-primary/10 text-primary" },
    ARCHIVED: { label: "archived", className: "bg-muted text-muted-foreground" },
  } as const;
  const v = map[status];
  return (
    <span
      className={`text-[11px] font-medium lowercase rounded-md px-1.5 py-0.5 ${v.className}`}
    >
      {v.label}
    </span>
  );
}
