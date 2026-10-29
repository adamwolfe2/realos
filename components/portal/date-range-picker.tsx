"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronDown } from "lucide-react";

// Date range control: presets plus a custom from/to using the browser's
// native date inputs. Writes ?range= or ?from=&to= so server pages recompute.

const PRESETS = [
  { key: "7d", label: "Last 7 days" },
  { key: "28d", label: "Last 28 days" },
  { key: "90d", label: "Last 90 days" },
];

export function DateRangePicker({ label }: { label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState(searchParams?.get("from") ?? "");
  const [to, setTo] = React.useState(searchParams?.get("to") ?? "");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function go(update: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [k, v] of Object.entries(update)) {
      if (v == null) params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    setOpen(false);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const today = new Date().toISOString().slice(0, 10);
  const activePreset = searchParams?.get("from") ? null : (searchParams?.get("range") ?? "28d");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-[8px] border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground hover:border-[var(--t-accent)]"
      >
        <Calendar className="h-4 w-4 text-primary" />
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-[12px] border border-border bg-card p-2 shadow-[0_8px_24px_rgba(11,21,48,0.12)]">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => go({ range: p.key, from: null, to: null })}
              className={`flex w-full items-center rounded-[8px] px-3 py-2 text-left text-[13px] ${
                activePreset === p.key ? "bg-[var(--t-accent-soft)] font-medium text-primary" : "text-foreground hover:bg-secondary"
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="mt-2 border-t border-border px-1 pt-3">
            <p className="px-2 text-[12px] font-medium text-muted-foreground">Custom range</p>
            <div className="mt-2 grid grid-cols-2 gap-2 px-1">
              <input type="date" aria-label="From" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-[8px] border border-border px-2 py-1.5 text-[12px]" />
              <input type="date" aria-label="To" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="w-full rounded-[8px] border border-border px-2 py-1.5 text-[12px]" />
            </div>
            <button
              type="button"
              disabled={!from || !to || from > to}
              onClick={() => go({ from, to, range: null })}
              className="mt-2 w-full rounded-[8px] bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
