import * as React from "react";
import Link from "next/link";
import { Plug } from "lucide-react";
import { StatusChip, type ConnectionStatus } from "@/components/portal/ui/status-chip";

export type IntegrationStatus = "connected" | "degraded" | "error" | "off";

export type IntegrationChip = {
  key: string;
  label: string;
  status: IntegrationStatus;
  href?: string;
  glyph?: string;
};

// Maps this widget's local status vocabulary onto the canonical
// StatusChip vocabulary so this surface can't drift from the rest of
// the product's "what does connected look like?" answer.
const STATUS_MAP: Record<IntegrationStatus, ConnectionStatus> = {
  connected: "live",
  degraded: "stale",
  error: "error",
  off: "not_connected",
};

// One spine: connect CTAs route through the canonical hub at /portal/connect
// (which deep-links to each provider's credential form itself).
const CONNECT_HREF = "/portal/connect";

export function IntegrationHealth({ chips }: { chips: IntegrationChip[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        if (c.status === "connected" || c.status === "degraded") {
          return (
            <StatusChip key={c.key} status={STATUS_MAP[c.status]} label={c.label} />
          );
        }

        const actionLabel = c.status === "error" ? "Fix →" : "Connect →";

        return (
          <span key={c.key} className="inline-flex items-center gap-1.5">
            <StatusChip status={STATUS_MAP[c.status]} label={c.label} />
            <Link
              href={c.href ?? CONNECT_HREF}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {actionLabel}
            </Link>
          </span>
        );
      })}
    </div>
  );
}

export function IntegrationHealthEmpty() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Plug className="h-3.5 w-3.5" aria-hidden="true" />
      No integrations configured yet.
    </div>
  );
}
