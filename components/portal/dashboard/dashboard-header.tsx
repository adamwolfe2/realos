import * as React from "react";
import Link from "next/link";
import { Plus, Calendar } from "lucide-react";

// ---------------------------------------------------------------------------
// DashboardHeader
//
// Top strip of /portal: tenant identity (logo or letter glyph + name),
// timeframe selector (read-only display until a real range picker lands),
// and the primary "Add property" CTA.
//
// The tenant-brand color is used as a thin top accent rail to subtly tint the
// dashboard chrome with whatever the operator's brand is.
// ---------------------------------------------------------------------------

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
    <header className="rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] overflow-hidden">
      {accent ? (
        <div
          aria-hidden="true"
          className="h-1 w-full"
          style={{ backgroundColor: accent }}
        />
      ) : null}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          {workspaceLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={workspaceLogoUrl}
              alt=""
              className="h-10 w-10 rounded-lg object-cover border border-[var(--border-cream)]"
            />
          ) : (
            <div
              className="grid place-items-center h-10 w-10 rounded-lg font-serif font-semibold text-base text-white shrink-0"
              style={{
                backgroundColor: accent ?? "var(--near-black)",
              }}
              aria-hidden="true"
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
              Workspace
            </div>
            <h1 className="font-serif text-xl md:text-2xl font-medium tracking-tight text-[var(--near-black)] truncate">
              {workspaceName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RangeSelector label={rangeLabel} />
          <Link
            href="/portal/properties"
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--terracotta)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--terracotta-hover)] transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add property
          </Link>
        </div>
      </div>
    </header>
  );
}

// Static range selector for now — clicking it should later surface a real
// timeframe popover. Built as a button so the affordance is obviously
// interactive even before the popover lands.
function RangeSelector({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-cream)] bg-[var(--white)] px-3 py-2 text-sm text-[var(--charcoal-warm)] hover:border-[var(--ring-warm)] transition-colors"
      aria-label={`Date range: ${label}`}
    >
      <Calendar className="h-3.5 w-3.5 text-[var(--stone-gray)]" aria-hidden="true" />
      <span className="font-medium">{label}</span>
    </button>
  );
}
