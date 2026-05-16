import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  Filter as FilterIcon,
  ArrowUpDown,
  Settings2,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// EntityToolbar — Twenty-style toolbar that anchors every entity directory
// (Residents, Leads, Visitors, Properties, Conversations, Listings).
//
// Layout:
//   ┌────────────────────────────────────────────────────────────────────┐
//   │ All · 184 ▾    Active · 92    Notice · 8    Past · 84   │  ⊞ ⇅ ⚙   │  ← view tabs row
//   ├────────────────────────────────────────────────────────────────────┤
//   │ ⊕ Property: Telegraph ×    Status: Active ×    + Add filter        │  ← chip row
//   └────────────────────────────────────────────────────────────────────┘
//
// All state is URL-driven (Next.js <Link>s) so views, filters, sorts are
// shareable, bookmarkable, and SSR-friendly. No client store, no flash.
// ---------------------------------------------------------------------------

export type ToolbarView = {
  label: string;
  href: string;
  count?: number | null;
  active?: boolean;
};

export type ToolbarFilter = {
  /** Field label, e.g. "Status" */
  field: string;
  /** Current value, e.g. "Active" */
  value: string;
  /** URL that removes this filter from the query string */
  removeHref: string;
  /** Optional icon shown on the chip */
  icon?: React.ReactNode;
};

type Props = {
  /** Saved views shown as tab strip (left of the row). */
  views?: ToolbarView[];
  /** Active filter chips shown below the tabs. */
  filters?: ToolbarFilter[];
  /** Optional URL for the "+ Add filter" affordance. */
  addFilterHref?: string;
  /** Optional URL the Sort dropdown navigates to (typically opens a popover). */
  sortHref?: string;
  /** Optional URL the Options/Settings dropdown navigates to. */
  optionsHref?: string;
  /** Optional right-aligned slot for primary action (e.g. New, Export). */
  primaryAction?: React.ReactNode;
  /** Render a search input on the chip row. */
  search?: {
    placeholder?: string;
    /** Hidden form fields preserved in the GET request. */
    hiddenFields?: Record<string, string | null | undefined>;
    name?: string;
    defaultValue?: string;
    action?: string;
  };
  className?: string;
};

export function EntityToolbar({
  views,
  filters,
  addFilterHref,
  sortHref,
  optionsHref,
  primaryAction,
  search,
  className,
}: Props) {
  const hasViews = views && views.length > 0;
  const hasFilters = filters && filters.length > 0;
  const hasAddFilter = !!addFilterHref;
  const hasSearch = !!search;
  const showChipRow = hasFilters || hasAddFilter || hasSearch;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        className,
      )}
    >
      {/* Row 1 — view tabs + global actions */}
      {hasViews ? (
        <div className="flex items-center gap-2 px-2 pt-2 pb-1.5 border-b border-border/60">
          <div className="flex flex-1 min-w-0 items-center gap-0.5 overflow-x-auto scrollbar-hide">
            {views.map((v) => (
              <ViewTab key={v.href} view={v} />
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 pl-2 border-l border-border/60">
            {sortHref ? (
              <ToolbarIconButton href={sortHref} icon={<ArrowUpDown className="h-3.5 w-3.5" />} label="Sort" />
            ) : null}
            {optionsHref ? (
              <ToolbarIconButton href={optionsHref} icon={<Settings2 className="h-3.5 w-3.5" />} label="Options" />
            ) : null}
            {primaryAction ? (
              <div className="ml-1">{primaryAction}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Row 2 — filter chips + add filter + search */}
      {showChipRow ? (
        <div className="flex items-center gap-2 px-2 py-1.5 flex-wrap">
          <FilterIcon
            className="h-3.5 w-3.5 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          {filters?.map((f) => (
            <FilterChip key={`${f.field}:${f.value}`} filter={f} />
          ))}
          {hasAddFilter ? (
            <Link
              href={addFilterHref!}
              scroll={false}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Add filter
            </Link>
          ) : null}
          {hasSearch ? (
            <form
              action={search.action}
              method="get"
              className="ml-auto flex items-center"
            >
              {search.hiddenFields
                ? Object.entries(search.hiddenFields).map(([k, v]) =>
                    v == null ? null : (
                      <input
                        key={k}
                        type="hidden"
                        name={k}
                        value={String(v)}
                      />
                    ),
                  )
                : null}
              <input
                type="search"
                name={search.name ?? "q"}
                defaultValue={search.defaultValue ?? ""}
                placeholder={search.placeholder ?? "Search…"}
                className="h-7 w-44 rounded-md border border-border bg-background px-2 text-[11px] placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View tab — saved view in the upper strip. Active tab gets a subtle blue
// underline + filled count chip; inactive tabs read as plain links.
// ---------------------------------------------------------------------------

function ViewTab({ view }: { view: ToolbarView }) {
  return (
    <Link
      href={view.href}
      scroll={false}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium whitespace-nowrap transition-colors",
        view.active
          ? "text-foreground bg-primary/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
      )}
    >
      <span>{view.label}</span>
      {view.count != null ? (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded px-1 min-w-[16px] h-[14px] tabular-nums text-[10px] font-semibold",
            view.active
              ? "bg-primary/20 text-primary"
              : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10",
          )}
        >
          {view.count}
        </span>
      ) : null}
      {view.active ? (
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
      ) : null}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Filter chip — active filter pill with field:value and a close × link.
// ---------------------------------------------------------------------------

function FilterChip({ filter }: { filter: ToolbarFilter }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 pl-1.5 pr-0.5 py-0.5 text-[11px] font-medium text-primary whitespace-nowrap">
      {filter.icon ? (
        <span className="opacity-70" aria-hidden="true">
          {filter.icon}
        </span>
      ) : null}
      <span className="text-muted-foreground/80">{filter.field}:</span>
      <span>{filter.value}</span>
      <Link
        href={filter.removeHref}
        scroll={false}
        aria-label={`Remove ${filter.field} filter`}
        className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-primary/20 transition-colors"
      >
        <X className="h-2.5 w-2.5" />
      </Link>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toolbar icon button — used for Sort/Options/etc on the right of the view row.
// ---------------------------------------------------------------------------

function ToolbarIconButton({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
