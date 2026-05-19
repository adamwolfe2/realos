import type { Metadata } from "next";
import Link from "next/link";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { ZillowToolClient } from "@/components/portal/tools/zillow-tool-client";
import type { ZillowListing } from "@/lib/zillow/scrape";
import type { CalculationOutputs } from "@/lib/zillow/calculations";

export const metadata: Metadata = { title: "Zillow report" };
export const dynamic = "force-dynamic";

type Search = { report?: string };

// ---------------------------------------------------------------------------
// /portal/tools/zillow
//
// Paste a Zillow listing URL → server-side scrape → render a one-page
// report with parsed facts + investor math. The form + report renderer
// live in client components; this server page does the tenant-scoped
// data load (list of recent saved reports + optional preloaded report
// by ?report=<id>).
// ---------------------------------------------------------------------------
export default async function ZillowToolPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;

  const recent = await prisma.zillowReport.findMany({
    where: { orgId: scope.orgId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      zillowUrl: true,
      zpid: true,
      createdAt: true,
      payload: true,
    },
  });

  // Optional pre-loaded report — clicking a row in the saved list
  // re-renders the report from the stored payload (no re-fetch).
  let initialReport: {
    id: string;
    listing: ZillowListing;
    calculations: CalculationOutputs;
  } | null = null;
  if (sp.report) {
    const row = await prisma.zillowReport.findFirst({
      where: { id: sp.report, orgId: scope.orgId },
      select: { id: true, payload: true, calculations: true },
    });
    if (row) {
      initialReport = {
        id: row.id,
        listing: row.payload as unknown as ZillowListing,
        calculations: row.calculations as unknown as CalculationOutputs,
      };
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tools"
        title="Zillow report"
        description="Paste a Zillow listing URL and we'll pull the headline facts plus quick investor math — cash down at 20/25/30%, monthly P&I, cap rate, and cash-on-cash."
      />

      {recent.length > 0 && (
        <SectionCard
          label="Saved reports"
          description="Click a row to revisit the report without re-fetching Zillow."
        >
          <ul className="divide-y divide-[var(--hair)]">
            {recent.map((r) => {
              const p = r.payload as unknown as Partial<ZillowListing>;
              return (
                <li key={r.id}>
                  <Link
                    href={`/portal/tools/zillow?report=${r.id}`}
                    className="flex items-center justify-between py-2.5 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium truncate">
                        {p.address ?? "Unknown address"}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground tabular-nums">
                        zpid {r.zpid} ·{" "}
                        {new Date(r.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <div className="text-[13px] tabular-nums text-foreground shrink-0 pl-3">
                      {p.listPrice
                        ? new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(p.listPrice)
                        : "—"}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      <ZillowToolClient initialReport={initialReport} />
    </div>
  );
}
