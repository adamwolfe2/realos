import * as React from "react";
import Link from "next/link";
import { Plus, Calendar } from "lucide-react";

export function DashboardHeader({
  workspaceName,
  workspaceLogoUrl,
  primaryColor,
  rangeLabel = "Last 28 days",
}: {
  workspaceName: string;
  workspaceLogoUrl?: string | null;
  primaryColor?: string | null;
  rangeLabel?: string;
}) {
  const accent = primaryColor && primaryColor !== "#000000" ? primaryColor : null;
  const initial = workspaceName.slice(0, 1).toUpperCase();

  return (
    <header className="rounded-lg border border-border bg-card overflow-hidden">
      {accent ? (
        <div aria-hidden="true" className="h-1 w-full" style={{ backgroundColor: accent }} />
      ) : null}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          {workspaceLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={workspaceLogoUrl}
              alt=""
              className="h-9 w-9 rounded-lg object-cover border border-border"
            />
          ) : (
            <div
              className="grid place-items-center h-9 w-9 rounded-lg font-semibold text-sm text-white shrink-0"
              style={{ backgroundColor: accent ?? "hsl(var(--primary))" }}
              aria-hidden="true"
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
              Workspace
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">
              {workspaceName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RangeSelector label={rangeLabel} />
          <Link
            href="/portal/properties"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add property
          </Link>
        </div>
      </div>
    </header>
  );
}

function RangeSelector({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors"
      aria-label={`Date range: ${label}`}
    >
      <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="font-medium">{label}</span>
    </button>
  );
}
