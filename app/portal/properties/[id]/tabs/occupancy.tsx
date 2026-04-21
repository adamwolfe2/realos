import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import {
  getPropertyOccupancy,
  centsToUsdShort,
} from "@/lib/properties/queries";

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
      <div className="rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] p-6">
        <p className="text-sm font-semibold text-[var(--near-black)]">
          Occupancy not tracked
        </p>
        <p className="mt-1 text-xs text-[var(--stone-gray)]">
          Set a total unit count on this property (or sync listings from
          AppFolio) to see occupancy here.
        </p>
      </div>
    );
  }

  const priceRange =
    data.priceMinCents || data.priceMaxCents
      ? `${centsToUsdShort(data.priceMinCents)}${"\u2013"}${centsToUsdShort(data.priceMaxCents)}`
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
        <KpiTile label="Price range" value={priceRange} hint="Across listings" />
      </section>

      <DashboardSection title="Listings" eyebrow="Per unit">
        {data.listings.length === 0 ? (
          <p className="text-xs text-[var(--stone-gray)]">
            No listings synced yet.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead className="text-[10px] tracking-widest uppercase text-[var(--stone-gray)]">
                <tr>
                  <th className="text-left font-semibold pb-2">Unit</th>
                  <th className="text-left font-semibold pb-2">Type</th>
                  <th className="text-right font-semibold pb-2">Beds</th>
                  <th className="text-right font-semibold pb-2">Baths</th>
                  <th className="text-right font-semibold pb-2">Price</th>
                  <th className="text-center font-semibold pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-cream)]">
                {data.listings.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 text-xs text-[var(--near-black)]">
                      {l.unitNumber ?? "—"}
                    </td>
                    <td className="py-2.5 text-xs text-[var(--olive-gray)]">
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
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-[var(--warm-sand)] text-[var(--olive-gray)]">
                          Leased
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
