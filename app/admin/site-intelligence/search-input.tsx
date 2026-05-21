"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Client-side search input for the site-intelligence list page. Writes
 * `?q=` into the URL (replaceState) so the server-rendered list can filter
 * its rows via the URL. Debounced 200ms to avoid hammering the navigation.
 */
export function SearchInput({ placeholder = "Search by org, slug, or domain…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const initial = sp.get("q") ?? "";
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className="relative flex items-center">
      <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-72 rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        aria-label="Search organizations"
      />
    </label>
  );
}
