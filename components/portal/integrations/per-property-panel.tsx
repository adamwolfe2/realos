// Per-Property Integrations panel
//
// Renders a matrix: rows = properties in the org, columns = GA4 / GSC /
// Pixel. Each cell shows the connection state for that property and a
// link to either connect (no row) or manage (row exists).
//
// Design principles:
//   * Hides itself for single-property orgs — those tenants already
//     have the org-wide cards above and don't need this panel.
//   * The legacy org-wide row appears as a synthetic "All properties"
//     row at the top so operators can see it alongside per-property
//     ones and don't get confused about why their connection is
//     "everywhere."
//   * Read-only display; the actual connect/disconnect happens through
//     the existing forms above. Eventually we'll inline a quick-connect
//     CTA per cell — out of scope for the v1 ship.
// ---------------------------------------------------------------------------

import Link from "next/link";
import { Check, AlertCircle, Plus } from "lucide-react";
import type { SeoProvider } from "@prisma/client";

type PropertyMini = { id: string; name: string };

type SeoRow = {
  provider: SeoProvider;
  propertyId: string | null;
  propertyIdentifier: string;
};

type CursiveRow = {
  propertyId: string | null;
  cursivePixelId: string | null;
};

export function PerPropertyIntegrationsPanel({
  properties,
  seoRows,
  cursiveRows,
}: {
  properties: PropertyMini[];
  seoRows: SeoRow[];
  cursiveRows: CursiveRow[];
}) {
  // Single-property orgs don't see this panel. They get the org-wide
  // cards above and don't need a matrix view.
  if (properties.length <= 1) return null;

  // Group existing rows for fast lookup. The legacy NULL row is
  // tracked separately because we render it as a synthetic "All
  // properties" row at the top of the table.
  const ga4ByProperty = new Map<string, SeoRow>();
  const gscByProperty = new Map<string, SeoRow>();
  let ga4Legacy: SeoRow | null = null;
  let gscLegacy: SeoRow | null = null;
  for (const row of seoRows) {
    if (row.propertyId === null) {
      if (row.provider === "GA4") ga4Legacy = row;
      else gscLegacy = row;
    } else {
      if (row.provider === "GA4") ga4ByProperty.set(row.propertyId, row);
      else gscByProperty.set(row.propertyId, row);
    }
  }

  const cursiveByProperty = new Map<string, CursiveRow>();
  let cursiveLegacy: CursiveRow | null = null;
  for (const row of cursiveRows) {
    if (row.propertyId === null) cursiveLegacy = row;
    else cursiveByProperty.set(row.propertyId, row);
  }

  const hasAnyLegacy = ga4Legacy || gscLegacy || cursiveLegacy;

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Per-property integrations
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each property typically has its own marketing site at its own
            domain — connect a distinct GA4, Search Console, and pixel
            for each one. Multi-property tenants need this for accurate
            per-property analytics.
          </p>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Property</th>
              <th className="py-2 px-3 font-medium">GA4</th>
              <th className="py-2 px-3 font-medium">Search Console</th>
              <th className="py-2 pl-3 font-medium">Pixel</th>
            </tr>
          </thead>
          <tbody>
            {/* Synthetic "All properties" row for the legacy org-wide
                connection, only shown if at least one such row exists.
                Lets operators see + reason about org-wide coverage
                alongside per-property rows. */}
            {hasAnyLegacy ? (
              <tr className="border-b border-border/60 bg-muted/30">
                <td className="py-2 pr-3 align-middle">
                  <span className="text-xs font-semibold text-foreground">
                    All properties
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Org-wide connection (legacy)
                  </p>
                </td>
                <Cell connected={!!ga4Legacy} />
                <Cell connected={!!gscLegacy} />
                <Cell
                  connected={!!cursiveLegacy?.cursivePixelId}
                />
              </tr>
            ) : null}

            {properties.map((p) => {
              const ga4 = ga4ByProperty.get(p.id);
              const gsc = gscByProperty.get(p.id);
              const cursive = cursiveByProperty.get(p.id);
              return (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 align-middle">
                    <Link
                      href={`/portal/properties/${p.id}`}
                      className="text-xs font-medium text-foreground hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <Cell
                    connected={!!ga4}
                    inheritsFromLegacy={!ga4 && !!ga4Legacy}
                    identifier={ga4?.propertyIdentifier}
                  />
                  <Cell
                    connected={!!gsc}
                    inheritsFromLegacy={!gsc && !!gscLegacy}
                    identifier={gsc?.propertyIdentifier}
                  />
                  <Cell
                    connected={!!cursive?.cursivePixelId}
                    inheritsFromLegacy={
                      !cursive?.cursivePixelId && !!cursiveLegacy?.cursivePixelId
                    }
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug">
        To add a per-property connection, scroll up to the corresponding
        integration card and pick a property in the connect form. The
        legacy &ldquo;All properties&rdquo; row shows because it was
        connected before per-property scoping was available; you can keep
        it as a portfolio-wide fallback or replace it with explicit
        per-property rows over time.
      </p>
    </section>
  );
}

function Cell({
  connected,
  inheritsFromLegacy,
  identifier,
}: {
  connected: boolean;
  inheritsFromLegacy?: boolean;
  identifier?: string | null;
}) {
  if (connected) {
    return (
      <td className="py-2 px-3 align-middle">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
          <Check className="h-3.5 w-3.5" /> Connected
        </span>
        {identifier ? (
          <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[14rem] mt-0.5">
            {identifier}
          </p>
        ) : null}
      </td>
    );
  }
  if (inheritsFromLegacy) {
    return (
      <td className="py-2 px-3 align-middle">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-muted-foreground/60" />
          Inherits from org-wide
        </span>
      </td>
    );
  }
  return (
    <td className="py-2 px-3 align-middle">
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
        Not connected
      </span>
    </td>
  );
}

// Lint guard: import is referenced if/when we add a quick-connect CTA
// per cell; keep the symbol available so the icon doesn't disappear
// from the bundle in the meantime.
void Plus;
