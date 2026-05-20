import type { Metadata } from "next";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { BuildingEvaluator } from "@/components/portal/tools/building-evaluator";

export const metadata: Metadata = {
  title: "Building evaluator",
  description: "Evaluate any property before you buy it. Live market rent, value AVM, and comparable inventory.",
};

// ---------------------------------------------------------------------------
// /portal/tools/value — Building Evaluator. Replaces the parked Zillow
// report with a RentCast-powered acquisitions surface: paste an address,
// optionally an asking price, get cap rate / cash-on-cash / comps in
// one card. Premium-feel design language; matches popup-editor.
//
// Each evaluation costs 3 RentCast credits (value + rent + market) at
// the snapshot layer. Repeat lookups for the same address-shape inside
// the TTL window (60d / 30d / 14d) reuse cached payloads at zero cost.
// ---------------------------------------------------------------------------
export default async function BuildingEvaluatorPage() {
  const scope = await requireScope();

  // Recent evaluations strip below the form. Hard-capped at 20 so the
  // page render stays snappy even for power users — the recent list is
  // a navigation aid, not a search surface.
  const recent = await prisma.propertyEvaluation.findMany({
    where: { orgId: scope.orgId, archived: false },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      addressDisplay: true,
      askingPriceCents: true,
      bedrooms: true,
      bathrooms: true,
      createdAt: true,
      calculations: true,
    },
  });

  return (
    <div className="space-y-6 ls-page-fade">
      <PageHeader
        title="Building evaluator"
        description="Evaluate any property before you buy it. Pulls live market rent, property value, and comparable inventory — powered by RentCast Intelligence."
      />
      <BuildingEvaluator
        recent={recent.map((r) => ({
          id: r.id,
          addressDisplay: r.addressDisplay,
          askingPriceCents: r.askingPriceCents,
          bedrooms: r.bedrooms,
          bathrooms: r.bathrooms,
          createdAt: r.createdAt.toISOString(),
          calculations: r.calculations as unknown,
        }))}
      />
    </div>
  );
}
