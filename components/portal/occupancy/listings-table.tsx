"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Filter,
  AlertTriangle,
  X,
  Trash2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  deleteListing,
  toggleListingAvailable,
} from "@/lib/actions/listings";

// ---------------------------------------------------------------------------
// ListingsTable — replacement for the inline server table in
// app/portal/properties/[id]/tabs/occupancy.tsx. Built to address several
// bugs Norman filed during the audit:
//
//   #46 — TYPE/BEDS/BATHS columns were "—" for every visible row because
//         AppFolio's unit_directory doesn't return per-bed configuration
//         for student-housing properties. We now parse what we can from
//         `unitType` (e.g. "Triple Shared - 3BD/2BA") and hide columns
//         that remain 100% empty across the visible dataset.
//
//   #47 — PRICE column showed "Contact for pricing" with no explanation.
//         Add a hover tooltip explaining the absence (no rent set in
//         AppFolio for the unit).
//
//   #48 — Unit naming mixed 5+ patterns ("307-B", "2492 Channing Way",
//         "Telegraph Commons - Single - Spring"). We split into Unit /
//         Detail columns so the operator can sort on a stable key.
//
//   #49 — Delete + Mark leased were inline with no confirmation. Replaced
//         with an in-app AlertDialog-style modal so a misclick doesn't
//         destroy a row.
//
//   #50 — No sort or filter controls. Added column-header click-to-sort
//         plus a filter chip row (status + bed-type).
// ---------------------------------------------------------------------------

export type ListingRow = {
  id: string;
  unitNumber: string | null;
  unitType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  priceCents: number | null;
  isAvailable: boolean;
};

type SortKey =
  | "unit"
  | "type"
  | "bedrooms"
  | "bathrooms"
  | "price"
  | "status";

type SortDir = "asc" | "desc";

type StatusFilter = "ALL" | "AVAILABLE" | "LEASED";

type PendingAction =
  | { type: "delete"; listing: ListingRow }
  | { type: "toggle"; listing: ListingRow }
  | null;

// Try to extract bed/bath counts from a free-text unitType string such
// as "Triple Shared - 3BD/2BA" or "Studio 1Ba". Returns null when the
// pattern isn't found so we don't overwrite real null with junk.
function parseBedsFromUnitType(unitType: string | null): {
  beds: number | null;
  baths: number | null;
} {
  if (!unitType) return { beds: null, baths: null };
  const text = unitType.toLowerCase();
  // "3bd", "3 bd", "3 bed", "3-bed", "3br"
  const bedMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:bd|br|bed)/);
  const bathMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath)/);
  const beds = bedMatch ? parseFloat(bedMatch[1]) : null;
  const baths = bathMatch ? parseFloat(bathMatch[1]) : null;
  // Studio handling
  if (beds == null && /\bstudio\b/.test(text)) {
    return { beds: 0, baths };
  }
  return { beds, baths };
}

// Classify a unit identifier into one of:
//   - "unit-code"     — "307-B", "413A", "Unit 12"
//   - "address"       — "2492 Channing Way"
//   - "descriptor"    — "Telegraph Commons - Single - Spring"
//   - "unknown"
// Used to render the secondary "Detail" column without forcing all
// the inputs into one shape.
function classifyUnitLabel(raw: string | null): {
  primary: string;
  detail: string | null;
} {
  if (!raw) return { primary: "—", detail: null };
  const trimmed = raw.trim();
  // Address heuristic: starts with digits + space + word
  if (/^\d+\s+\w/.test(trimmed) && /\b(?:st|street|ave|avenue|way|rd|road|blvd|drive|dr|lane|ln|ct|court)\b/i.test(trimmed)) {
    return { primary: trimmed, detail: "Address" };
  }
  // Unit code heuristic: alphanumeric like "307-B", "1A-12", "413A"
  if (/^[A-Z0-9][A-Z0-9\-\s]{0,12}$/i.test(trimmed) && /\d/.test(trimmed)) {
    return { primary: trimmed, detail: null };
  }
  // Descriptor: anything with "-" separators or commas (e.g.,
  // "Telegraph Commons - Single - Spring"). Show the segment after
  // the first "-" as detail so the operator can still scan it.
  if (trimmed.includes(" - ")) {
    const [head, ...rest] = trimmed.split(" - ");
    return { primary: head.trim(), detail: rest.join(" / ").trim() };
  }
  return { primary: trimmed, detail: null };
}

function formatUsd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function ListingsTable({
  listings,
}: {
  listings: ListingRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sortKey, setSortKey] = React.useState<SortKey>("unit");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");
  const [bedFilter, setBedFilter] = React.useState<"ALL" | "0" | "1" | "2" | "3+">(
    "ALL",
  );
  const [pendingAction, setPendingAction] = React.useState<PendingAction>(null);

  // Bug #46 — column visibility. Hide columns where every visible row
  // is null so the operator doesn't stare at a wall of em-dashes that
  // implies broken data. We compute against the FULL listings array,
  // not the filtered view, so toggling filters doesn't change the
  // shape of the table.
  const columnPresence = React.useMemo(() => {
    const enriched = listings.map((l) => {
      const parsed = parseBedsFromUnitType(l.unitType);
      return {
        type: !!l.unitType,
        beds: l.bedrooms != null || parsed.beds != null,
        baths: l.bathrooms != null || parsed.baths != null,
      };
    });
    const anyType = enriched.some((e) => e.type);
    const anyBeds = enriched.some((e) => e.beds);
    const anyBaths = enriched.some((e) => e.baths);
    return { type: anyType, beds: anyBeds, baths: anyBaths };
  }, [listings]);

  const enrichedListings = React.useMemo(
    () =>
      listings.map((l) => {
        const parsed = parseBedsFromUnitType(l.unitType);
        const classified = classifyUnitLabel(l.unitNumber);
        return {
          ...l,
          // Effective values — prefer DB column, fall back to parsed.
          effectiveBeds: l.bedrooms ?? parsed.beds,
          effectiveBaths: l.bathrooms ?? parsed.baths,
          unitPrimary: classified.primary,
          unitDetail: classified.detail,
        };
      }),
    [listings],
  );

  const filtered = React.useMemo(() => {
    return enrichedListings.filter((l) => {
      if (statusFilter === "AVAILABLE" && !l.isAvailable) return false;
      if (statusFilter === "LEASED" && l.isAvailable) return false;
      if (bedFilter !== "ALL") {
        const beds = l.effectiveBeds;
        if (bedFilter === "0" && beds !== 0) return false;
        if (bedFilter === "1" && beds !== 1) return false;
        if (bedFilter === "2" && beds !== 2) return false;
        if (bedFilter === "3+" && (beds == null || beds < 3)) return false;
      }
      return true;
    });
  }, [enrichedListings, statusFilter, bedFilter]);

  const sorted = React.useMemo(() => {
    const out = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      switch (sortKey) {
        case "unit":
          return a.unitPrimary.localeCompare(b.unitPrimary, undefined, {
            numeric: true,
          }) * dir;
        case "type":
          return ((a.unitType ?? "").localeCompare(b.unitType ?? "")) * dir;
        case "bedrooms": {
          const av = a.effectiveBeds ?? -1;
          const bv = b.effectiveBeds ?? -1;
          return (av - bv) * dir;
        }
        case "bathrooms": {
          const av = a.effectiveBaths ?? -1;
          const bv = b.effectiveBaths ?? -1;
          return (av - bv) * dir;
        }
        case "price": {
          const av = a.priceCents ?? -1;
          const bv = b.priceCents ?? -1;
          return (av - bv) * dir;
        }
        case "status":
          return ((a.isAvailable ? 0 : 1) - (b.isAvailable ? 0 : 1)) * dir;
        default:
          return 0;
      }
    });
    return out;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const confirmAction = () => {
    if (!pendingAction) return;
    const action = pendingAction;
    startTransition(async () => {
      try {
        if (action.type === "delete") {
          const result = await deleteListing(action.listing.id);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(
            `Deleted ${action.listing.unitNumber ?? "listing"}`,
          );
        } else {
          const next = !action.listing.isAvailable;
          const result = await toggleListingAvailable(
            action.listing.id,
            next,
          );
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(
            next
              ? `Marked ${action.listing.unitNumber ?? "listing"} available`
              : `Marked ${action.listing.unitNumber ?? "listing"} leased`,
          );
        }
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Action failed",
        );
      } finally {
        setPendingAction(null);
      }
    });
  };

  if (listings.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No listings yet. Add one below — the chatbot reads from this list to
        surface live availability and pricing.
      </p>
    );
  }

  const showTypeCol = columnPresence.type;
  const showBedsCol = columnPresence.beds;
  const showBathsCol = columnPresence.baths;
  const missingDetailCount = listings.filter(
    (l) =>
      !l.unitType &&
      l.bedrooms == null &&
      l.bathrooms == null,
  ).length;

  return (
    <div className="space-y-3">
      {/* Bug #50 — filter chip row */}
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <span className="inline-flex items-center gap-1 text-muted-foreground pr-1">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Filters:
        </span>
        {(["ALL", "AVAILABLE", "LEASED"] as const).map((s) => (
          <Chip
            key={s}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          >
            {s === "ALL" ? "All status" : s.charAt(0) + s.slice(1).toLowerCase()}
          </Chip>
        ))}
        <span className="w-1" />
        {(["ALL", "0", "1", "2", "3+"] as const).map((b) => (
          <Chip
            key={b}
            active={bedFilter === b}
            onClick={() => setBedFilter(b)}
          >
            {b === "ALL"
              ? "All beds"
              : b === "0"
                ? "Studio"
                : `${b} bed${b === "1" ? "" : "s"}`}
          </Chip>
        ))}
        <span className="ml-auto text-muted-foreground tabular-nums">
          {sorted.length} of {listings.length}
        </span>
      </div>

      {/* Bug #46 — synced-detail gap disclosure. Surfaces when a
          substantial share of listings are missing the AppFolio
          per-unit fields so the operator knows it's a sync gap, not
          a UI bug. */}
      {missingDetailCount > 0 ? (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
          <AlertTriangle
            className="inline h-3 w-3 mr-1 -translate-y-0.5"
            aria-hidden="true"
          />
          {missingDetailCount} of {listings.length} listings are missing
          per-unit details (type, beds, baths). AppFolio&apos;s{" "}
          <code className="font-mono">unit_directory</code> report doesn&apos;t
          return these for some unit configurations (e.g., per-room student
          housing). They&apos;ll populate as they&apos;re entered upstream.
        </p>
      ) : null}

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm">
          <thead className="text-[10px] tracking-widest uppercase text-muted-foreground">
            <tr>
              <SortableHeader
                label="Unit"
                active={sortKey === "unit"}
                dir={sortDir}
                onClick={() => toggleSort("unit")}
                align="left"
              />
              {showTypeCol ? (
                <SortableHeader
                  label="Type"
                  active={sortKey === "type"}
                  dir={sortDir}
                  onClick={() => toggleSort("type")}
                  align="left"
                />
              ) : null}
              {showBedsCol ? (
                <SortableHeader
                  label="Beds"
                  active={sortKey === "bedrooms"}
                  dir={sortDir}
                  onClick={() => toggleSort("bedrooms")}
                  align="right"
                />
              ) : null}
              {showBathsCol ? (
                <SortableHeader
                  label="Baths"
                  active={sortKey === "bathrooms"}
                  dir={sortDir}
                  onClick={() => toggleSort("bathrooms")}
                  align="right"
                />
              ) : null}
              <SortableHeader
                label="Price"
                active={sortKey === "price"}
                dir={sortDir}
                onClick={() => toggleSort("price")}
                align="right"
              />
              <SortableHeader
                label="Status"
                active={sortKey === "status"}
                dir={sortDir}
                onClick={() => toggleSort("status")}
                align="center"
              />
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((l) => (
              <tr key={l.id}>
                <td className="py-2.5 text-xs text-foreground">
                  {/* Bug #48 — split primary identifier from descriptor */}
                  <div className="flex flex-col">
                    <span>{l.unitPrimary}</span>
                    {l.unitDetail ? (
                      <span className="text-[10px] text-muted-foreground/80">
                        {l.unitDetail}
                      </span>
                    ) : null}
                  </div>
                </td>
                {showTypeCol ? (
                  <td className="py-2.5 text-xs text-muted-foreground">
                    {l.unitType ?? "—"}
                  </td>
                ) : null}
                {showBedsCol ? (
                  <td className="py-2.5 text-right tabular-nums text-xs">
                    {l.effectiveBeds != null
                      ? l.effectiveBeds === 0
                        ? "Studio"
                        : l.effectiveBeds
                      : "—"}
                  </td>
                ) : null}
                {showBathsCol ? (
                  <td className="py-2.5 text-right tabular-nums text-xs">
                    {l.effectiveBaths ?? "—"}
                  </td>
                ) : null}
                <td className="py-2.5 text-right tabular-nums text-xs">
                  {l.priceCents != null && l.priceCents > 0 ? (
                    formatUsd(l.priceCents)
                  ) : (
                    // Bug #47 — explicit tooltip on "Contact for pricing"
                    <span
                      className="text-muted-foreground/70 italic font-normal text-[11px] underline decoration-dotted decoration-muted-foreground/40 underline-offset-2 cursor-help"
                      title="No rent value set in AppFolio for this unit. AppFolio returns null when the unit hasn't been priced (typical for off-market or per-bed configurations). Set a market_rent in AppFolio to populate this."
                    >
                      Contact for pricing
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-center">
                  {l.isAvailable ? (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-primary/10 text-primary">
                      Available
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-muted text-muted-foreground">
                      Leased
                    </span>
                  )}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAction({ type: "toggle", listing: l })
                      }
                      disabled={isPending}
                      className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      {l.isAvailable ? "Mark leased" : "Mark available"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAction({ type: "delete", listing: l })
                      }
                      disabled={isPending}
                      className="text-[11px] text-destructive/80 hover:text-destructive disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bug #49 — confirmation modal for destructive + status-change
          actions. Native confirm() was reserved for Delete only; Mark
          leased had no confirmation at all. Both now route through
          this modal so a misclick on a 141-row table doesn't ship a
          wrong status to AppFolio or wipe a row. */}
      {pendingAction ? (
        <ConfirmModal
          action={pendingAction}
          pending={isPending}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmAction}
        />
      ) : null}
    </div>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align: "left" | "right" | "center";
}) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";
  return (
    <th className={`${alignClass} font-semibold pb-2`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
          active ? "text-foreground" : ""
        }`}
        aria-label={`Sort by ${label} ${active ? `(${dir})` : ""}`}
      >
        <span>{label}</span>
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
          )
        ) : (
          <ChevronsUpDown
            className="h-3 w-3 opacity-50"
            aria-hidden="true"
          />
        )}
      </button>
    </th>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ConfirmModal({
  action,
  pending,
  onCancel,
  onConfirm,
}: {
  action: NonNullable<PendingAction>;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isDelete = action.type === "delete";
  const nextStatus = !action.listing.isAvailable;
  const unitLabel = action.listing.unitNumber ?? "this listing";
  const title = isDelete
    ? `Delete ${unitLabel}?`
    : nextStatus
      ? `Mark ${unitLabel} available?`
      : `Mark ${unitLabel} leased?`;
  const body = isDelete
    ? "This removes the listing from your dashboard and the chatbot. The action can't be undone."
    : nextStatus
      ? "The unit will appear in the chatbot and in marketing surfaces as live inventory."
      : "The unit will be hidden from chatbot suggestions and surface as leased on the public site.";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-lg">
        <header className="flex items-start justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {body}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-7 px-2 ml-2"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </header>
        <footer className="flex items-center justify-end gap-2 px-4 py-3">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={onConfirm}
            variant={isDelete ? "destructive" : "default"}
            className="gap-1.5"
          >
            {isDelete ? (
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {pending
              ? "Working…"
              : isDelete
                ? "Delete"
                : nextStatus
                  ? "Mark available"
                  : "Mark leased"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
