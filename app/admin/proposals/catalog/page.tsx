import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { CatalogEditor } from "./catalog-editor";

export const metadata: Metadata = { title: "Proposal catalog" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  await requireAgency();

  let items: Awaited<ReturnType<typeof prisma.proposalCatalogItem.findMany>> =
    [];
  try {
    const mod = await import("@/lib/proposals/catalog");
    if (typeof mod.getCatalog === "function") {
      items = await mod.getCatalog();
    } else {
      items = await prisma.proposalCatalogItem.findMany({
        orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
      });
    }
  } catch {
    items = await prisma.proposalCatalogItem.findMany({
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/admin/proposals"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <span aria-hidden="true">←</span> Proposals
          </Link>
        }
        title="Catalog"
        description="Tiers and add-ons available to the proposal builder. Operators can override per-line; updates here change defaults for new lines only."
      />

      <SectionCard
        label="Items"
        description="Toggle active, edit label / description / default price. Use Seed from defaults if the catalog is empty."
      >
        <CatalogEditor
          items={items.map((i) => ({
            id: i.id,
            slug: i.slug,
            kind: i.kind,
            label: i.label,
            description: i.description,
            defaultPriceCents: i.defaultPriceCents,
            cadence: i.cadence,
            active: i.active,
            sortOrder: i.sortOrder,
          }))}
        />
      </SectionCard>
    </div>
  );
}
