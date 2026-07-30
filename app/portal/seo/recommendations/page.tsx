import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { bucketCountsForRecommendations } from "@/lib/seo/categorize-recommendation";
import { OpportunitiesClient } from "./opportunities-client";

export const metadata: Metadata = { title: "Opportunities" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/seo/recommendations — "Opportunities" feed.
//
// Category chip strip up top (?category=&sub=, shared StatusChipStrip),
// dense DataTable below. Surfaces every OPEN + IN_PROGRESS rec for the
// operator's org, grouped into Setup / On Page / Off Page via the pure
// mapper in lib/seo/categorize-recommendation.ts.
//
// This file stays a server component — it does the auth-scoped read, sorts
// recs by score, and hands the result off to OpportunitiesClient (which
// owns category/search filtering and the optimistic Done / Decline
// mutations).
//
// We intentionally do not paginate here. In practice an active org has
// dozens — not thousands — of open recs, and the category chips break the
// list down small enough that no row is more than a couple of scrolls
// away. If we ever need pagination, the server-component boundary is the
// right place to add it.
// ---------------------------------------------------------------------------

export default async function OpportunitiesPage() {
  const scope = await requireScope();

  const where: Record<string, unknown> = {
    ...tenantWhere(scope),
    status: { in: ["OPEN", "IN_PROGRESS"] as const },
  };
  if (scope.allowedPropertyIds) {
    where.propertyId = { in: scope.allowedPropertyIds };
  }

  // Highest-score first so the top of the feed is always "what should we
  // ship next?". Severity is captured in the score by the engine, so a
  // raw score sort is the right primary ordering.
  const rows = await prisma.seoActionRecommendation.findMany({
    where: where as never,
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      category: true,
      severity: true,
      title: true,
      detail: true,
      score: true,
      property: { select: { name: true } },
    },
  });

  const recommendations = rows.map((r) => ({
    id: r.id,
    category: r.category,
    severity: r.severity,
    title: r.title,
    detail: r.detail,
    score: r.score,
    propertyName: r.property?.name ?? null,
  }));

  const initialCounts = bucketCountsForRecommendations(recommendations);
  const initialTotal = recommendations.length;

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="SEO Agent"
        title="Opportunities"
        description="Every recommendation the SEO Agent has surfaced for your portfolio. Filter by category, search by keyword, mark each one Done or Decline as you work through them."
        meta={`${initialTotal} open`}
      />

      <Suspense fallback={null}>
        <OpportunitiesClient
          recommendations={recommendations}
          initialCounts={initialCounts}
          initialTotal={initialTotal}
        />
      </Suspense>
    </div>
  );
}
