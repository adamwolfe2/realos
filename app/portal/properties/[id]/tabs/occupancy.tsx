import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import {
  getPropertyOccupancy,
  centsToUsdShort,
} from "@/lib/properties/queries";
import {
  AddListingForm,
  ListingRowActions,
} from "../listings-manager";

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

  const priceRange =
    data.priceMinCents || data.priceMaxCents
      ? `${centsToUsdShort(data.priceMinCents)}${"–"}${centsToUsdShort(data.priceMaxCents)}`
      : "—";

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Occupancy"
          value={`${data.occupancyPct}%`}
          hint={`${data.totalUnits - data.availableUnits} of ${data.totalUnits} leased`}
        />
        <KpiTile label="Available" value={data.availableUnits} />
        <KpiTile label="Total units" value={data.totalUnits} />
        <KpiTile
          label="Active applications"
          value={data.activeApplications}
          hint="Submitted or under review"
        />
      </section>

      {data.byBedType.length > 0 ? (
        <DashboardSection title="Lease-up by bedroom" eyebrow="Bed type">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.byBedType.map((b) => (
              <div
                key={b.label}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                  {b.label}
                </div>
                <div className="text-[26px] leading-none font-semibold tabular-nums text-foreground">
                  {b.occupancyPct}%
                </div>
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <div>{b.leased} leased · {b.available} available</div>
                  {b.activeApplications > 0 ? (
                    <div className="text-primary font-medium">
                      {b.activeApplications} active {b.activeApplications === 1 ? "application" : "applications"}
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
            ))}
          </div>
        </DashboardSection>
      ) : null}

      <DashboardSection title="Listings" eyebrow="Per unit">
        <div className="space-y-4">
          {data.listings.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No listings yet. Add one below — the chatbot reads from this
              list to surface live availability and pricing.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm">
                <thead className="text-[10px] tracking-widest uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold pb-2">Unit</th>
                    <th className="text-left font-semibold pb-2">Type</th>
                    <th className="text-right font-semibold pb-2">Beds</th>
                    <th className="text-right font-semibold pb-2">Baths</th>
                    <th className="text-right font-semibold pb-2">Price</th>
                    <th className="text-center font-semibold pb-2">Status</th>
                    <th className="text-right font-semibold pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.listings.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 text-xs text-foreground">
                        {l.unitNumber ?? "—"}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {l.unitType ?? "—"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-xs">
                        {l.bedrooms ?? "—"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-xs">
                        {l.bathrooms ?? "—"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-xs">
                        {centsToUsdShort(l.priceCents)}
                      </td>
                      <td className="py-2.5 text-center">
                        {l.isAvailable ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-700">
                            Available
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-muted text-muted-foreground">
                            Leased
                          </span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <ListingRowActions
                          listingId={l.id}
                          isAvailable={l.isAvailable}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AddListingForm propertyId={propertyId} />
        </div>
      </DashboardSection>
    </div>
  );
}
