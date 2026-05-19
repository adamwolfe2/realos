import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { EditorClient } from "./editor-client";
import { parseStored } from "@/lib/actions/neighborhood-pages";

export const metadata: Metadata = { title: "Edit neighborhood page" };
export const dynamic = "force-dynamic";

export default async function NeighborhoodPageEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  const [row, properties] = await Promise.all([
    prisma.neighborhoodPage.findFirst({
      where: { id, orgId: scope.orgId },
    }),
    prisma.property.findMany({
      where: { orgId: scope.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!row) notFound();
  const page = parseStored(row);
  if (!page) notFound();

  return (
    <div className="max-w-4xl">
      <PageHeader
        breadcrumb={
          <Link
            href="/portal/seo/neighborhoods"
            className="hover:underline"
          >
            ← Neighborhood pages
          </Link>
        }
        eyebrow={page.status}
        title={page.title || `${page.neighborhood}, ${page.city}`}
        description={`Public URL: /n/${page.slug}`}
      />
      <EditorClient page={page} properties={properties} />
    </div>
  );
}
