import { unstable_cache } from "next/cache";
import { generateReportSnapshot } from "@/lib/reports/generate";
import { PropertyOnePager } from "@/components/portal/reports/property-one-pager";
import type { PropertyMeta } from "@/components/portal/reports/snapshot-shared";

// ---------------------------------------------------------------------------
// Live preview body for /portal/reports — the async half of the preview
// panel, meant to sit inside a <Suspense> boundary so the reports list
// paints instantly while this streams in. skipAi:true keeps a per-page-load
// snapshot from also costing an LLM call (see GenerateReportOptions).
//
// Cached 5 min per org+kind+property: the generator runs ~100 read queries,
// which is fine for the deliberately-visited per-property snapshot page but
// not for every reports-list load. ReportSnapshot is JSON-safe by design
// (it freezes into ClientReport.snapshot), so the data-cache round-trip is
// lossless. Same unstable_cache pattern as lib/seo/dataforseo.ts.
// ---------------------------------------------------------------------------

const getCachedPreviewSnapshot = unstable_cache(
  (orgId: string, kind: "weekly" | "monthly", propertyId: string) =>
    generateReportSnapshot(orgId, kind, { propertyId, skipAi: true }),
  ["live-report-preview"],
  { revalidate: 300 },
);

export function PreviewSkeleton() {
  return (
    <div className="min-h-[400px] space-y-4 p-6">
      <div className="h-6 w-2/3 animate-pulse rounded-[2px] bg-muted" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-[2px] bg-muted" />
        ))}
      </div>
      <div className="h-28 animate-pulse rounded-[2px] bg-muted" />
      <div className="h-28 animate-pulse rounded-[2px] bg-muted" />
    </div>
  );
}

export async function LivePreviewBody({
  orgId,
  kind,
  propertyId,
  property,
}: {
  orgId: string;
  kind: "weekly" | "monthly";
  propertyId: string;
  property: PropertyMeta;
}) {
  // A generator hiccup must degrade to a quiet line, not bubble to the
  // route error boundary and replace the whole reports list.
  let snapshot: Awaited<ReturnType<typeof generateReportSnapshot>>;
  try {
    snapshot = await getCachedPreviewSnapshot(orgId, kind, propertyId);
  } catch (err) {
    console.error("[LivePreviewBody] snapshot failed:", propertyId, err);
    return (
      <p className="p-6 text-[11px] text-muted-foreground">
        Preview unavailable right now — the report history below still works.
      </p>
    );
  }
  return (
    <div className="max-h-[calc(78vh-11rem)] overflow-y-auto rounded-[2px] border border-border">
      <PropertyOnePager snapshot={snapshot} property={property} />
    </div>
  );
}
