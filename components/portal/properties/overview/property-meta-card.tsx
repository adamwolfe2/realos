import {
  type BackendPlatform,
  type CommercialSubtype,
  type PropertyType,
  type ResidentialSubtype,
} from "@prisma/client";
import { Card } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Sidebar — property meta card.
// ---------------------------------------------------------------------------

export function PropertyMetaCard({
  propertyType,
  residentialSubtype,
  commercialSubtype,
  totalUnits,
  yearBuilt,
  backendPlatform,
  backendPropertyGroup,
  lastSyncedAt,
}: {
  propertyType: PropertyType;
  residentialSubtype: ResidentialSubtype | null;
  commercialSubtype: CommercialSubtype | null;
  totalUnits: number | null;
  yearBuilt: number | null;
  backendPlatform: BackendPlatform;
  backendPropertyGroup: string | null;
  lastSyncedAt: Date | null;
}) {
  const subtype = residentialSubtype ?? commercialSubtype ?? null;
  const rows: Array<[string, string]> = [];
  if (propertyType) {
    rows.push(["Type", propertyType.replace(/_/g, " ").toLowerCase()]);
  }
  if (subtype) {
    rows.push(["Subtype", subtype.replace(/_/g, " ").toLowerCase()]);
  }
  if (totalUnits != null) {
    rows.push(["Units", totalUnits.toLocaleString()]);
  }
  if (yearBuilt != null) {
    rows.push(["Built", yearBuilt.toString()]);
  }
  if (backendPlatform && backendPlatform !== "NONE") {
    // Norman 2026-06-04: "Backend" reads as engineering. Operators speak
    // PMS (property management system). Same field, friendlier label.
    rows.push(["PMS", backendPlatform]);
  }
  if (backendPropertyGroup) {
    // Norman 2026-06-04: "Group" alone is ambiguous. Make it explicit
    // this is the property group inside the PMS (the operator's own
    // grouping, not a LeaseStack concept).
    rows.push(["Property group", backendPropertyGroup]);
  }
  // Norman 2026-06-04: dropped the "Synced" row — last-sync timestamp
  // is already shown inside the Integrations card right above this one,
  // so repeating it here was visual duplication. `lastSyncedAt` is still
  // accepted on the props interface in case callers want it back later.
  void lastSyncedAt;

  if (rows.length === 0) return null;

  return (
    <Card className="p-4 md:p-5 gap-0 shadow-none">
      <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
        Property
      </p>
      <dl className="mt-2 space-y-1.5 text-[12px]">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex items-baseline justify-between gap-3 min-w-0"
          >
            <dt className="text-muted-foreground shrink-0">{k}</dt>
            <dd className="text-right text-foreground truncate first-letter:capitalize">
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
