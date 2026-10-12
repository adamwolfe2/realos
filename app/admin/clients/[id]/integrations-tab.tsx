import { SectionCard } from "@/components/admin/page-header";
import { SyncHealthTable } from "./sync-health-table";
import type { DataSinkSummary } from "@/lib/admin/data-sinks";

// IntegrationsTab — "Data connections": every sync scoped to this client in
// one table.
export function IntegrationsTab({
  orgId,
  tenantDataSinks,
}: {
  orgId: string;
  tenantDataSinks: DataSinkSummary[];
}) {
  return (
    <div className="space-y-6">
      <SectionCard
        label="Data connections"
        description="Freshness, error streaks, and 24h throughput for every sync scoped to this client."
      >
        <SyncHealthTable sinks={tenantDataSinks} orgId={orgId} />
      </SectionCard>
    </div>
  );
}
