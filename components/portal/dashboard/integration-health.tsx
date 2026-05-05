import * as React from "react";
import Link from "next/link";
import { Plug } from "lucide-react";
import { cn } from "@/lib/utils";

export type IntegrationStatus = "connected" | "degraded" | "error" | "off";

export type IntegrationChip = {
  key: string;
  label: string;
  status: IntegrationStatus;
  href?: string;
  glyph?: string;
};

const DOT: Record<IntegrationStatus, string> = {
  connected: "bg-primary",
  degraded: "bg-amber-500",
  error: "bg-destructive",
  off: "bg-muted-foreground/30",
};

const CONNECT_HREF = "/portal/settings/integrations";

export function IntegrationHealth({ chips }: { chips: IntegrationChip[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        const dot = (
          <span
            className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT[c.status])}
            aria-hidden="true"
          />
        );

        if (c.status === "connected" || c.status === "degraded") {
          return (
            <span
              key={c.key}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {dot}
              {c.label}
            </span>
          );
        }

        const actionLabel = c.status === "error" ? "Fix →" : "Connect →";

        return (
          <span
            key={c.key}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground"
          >
            {dot}
            {c.label}
            <Link
              href={c.href ?? CONNECT_HREF}
              className="font-semibold text-primary hover:underline"
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
