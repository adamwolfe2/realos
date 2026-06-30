import { Building2 } from "lucide-react";
import { formatAge } from "./helpers";

// Compact "Property in onboarding" card. Renders in place of the dense
// dashboard layout for AppFolio-imported rows that haven't been activated.
export function OnboardingShellCard({
  propertyId,
  propertyName,
  totalUnits,
  appfolioConnected,
  lastSyncedAt,
}: {
  propertyId: string;
  propertyName: string;
  totalUnits: number | null;
  appfolioConnected: boolean;
  lastSyncedAt: Date | null;
}) {
  const syncedLabel = lastSyncedAt
    ? `Last synced ${formatAge(lastSyncedAt)}`
    : "Not synced yet";
  return (
    <section className="rounded-xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Property in onboarding
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            {propertyName}
          </h2>
          <p className="mt-1 text-[12px] text-muted-foreground leading-snug max-w-[44ch]">
            Imported from AppFolio and waiting on activation.
            {totalUnits != null
              ? ` ${totalUnits} unit${totalUnits === 1 ? "" : "s"}.`
              : ""}{" "}
            {syncedLabel}.
          </p>
          <p className="mt-3 text-[11.5px] text-muted-foreground leading-snug max-w-[52ch]">
            Activate this property to start tracking leads, tours,
            applications, and ad attribution. The full dashboard fills
            in automatically once the first listing or lead lands.
          </p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <a
              href={`/portal/properties/${propertyId}?tab=onboarding`}
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-[12px] font-semibold hover:bg-primary-dark transition-colors"
            >
              Activate this property
            </a>
            {!appfolioConnected ? (
              <a
                href="/portal/connect"
                className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                Connect AppFolio
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
