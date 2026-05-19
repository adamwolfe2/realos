import * as React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { CreateNeighborhoodForm } from "./create-form";

export const metadata: Metadata = { title: "Neighborhood pages" };
export const dynamic = "force-dynamic";

export default async function NeighborhoodPagesIndex() {
  const scope = await requireScope();

  const [pages, properties] = await Promise.all([
    prisma.neighborhoodPage.findMany({
      where: { orgId: scope.orgId },
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
      where: { orgId: scope.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="SEO"
        title="Neighborhood pages"
        description="Generate per-neighborhood landing pages designed to rank in Google and get cited by AI answer engines. Each page is published to your marketing site at /n/<slug>."
      />

      <SectionCard
        label="Generate a new page"
        description="Pick a neighborhood and (optionally) the property it should anchor on. Claude drafts the page; you edit before publishing."
        className="mb-8"
      >
        <CreateNeighborhoodForm properties={properties} />
      </SectionCard>

      <SectionCard
        label="Existing pages"
        description={`${pages.length} page${pages.length === 1 ? "" : "s"} in this workspace.`}
      >
        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No pages yet. Generate one above to get started.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--hair)]">
            {pages.map((p) => (
              <li key={p.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/portal/seo/neighborhoods/${p.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {p.title || `${p.neighborhood}, ${p.city}`}
                  </Link>
                  <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                    /n/{p.slug} · {p.neighborhood}
                    {p.state ? `, ${p.state}` : ""}
                  </p>
                </div>
                <StatusPill status={p.status} />
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {formatDistanceToNow(p.updatedAt, { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function StatusPill({ status }: { status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const map = {
    DRAFT: { label: "Draft", className: "bg-amber-100 text-amber-800" },
    PUBLISHED: { label: "Published", className: "bg-emerald-100 text-emerald-800" },
    ARCHIVED: { label: "Archived", className: "bg-gray-100 text-gray-700" },
  } as const;
  const v = map[status];
  return (
    <span
      className={`text-[10.5px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${v.className}`}
    >
      {v.label}
    </span>
  );
}
