import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import {
  getPropertyOccupancy,
  centsToUsdShort,
} from "@/lib/properties/queries";
import { AddListingForm } from "../listings-manager";
import { ListingsTable } from "@/components/portal/occupancy/listings-table";

export async function OccupancyTab({
  orgId,
  propertyId,
}: {
  orgId: string;
  propertyId: string;
}) {
  const data = await getPropertyOccupancy(orgId, propertyId);

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm font-semibold text-foreground">
            Occupancy not tracked
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Set a total unit count on this property (or sync listings from
            AppFolio) to see occupancy here. You can also add listings
            manually below to bootstrap the chatbot.
          </p>
        </div>
        <DashboardSection title="Listings" eyebrow="Manual entry">
          <AddListingForm propertyId={propertyId} />
        </DashboardSection>
      </div>
    );
  }

  // Bug #45 — listings total can exceed total units when AppFolio
  // returns one row per unit-bed-bath SKU (e.g. seasonal Spring/Fall
  // variants of the same physical unit). We disclose the relationship
  // inline so "141 listings vs 100 units" doesn't read as data
  // corruption.
  const totalListings = data.listings.length;
  const listingsExceedUnits = totalListings > data.totalUnits;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Occupancy"
          value={`${data.occupancyPct}%`}
          hint={`${data.totalUnits - data.availableUnits} of ${data.totalUnits} leased`}
        />
        <KpiTile
          label="Available"
          value={data.availableUnits}
          hint={
            listingsExceedUnits
              ? `Across ${totalListings} listings`
              : undefined
          }
        />
        <KpiTile label="Total units" value={data.totalUnits} />
        <KpiTile
          label="Active applications"
          value={data.activeApplications}
          hint="Submitted or under review"
        />
      </section>

      {/* Bug #45 — disclose that listings ≠ physical units when the
          AppFolio sync emits more SKUs than units (very common in
          student housing with per-room rentals and Spring/Fall
          configurations). Hides automatically when the counts agree. */}
      {listingsExceedUnits ? (
        <p className="text-[11px] text-muted-foreground bg-muted/30 border border-border rounded-md px-3 py-2 leading-snug">
          <span className="font-semibold text-foreground">
            {totalListings} listings
          </span>{" "}
          across{" "}
          <span className="font-semibold text-foreground">
            {data.totalUnits} physical units.
          </span>{" "}
          AppFolio returns one row per unit configuration — student-housing
          properties commonly expose per-bed and per-season SKUs (e.g.,
          Spring/Fall variants of the same room), which is why listings
          can exceed the unit count.
        </p>
      ) : null}

      {data.byBedType.length > 0 ? (
        <DashboardSection
          title="Listings by bedroom"
          eyebrow="Unit configuration"
          description={
            listingsExceedUnits
              ? `Distribution across all ${totalListings} listing SKUs (one row per AppFolio unit configuration; ${data.totalUnits} physical units total). The percentage shows the share marked available.`
              : "Distribution of unit-type rows from AppFolio. The percentage shows the share marked available right now — useful for spotting which bed type has the most open inventory."
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.byBedType.map((b) => {
              const availPct =
                b.total > 0 ? Math.round((b.available / b.total) * 100) : 0;
              return (
                <div
                  key={b.label}
                  className="rounded-xl border border-border bg-card p-3 space-y-2"
                >
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                    {b.label}
                  </div>
                  <div className="text-2xl leading-none font-semibold tabular-nums text-foreground">
                    {availPct}%
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <div>
                      {b.available} available · {b.total} total
                    </div>
                    {b.activeApplications > 0 ? (
                      <div className="text-primary font-medium">
                        {b.activeApplications} active{" "}
                        {b.activeApplications === 1
                          ? "application"
                          : "applications"}
                      </div>
                    ) : null}
                    {b.priceMinCents || b.priceMaxCents ? (
                      <div>
                        {centsToUsdShort(b.priceMinCents)}
                        {b.priceMinCents !== b.priceMaxCents
                          ? `–${centsToUsdShort(b.priceMaxCents)}`
                          : ""}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardSection>
      ) : null}

      <DashboardSection title="Listings" eyebrow="Per unit">
        <div className="space-y-4">
          {/* Bug #46-#50 — replaced the inline server-rendered table
              with a client component that supports sort, filter,
              column visibility, hover tooltips, and an explicit
              confirmation modal for destructive actions. */}
          <ListingsTable listings={data.listings} />
          <AddListingForm propertyId={propertyId} />
        </div>
      </DashboardSection>
    </div>
  );
}
