"use client";

// ---------------------------------------------------------------------------
// PropertyMultiSelect — shared filter dropdown rendered on every portal
// page that displays per-property data. Replaces the previous single-pick
// <select> on /reports + /leads, and extends to pages that previously
// had no filter at all (renewals, residents, conversations, etc.).
//
// Why a custom popover instead of Radix:
//   We don't have @radix-ui/react-popover installed in this app. Adding
//   it for one component pulls in a dependency for every consumer, and
//   the interaction surface here is small — a button + click-outside +
//   a search box + checkbox list. Native primitives are fine.
//
// URL convention:
//   ?properties=id1,id2,id3
// Backwards-compat:
//   ?property=<id>   (single-pick) — preserved on read; cleaned on write.
//
// Last-selection persistence:
//   We mirror the URL selection into localStorage keyed by orgId, so
//   when a user lands on a different page (or comes back tomorrow) we
//   re-apply their last filter. This is the single biggest UX win for
//   orgs like SG Real Estate that pulled in 70+ properties — the user
//   picks "Telegraph Commons" once and the whole platform stays scoped.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";

type Property = { id: string; name: string };

const STORAGE_KEY_PREFIX = "leasestack:properties:";

function storageKey(orgId: string): string {
  return `${STORAGE_KEY_PREFIX}${orgId}`;
}

function parseFromSearchParams(sp: URLSearchParams): string[] {
  const multi = sp.get("properties");
  if (multi) return multi.split(",").map((s) => s.trim()).filter(Boolean);
  const single = sp.get("property");
  if (single) return [single];
  return [];
}

export function PropertyMultiSelect({
  properties,
  orgId,
}: {
  properties: Property[];
  orgId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Single-property orgs don't need a filter at all — render nothing.
  // (Hiding instead of disabling keeps the page header from looking
  // cluttered when there's literally nothing to filter against.)
  const hasMultiple = properties.length > 1;

  const selected = useMemo(() => {
    return parseFromSearchParams(new URLSearchParams(searchParams.toString()));
  }, [searchParams]);

  // Persist current selection so it survives navigation between pages.
  // Skip when nothing is selected so we don't overwrite a remembered
  // pick with an empty string (which would defeat the whole purpose).
  useEffect(() => {
    if (!hasMultiple) return;
    if (typeof window === "undefined") return;
    if (selected.length > 0) {
      window.localStorage.setItem(storageKey(orgId), selected.join(","));
    } else {
      // User explicitly chose "All" — wipe so we don't snap back later.
      window.localStorage.removeItem(storageKey(orgId));
    }
  }, [selected, orgId, hasMultiple]);

  // First-mount restore: if URL has no property filter but localStorage
  // does, push it into the URL so server data filters correctly. We do
  // this with `replace` (not `push`) so the back button doesn't ping-pong
  // through the auto-restore step.
  useEffect(() => {
    if (!hasMultiple) return;
    if (typeof window === "undefined") return;
    const hasUrlParam =
      searchParams.has("properties") || searchParams.has("property");
    if (hasUrlParam) return;
    const stored = window.localStorage.getItem(storageKey(orgId));
    if (!stored) return;
    const ids = stored.split(",").filter(Boolean);
    // Only restore IDs that still exist for this org (a stored ID from a
    // deleted property would silently empty every page).
    const validIds = ids.filter((id) => properties.some((p) => p.id === id));
    if (validIds.length === 0) {
      window.localStorage.removeItem(storageKey(orgId));
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("properties", validIds.join(","));
    router.replace(`${pathname}?${params.toString()}`);
    // Intentionally only run on first mount per page — searchParams in
    // deps would cause this to fire on every URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click-outside to close the popover.
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function applySelection(next: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    // Always strip the legacy single-pick param when we write so users
    // never end up with conflicting `?property=A&properties=B,C`.
    params.delete("property");
    if (next.length === 0) {
      params.delete("properties");
    } else {
      params.set("properties", next.join(","));
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function toggle(id: string) {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    applySelection([...set]);
  }

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) => p.name.toLowerCase().includes(q));
  }, [properties, search]);

  const label = useMemo(() => {
    if (selected.length === 0) return "All properties";
    if (selected.length === 1) {
      const match = properties.find((p) => p.id === selected[0]);
      return match?.name ?? "1 property";
    }
    return `${selected.length} properties`;
  }, [selected, properties]);

  if (!hasMultiple) return null;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted/40 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : null}
        <span className="max-w-[16rem] truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open ? (
        <div
          role="listbox"
          // Anchor LEFT-aligned so the panel always extends rightward from
          // the trigger. Was right-0, which works for top-bar usage where
          // the trigger sits at the page's right edge — but on filter
          // forms like /portal/reports the trigger is on the left, and
          // right-0 caused the 288px panel to extend leftward off-screen
          // (clipped by the sidebar). Left-anchored is the safer default.
          className="absolute left-0 z-30 mt-1 w-72 rounded-md border border-border bg-background shadow-lg"
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search properties"
                className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Search properties"
                /* eslint-disable-next-line jsx-a11y/no-autofocus */
                autoFocus
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => applySelection([])}
                className="text-muted-foreground hover:text-foreground"
              >
                Show all
              </button>
              {selected.length > 0 ? (
                <span className="text-muted-foreground">
                  {selected.length} selected
                </span>
              ) : null}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredList.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matches
              </div>
            ) : (
              filteredList.map((p) => {
                const checked = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    role="option"
                    aria-selected={checked}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/40"
                  >
                    <span
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                        checked
                          ? "border-primary bg-primary"
                          : "border-border"
                      }`}
                    >
                      {checked ? (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      ) : null}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
