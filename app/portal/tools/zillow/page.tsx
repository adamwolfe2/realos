import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, Construction } from "lucide-react";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Zillow report (parked)" };

// ---------------------------------------------------------------------------
// /portal/tools/zillow — PARKED 2026-05-19
//
// Zillow's PerimeterX bot detection blocks every fetch from Vercel's
// datacenter IP ranges. The rate-limit fix landed (config endpoint
// returns 200) but the scrape itself returns BLOCKED. We hid the nav
// entry and replaced this page with a placeholder until we pick a data
// source: ScrapingBee proxy ($49/mo, drop-in), RentCast API (purpose-
// built for investor analysis), or a different tool shape entirely.
//
// The scrape + calculations code in lib/zillow/* + the saved-reports
// list + the client components are all intentionally left in place so
// the wire-up is one PR away once a data source is chosen. The DB
// table (ZillowReport) and the API route stay untouched; only the
// presentation surface is parked.
// ---------------------------------------------------------------------------
export default async function ZillowToolPage() {
  // requireScope still runs so unauthenticated visitors get redirected
  // to sign-in like any other portal page — keeping the auth posture
  // identical to the live version once we re-enable.
  await requireScope();

  return (
    <div className="space-y-4 ls-page-fade">
      <PageHeader
        title="Zillow report"
        description="A quick-look investor analysis tool. Currently parked while we pick a data source."
      />

      <SectionCard label="Coming back online" padded={false}>
        <div className="flex flex-col items-start gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <Construction className="h-6 w-6 text-amber-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Tool temporarily parked
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              We&rsquo;re reworking the data source behind this tool. Zillow
              actively blocks server-side requests, so we&rsquo;re picking
              between a proxy service and a purpose-built investor-analysis
              API. Expect this back online next week with cleaner data and
              comparable rent estimates.
            </p>
          </div>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Calculator className="mr-1.5 inline h-3.5 w-3.5" />
            In the meantime, run quick numbers manually: cap rate ={" "}
            <span className="font-mono">NOI / price</span>, cash-on-cash ={" "}
            <span className="font-mono">annual cash flow / cash invested</span>
            .
          </div>

          <Link
            href="/portal"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to dashboard &rarr;
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
