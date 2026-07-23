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

  return (
    <div className="w-full">
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
        description={
          pages.length === 0
            ? "Generate your first neighborhood page above. Each page is published to your marketing site at /n/<slug>."
            : `${pages.length} page${pages.length === 1 ? "" : "s"} in this workspace.`
        }
      >
        {pages.length === 0 ? (
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
