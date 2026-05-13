"use client";

import { useState, useTransition } from "react";
import { Building2, Check, X, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  setPropertyLifecycle,
  setPropertyLifecycleBulk,
} from "@/lib/actions/properties";

type Item = {
  id: string;
  name: string;
  slug: string;
  address: string;
  totalUnits: number | null;
  backendPlatform: string | null;
  backendPropertyId: string | null;
  excludeReason: string | null;
  lifecycleSetBy: string;
  createdAt: string;
};

export function CurationQueueClient({
  items,
  view,
}: {
  items: Item[];
  view: "imported" | "excluded";
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  function actSingle(id: string, action: "activate" | "exclude" | "restore") {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await setPropertyLifecycle({ propertyId: id, action });
      if (!result.ok) setErrorMessage(result.error);
    });
  }

  function actBulk(action: "activate" | "exclude") {
    if (selected.size === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await setPropertyLifecycleBulk({
        propertyIds: Array.from(selected),
        action,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 sticky top-0 z-10">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="ml-auto flex gap-2">
            {view === "imported" && (
              <>
                <button
                  type="button"
                  onClick={() => actBulk("activate")}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-foreground bg-primary text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
                  title="Activate selected — these will count toward your marketable property total and billing"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  Activate ({selected.size}) · counts toward billing
                </button>
                <button
                  type="button"
                  onClick={() => actBulk("exclude")}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted/40 disabled:opacity-50"
                  title="Exclude — keep in AppFolio mirror but do not bill or surface in dashboards"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  Exclude all
                </button>
              </>
            )}
            {view === "excluded" && (
              <button
                type="button"
                onClick={() => actBulk("activate")}
                disabled={pending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-foreground bg-primary text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                Restore as active
              </button>
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b border-border bg-muted/20 flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected.size === items.length && items.length > 0}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-border"
            aria-label="Select all"
          />
          <span className="text-xs text-muted-foreground">
            Select all
          </span>
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors",
                selected.has(item.id) && "bg-primary/5",
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                className="mt-1 h-4 w-4 rounded border-border"
                aria-label={`Select ${item.name}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Building2
                    className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium truncate">
                    {item.name}
                  </span>
                  {item.totalUnits ? (
                    <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40">
                      {item.totalUnits} units
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40">
                      no units
                    </span>
                  )}
                  {item.backendPlatform === "APPFOLIO" && (
                    <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/30">
                      AppFolio · {item.backendPropertyId}
                    </span>
                  )}
                  {item.lifecycleSetBy === "AUTO_CLASSIFIER" && (
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10">
                      auto-classified
                    </span>
                  )}
                </div>
                {item.address && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {item.address}
                  </p>
                )}
                {item.excludeReason && (
                  <p className="text-[11px] text-muted-foreground/80 mt-1">
                    Reason: {item.excludeReason}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                {view === "imported" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => actSingle(item.id, "activate")}
                      disabled={pending}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-foreground bg-primary text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
                      title="Activate this property — will count toward your marketable total and billing"
                    >
                      {pending ? (
                        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="w-3 h-3" aria-hidden="true" />
                      )}
                      Activate
                    </button>
                    <button
                      type="button"
                      onClick={() => actSingle(item.id, "exclude")}
                      disabled={pending}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground rounded border border-border hover:bg-muted/40 disabled:opacity-50"
                      title="Exclude — keep in AppFolio mirror but do not bill or display"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                      Exclude
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => actSingle(item.id, "activate")}
                    disabled={pending}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-foreground bg-primary text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-50"
                    title="Restore — bring back into active properties"
                  >
                    {pending ? (
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    )}
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
