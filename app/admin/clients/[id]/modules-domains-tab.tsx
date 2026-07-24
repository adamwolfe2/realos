import { SectionCard } from "@/components/admin/page-header";
import { ModuleToggle } from "./module-toggle";
import { RentCastUsageRow } from "./rentcast-usage-row";
import { DomainsPanel } from "./domains-panel";
import type { ToggleableModule } from "@/lib/actions/admin-modules";

type Binding = {
  id: string;
  hostname: string;
  isPrimary: boolean;
  sslStatus: string | null;
  dnsConfigured: boolean;
};

export function ModulesDomainsTab({
  orgId,
  moduleRows,
  rentCastUsage,
  fallbackSlug,
  domains,
}: {
  orgId: string;
  moduleRows: Array<[ToggleableModule, string, boolean]>;
  rentCastUsage: { used: number; budget: number; monthKey: string } | null;
  fallbackSlug: string;
  domains: Binding[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <SectionCard
        label="Modules"
        description="Toggles save instantly and are mirrored to the audit log."
      >
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
          {moduleRows.map(([key, label, enabled]) => (
            <ModuleToggle
              key={key}
              orgId={orgId}
              module={key}
              label={label}
              initialEnabled={enabled}
            />
          ))}
        </ul>
        {rentCastUsage ? (
          <div className="mt-4 pt-3 border-t border-[var(--hair)]">
            <RentCastUsageRow
              orgId={orgId}
              used={rentCastUsage.used}
              initialBudget={rentCastUsage.budget}
              monthKey={rentCastUsage.monthKey}
            />
          </div>
        ) : null}
      </SectionCard>

      <SectionCard label="Domains">
        <DomainsPanel orgId={orgId} fallbackSlug={fallbackSlug} initial={domains} />
      </SectionCard>
    </div>
  );
}
