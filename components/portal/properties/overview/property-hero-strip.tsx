import { Building2 } from "lucide-react";
import {
  type CommercialSubtype,
  type PropertyType,
  type ResidentialSubtype,
} from "@prisma/client";
import { formatAge } from "./helpers";

// ---------------------------------------------------------------------------
// PropertyHeroStrip — simplified. Photo + name + a single horizontal fact
// row. No ring, no briefing, no quick-actions rail.
// ---------------------------------------------------------------------------

export function PropertyHeroStrip({
  name,
  totalUnits,
  leasedUnits,
  occupancyPct,
  monthlyRentRollDisplay,
  heroImageUrl,
  propertyType,
  propertySubtype,
  yearBuilt,
  lastSyncedAt,
}: {
  name: string;
  totalUnits: number | null;
  leasedUnits: number | null;
  occupancyPct: number | null;
  monthlyRentRollDisplay: string;
  heroImageUrl: string | null;
  propertyType: PropertyType;
  propertySubtype: ResidentialSubtype | CommercialSubtype | null;
  yearBuilt: number | null;
  lastSyncedAt: Date | null;
}) {
  const subtypeLabel =
    typeof propertySubtype === "string"
      ? propertySubtype.replace(/_/g, " ").toLowerCase()
      : null;
  const typeLine =
    subtypeLabel ??
    (propertyType ? propertyType.replace(/_/g, " ").toLowerCase() : null);

  const facts: string[] = [];
  if (totalUnits != null) {
    facts.push(`${totalUnits} units`);
  }
  if (occupancyPct != null) {
    facts.push(`${occupancyPct}% occupied`);
  } else if (totalUnits != null && leasedUnits != null) {
    facts.push(`${leasedUnits} of ${totalUnits} leased`);
  }
  if (monthlyRentRollDisplay !== "—") {
    facts.push(`${monthlyRentRollDisplay}/mo rent roll`);
  }
  if (yearBuilt) {
    facts.push(`built ${yearBuilt}`);
  }
  if (lastSyncedAt) {
    facts.push(`synced ${formatAge(lastSyncedAt)}`);
  }
  // Build a Pacific-time hover label for the whole fact row when we
  // have a sync timestamp — operators are PT-based so they expect the
  // absolute time to land in their local zone, not UTC. Issue #58.
  const syncedTitle = lastSyncedAt
    ? `Last synced ${formatPacific(lastSyncedAt)}`
    : undefined;

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-4 p-4 md:p-5">
        {heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImageUrl}
            alt={name}
            className="h-20 w-20 rounded-lg object-cover border border-border shrink-0"
          />
        ) : (
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0 border border-border">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="text-lg md:text-xl font-semibold text-foreground tracking-tight truncate">
            {name}
          </h2>
          {typeLine ? (
            <p className="mt-0.5 text-[11px] uppercase tracking-widest font-semibold text-muted-foreground first-letter:capitalize">
              {typeLine}
            </p>
          ) : null}
          {facts.length > 0 ? (
            <p
              className="mt-1.5 text-[12.5px] text-muted-foreground tabular-nums leading-snug"
              title={syncedTitle}
            >
              {facts.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// Norman feedback (issue #58): the "Last synced" relative-time labels
// were timezone-agnostic ("5h ago") but when operators hovered or
// inspected the value they got UTC or browser-local time. SG operates
// out of US Pacific, so this helper formats an absolute date string in
// Pacific time and returns it for use in title= tooltips alongside the
// relative-time label.
function formatPacific(date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      dateStyle: "medium",
      timeStyle: "short",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
