import Link from "next/link";
import { SectionCard } from "@/components/admin/page-header";
import {
  StatusChip,
  type ConnectionStatus,
} from "@/components/portal/ui/status-chip";
import type { ClientActivationRow } from "@/lib/admin/client-activation";
import type { CapabilityProfileStatus } from "@/lib/products/capabilities/types";

const STATUS_PRESENTATION: Record<
  CapabilityProfileStatus,
  { status: ConnectionStatus; label: string }
> = {
  disconnected: { status: "not_connected", label: "Disconnected" },
  verifying: { status: "connecting", label: "Verifying" },
  backfilling: { status: "provisioning", label: "Backfilling" },
  ready: { status: "live", label: "Ready" },
  partially_ready: { status: "stale", label: "Partially ready" },
  needs_attention: { status: "error", label: "Needs attention" },
};

const ACCESS_LABEL: Record<ClientActivationRow["access"], string> = {
  included: "Included",
  enabled: "Enabled",
  not_enabled: "Not enabled",
  concierge: "Concierge",
};

export function ActivationTable({ rows }: { rows: readonly ClientActivationRow[] }) {
  const readyCount = rows.filter(({ status }) => status === "ready").length;
  const attentionCount = rows.filter(
    ({ status }) => status === "needs_attention",
  ).length;

  return (
    <SectionCard
      label="Product activation"
      description="Access enables a product. Readiness requires correctly scoped operational proof."
      action={
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {readyCount} ready
          {attentionCount > 0 ? ` · ${attentionCount} need attention` : ""}
        </p>
      }
    >
      <div className="-mx-5 -mb-5 overflow-hidden border-t border-[var(--hair)]">
        <table className="w-full ls-table lg:table-fixed">
          <caption className="sr-only">Product activation readiness</caption>
          <colgroup className="hidden lg:table-column-group">
            <col className="w-[22%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[27%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="hidden lg:table-header-group">
            <tr>
              <th>Product</th>
              <th>Access</th>
              <th>Activation state</th>
              <th>Property coverage</th>
              <th>Proof</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody className="block lg:table-row-group">
            {rows.map((row) => (
              <ActivationRow key={row.key} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function ActivationRow({ row }: { row: ClientActivationRow }) {
  const presentation = STATUS_PRESENTATION[row.status];

  return (
    <tr className="block border-b border-[var(--hair)] lg:table-row lg:border-0">
      <td className="block min-w-0 !border-b-0 !px-5 !pb-2 !pt-4 lg:table-cell lg:!border-b lg:!px-4 lg:!py-3">
        <MobileLabel>Product</MobileLabel>
        <p className="font-semibold text-foreground leading-snug">{row.name}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {row.promise}
        </p>
      </td>

      <ResponsiveCell label="Access">
        <span className="text-[12px] font-medium text-foreground">
          {ACCESS_LABEL[row.access]}
        </span>
      </ResponsiveCell>

      <ResponsiveCell label="Activation state">
        <StatusChip status={presentation.status} label={presentation.label} />
      </ResponsiveCell>

      <ResponsiveCell label="Property coverage">
        <span className="text-[12px] tabular-nums text-foreground">
          {row.coverage.label}
        </span>
      </ResponsiveCell>

      <ResponsiveCell label="Proof">
        <p className="text-[12px] leading-snug text-foreground">{row.proof}</p>
        {row.blockers.length > 0 ? (
          <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-muted-foreground">
            {row.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : null}
      </ResponsiveCell>

      <ResponsiveCell label="Next action" last>
        <Link
          href={row.action.href}
          className="inline-flex min-h-9 items-center text-[12px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {row.action.label}
        </Link>
      </ResponsiveCell>
    </tr>
  );
}

function ResponsiveCell({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <td
      className={`block min-w-0 !border-b-0 !px-5 !py-2 lg:table-cell lg:!border-b lg:!px-4 lg:!py-3 ${last ? "!pb-4 lg:!pb-3" : ""}`}
    >
      <MobileLabel>{label}</MobileLabel>
      {children}
    </td>
  );
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return <div className="ls-eyebrow mb-1.5 lg:hidden">{children}</div>;
}
