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
  connected: "bg-emerald-500",
  degraded: "bg-amber-500",
  error: "bg-rose-500",
  off: "bg-muted-foreground/30",
};

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Connected",
  degraded: "Degraded",
  error: "Action needed",
  off: "Not connected",
};

export function IntegrationHealth({ chips }: { chips: IntegrationChip[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => {
        const inner = (
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs",
              "transition-colors hover:border-primary/30 hover:bg-muted/30",
            )}
            title={`${c.label} · ${STATUS_LABEL[c.status]}`}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT[c.status])}
              aria-hidden="true"
            />
            <span className="font-medium text-foreground">{c.label}</span>
            {c.glyph ? (
              <span className="font-mono text-[10px] text-muted-foreground uppercase">
                {c.glyph}
              </span>
            ) : null}
          </div>
        );
        return c.href ? (
          <Link
            key={c.key}
            href={c.href}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-md"
          >
            {inner}
          </Link>
        ) : (
          <span key={c.key}>{inner}</span>
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
