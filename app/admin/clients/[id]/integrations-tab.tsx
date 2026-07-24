import { SectionCard } from "@/components/admin/page-header";
import { SyncHealthTable } from "./sync-health-table";
import { CursivePanel } from "./cursive-panel";
import type { DataSinkSummary } from "@/lib/admin/data-sinks";

// ---------------------------------------------------------------------------
// IntegrationsTab — "Data connections" (renamed from "Data sinks") consol-
// idated into one table, plus the Cursive (visitor identification) panel.
// Cursive's webhook URLs / pixel IDs are the only piece of this page that
// still needs raw secrets on screen, so they're tucked behind a collapsed
// <details> "Connection details" section — the Copy buttons still work
// exactly as before, just not open by default.
// ---------------------------------------------------------------------------

type CursiveInitial = {
  cursivePixelId: string | null;
  cursiveSegmentId: string | null;
  installedOnDomain: string | null;
  lastEventAt: string | null;
  lastSegmentSyncAt: string | null;
  totalEventsCount: number;
  lastPixelHitAt: string | null;
  totalPixelHitsCount: number;
  identifiedVisitorCount: number;
};

export function IntegrationsTab({
  orgId,
  tenantDataSinks,
  sharedWebhookUrl,
  tenantWebhookUrl,
  cursiveInitial,
}: {
  orgId: string;
  tenantDataSinks: DataSinkSummary[];
  sharedWebhookUrl: string;
  tenantWebhookUrl: string | null;
  cursiveInitial: CursiveInitial;
}) {
  return (
    <div className="space-y-6">
      <SectionCard
        label="Data connections"
        description="Freshness, error streaks, and 24h throughput for every sync scoped to this client."
      >
        <SyncHealthTable sinks={tenantDataSinks} orgId={orgId} />
      </SectionCard>

      <SectionCard
        label="Cursive (visitor identification)"
        description="Bind the V4 pixel and segment IDs from Cursive so visits on the tenant site resolve to named leads."
      >
        <details className="group">
          <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline underline-offset-2">
            <span
              aria-hidden="true"
              className="inline-block transition-transform group-open:rotate-90"
            >
              ›
            </span>
            Connection details
          </summary>
          <div className="mt-4">
            <CursivePanel
              orgId={orgId}
              webhookUrl={sharedWebhookUrl}
              tenantWebhookUrl={tenantWebhookUrl}
              initial={cursiveInitial}
            />
          </div>
        </details>
      </SectionCard>
    </div>
  );
}
