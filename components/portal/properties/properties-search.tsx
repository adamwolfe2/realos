"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PropertiesSearch — debounced URL-bound search input. Pushes the query into
// the `q` searchParam so the server-rendered list filters without a full
// page reload feel. Per the design audit, searching a 100+ property
// portfolio without text search was painful.
//
// Preserves the active `view` and `properties` searchParams so a search
// inside "Has vacancies" doesn't blow away the active tab.
// ---------------------------------------------------------------------------

type Props = {
  initialValue?: string;
  className?: string;
};

export function PropertiesSearch({ initialValue = "", className }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = React.useState(initialValue);

  // Debounced URL push — 250ms feels responsive without spamming the
  // server on every keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        next.set("q", value.trim());
      } else {
        next.delete("q");
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      className={cn(
        "relative flex items-center w-full max-w-xs",
        className,
      )}
    >
      <Search
        className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search properties…"
        aria-label="Search properties"
        className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-shadow"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="absolute right-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
