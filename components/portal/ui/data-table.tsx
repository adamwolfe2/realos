import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// DataTable — Twenty-CRM-inspired dense table for entity lists (Properties,
// Leads, Visitors, Conversations, Residents, etc.). Replaces the kanban /
// card-grid surfaces that previously rendered each row as a 200px card.
//
// Design notes:
//   - Sticky header so column labels stay visible during scroll
//   - 36px row height by default — readable but dense
//   - Hover highlights the row + flips the cursor to indicate clickability
//   - First column gets an optional inline avatar/icon for visual anchoring
//   - Sortable columns render an indicator; sort state is URL-driven so
//     bookmarks + share-links work
//   - Token-driven so the cream canvas + ink palette flow through
//
// Usage:
//   <DataTable
//     columns={[
//       { key: "name", header: "Name", sortable: true, accessor: (r) => <NameCell row={r} /> },
//       { key: "city", header: "City", accessor: (r) => r.city },
//       { key: "leads", header: "Leads", align: "right", accessor: (r) => r.leadCount },
//     ]}
//     rows={items}
//     getRowHref={(r) => `/portal/leads/${r.id}`}
//     emptyState={<EmptyState ... />}
//     sort={{ by: sortBy, dir: sortDir, hrefForSort }}
//   />
// ---------------------------------------------------------------------------

export type DataTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  /** When sortable, the header becomes a Link; sort.hrefForSort builds the target URL. */
  sortable?: boolean;
  /** Pixel width or Tailwind w-* utility. Width "auto" lets the column flex. */
  width?: string;
  /** Cell horizontal alignment. */
  align?: "left" | "right" | "center";
  /** Render the cell contents from a row. */
  accessor: (row: T) => React.ReactNode;
  /** Hide on small screens to keep the table readable on mobile. */
  hideOnMobile?: boolean;
};

export type DataTableSort = {
  by: string;
  dir: "asc" | "desc";
  /** Returns the URL the column header should link to for the next sort state. */
  hrefForSort: (key: string) => string;
};

type Props<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Optional URL each row navigates to on click. */
  getRowHref?: (row: T) => string;
  /** Optional id accessor (defaults to the row's `id` field if present). */
  getRowKey?: (row: T) => string;
  emptyState?: React.ReactNode;
  sort?: DataTableSort;
  /** Tighter row height for very dense lists (24px vs 36px). */
  density?: "default" | "compact";
  className?: string;
};

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  getRowHref,
  getRowKey,
  emptyState,
  sort,
  density = "default",
  className,
}: Props<T>) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const rowPad = density === "compact" ? "py-1.5" : "py-2";
  const cellPad = density === "compact" ? "px-2.5" : "px-3";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/40 sticky top-0">
              {columns.map((col) => {
                const sortable = sort && col.sortable;
                const isSorted = sortable && sort?.by === col.key;
                const Indicator = !isSorted
                  ? ArrowUpDown
                  : sort?.dir === "asc"
                    ? ArrowUp
                    : ArrowDown;
                const headerInner = (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] tracking-widest uppercase font-semibold",
                      isSorted ? "text-foreground" : "text-muted-foreground",
                      sortable && "hover:text-foreground transition-colors",
                    )}
                  >
                    {col.header}
                    {sortable ? (
                      <Indicator
                        className={cn(
                          "h-2.5 w-2.5 shrink-0",
                          isSorted ? "opacity-100" : "opacity-50",
                        )}
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                );
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      cellPad,
                      "py-2 text-left font-normal whitespace-nowrap",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.hideOnMobile && "hidden md:table-cell",
                    )}
                  >
                    {sortable && sort ? (
                      <Link
                        href={sort.hrefForSort(col.key)}
                        scroll={false}
                        className={cn(
                          col.align === "right" ? "justify-end" : "justify-start",
                          "inline-flex w-full",
                        )}
                      >
                        {headerInner}
                      </Link>
                    ) : (
                      headerInner
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const key = getRowKey
                ? getRowKey(row)
                : (row as { id?: string }).id ?? String(i);
              const href = getRowHref ? getRowHref(row) : null;
              return (
                <DataTableRow
                  key={key}
                  href={href}
                  rowPad={rowPad}
                  cellPad={cellPad}
                  isLast={i === rows.length - 1}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      className={cn(
                        cellPad,
                        rowPad,
                        "text-foreground align-middle",
                        col.align === "right" && "text-right tabular-nums",
                        col.align === "center" && "text-center",
                        col.hideOnMobile && "hidden md:table-cell",
                      )}
                    >
                      {col.accessor(row)}
                    </td>
                  ))}
                </DataTableRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataTableRow({
  href,
  children,
  rowPad,
  cellPad,
  isLast,
}: {
  href: string | null;
  children: React.ReactNode;
  rowPad: string;
  cellPad: string;
  isLast: boolean;
}) {
  // We can't wrap a <tr> in an <a>, so when href is set we render the row's
  // first cell with the link spanning the full row visually via a pseudo
  // overlay link. Cleaner approach: use the entire row as a link target via
  // CSS `:has()` → but for browser compat we just attach onClick via a
  // shared parent and add a hover treatment.
  void rowPad;
  void cellPad;
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0 transition-colors group",
        href && "cursor-pointer hover:bg-muted/40",
        isLast && "border-b-0",
      )}
      // Server components can't have onClick handlers without breaking; we
      // rely on the first cell's <Link> to drive navigation. Hover state
      // applies regardless, so the visual affordance reads correctly.
    >
      {/* When href is set, the first child cell wraps its content in a Link
          so keyboard navigation works. */}
      {href ? (
        <RowLinkInjector href={href}>{children}</RowLinkInjector>
      ) : (
        children
      )}
    </tr>
  );
}

// Wraps the first <td>'s contents in a <Link> so the row is clickable from
// the most prominent column. Visual hover applies to the whole row via the
// <tr> hover class.
function RowLinkInjector({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const arr = React.Children.toArray(children);
  return (
    <>
      {arr.map((child, idx) => {
        if (idx === 0 && React.isValidElement(child)) {
          // Replace the first cell's content with a Link wrapper so the
          // primary cell drives navigation. Other cells are regular text.
          const cell = child as React.ReactElement<{
            children?: React.ReactNode;
            className?: string;
          }>;
          return React.cloneElement(cell, {
            ...cell.props,
            children: (
              <Link
                href={href}
                className="block w-full -m-1 p-1 hover:text-primary transition-colors"
              >
                {cell.props.children}
              </Link>
            ),
          });
        }
        return child;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Avatar — colored monogram chip used in the leftmost cell of entity tables.
// Pulls a deterministic color from the row's id so each entity gets a
// stable color hash without us having to store one.
// ---------------------------------------------------------------------------

const AVATAR_PALETTE = [
  { bg: "#1A1A1A", fg: "#FAF9F5" },
  { bg: "#2563EB", fg: "#FFFFFF" },
  { bg: "#10B981", fg: "#FFFFFF" },
  { bg: "#F59E0B", fg: "#1A1A1A" },
  { bg: "#B53333", fg: "#FFFFFF" },
  { bg: "#8B5CF6", fg: "#FFFFFF" },
  { bg: "#0EA5E9", fg: "#FFFFFF" },
  { bg: "#87867F", fg: "#FFFFFF" },
];

function hashStringToIndex(s: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % modulo;
}

export function Avatar({
  name,
  seed,
  size = 24,
  className,
}: {
  /** Display name; first letter is rendered. */
  name: string;
  /** Optional id seed for stable hash; defaults to name. */
  seed?: string;
  size?: number;
  className?: string;
}) {
  const idx = hashStringToIndex(seed ?? name, AVATAR_PALETTE.length);
  const { bg, fg } = AVATAR_PALETTE[idx];
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold leading-none shrink-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: fg,
        fontSize: size * 0.42,
      }}
    >
      {letter}
    </span>
  );
}

// ---------------------------------------------------------------------------
// EntityCell — name + secondary line (email / address / etc.) used as the
// first column of an entity table. Pairs an Avatar with two lines of text.
// ---------------------------------------------------------------------------

export function EntityCell({
  name,
  secondary,
  seed,
  avatar,
}: {
  name: string;
  secondary?: React.ReactNode;
  seed?: string;
  /** Optional override for the avatar — pass a custom node to skip the monogram. */
  avatar?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {avatar ?? <Avatar name={name} seed={seed} />}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate leading-tight">
          {name}
        </p>
        {secondary ? (
          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
            {secondary}
          </p>
        ) : null}
      </div>
    </div>
  );
}
