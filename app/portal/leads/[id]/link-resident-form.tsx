"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Manual lead→lease link — the operator's "Mark as signed" close-the-loop
// control (2026-08-02 proof chain). Pure UI: every rule (scope, steal
// protection, monotonic SIGNED promotion) lives in
// /api/tenant/leads/[id]/link-resident.
// ---------------------------------------------------------------------------

export type LinkedResident = {
  id: string;
  name: string;
  unitNumber: string | null;
  leaseStart: string | null; // ISO
};

export type ResidentCandidate = {
  id: string;
  name: string;
  unitNumber: string | null;
  propertyName: string | null;
  moveInDate: string | null; // ISO
};

export function LinkResidentForm({
  leadId,
  linked,
  candidates,
}: {
  leadId: string;
  linked: LinkedResident[];
  candidates: ResidentCandidate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? candidates.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.unitNumber ?? "").toLowerCase().includes(q),
        )
      : candidates;
    return pool.slice(0, 8);
  }, [candidates, query]);

  function call(method: "POST" | "DELETE", residentId: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/tenant/leads/${leadId}/link-resident`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Request failed");
      } else {
        setQuery("");
        setSelectedId(null);
        router.refresh();
      }
    });
  }

  if (linked.length > 0) {
    return (
      <div className="space-y-2">
        {linked.map((r) => (
          <div
            key={r.id}
            className="rounded-[2px] bg-card ring-1 ring-border p-3"
          >
            <p className="text-xs font-semibold text-foreground">{r.name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {[
                r.unitNumber ? `Unit ${r.unitNumber}` : null,
                r.leaseStart
                  ? `Lease from ${new Date(r.leaseStart).toLocaleDateString()}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Linked resident"}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => call("DELETE", r.id)}
              className="mt-2 text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-60"
            >
              Unlink
            </button>
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">
              Unlinking removes the proof from reports. The lead stays Signed
              until you change its status above.
            </p>
          </div>
        ))}
        {error ? <p className="text-xs text-[var(--error)]">{error}</p> : null}
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No residents available to link yet. Residents appear here once your
        property-management data is connected.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Signed a lease? Pick the resident record to prove the chain from this
        lead to the signed lease.
      </p>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedId(null);
        }}
        placeholder="Search residents by name or unit"
        aria-label="Search residents"
        className={cn(
          "w-full rounded-[2px] bg-card px-3 py-2 text-xs",
          "text-foreground placeholder:text-muted-foreground",
          "ring-1 ring-border focus:outline-none focus:ring-primary",
        )}
        disabled={pending}
      />
      <ul className="space-y-1">
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
              className={cn(
                "w-full rounded-[2px] px-2.5 py-2 text-left text-xs ring-1",
                selectedId === c.id
                  ? "ring-primary bg-primary/[0.06] text-foreground"
                  : "ring-border bg-card text-foreground hover:bg-muted/40",
              )}
            >
              <span className="font-medium">{c.name}</span>
              <span className="ml-2 text-[10.5px] text-muted-foreground">
                {[
                  c.unitNumber ? `Unit ${c.unitNumber}` : null,
                  c.propertyName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="px-1 text-[11px] text-muted-foreground">
            No residents match &ldquo;{query}&rdquo;.
          </li>
        ) : null}
      </ul>
      <button
        type="button"
        disabled={pending || !selectedId}
        onClick={() => selectedId && call("POST", selectedId)}
        className="ls-btn-primary w-full px-3 py-2 text-xs font-semibold disabled:opacity-50"
      >
        {pending ? "Linking…" : "Mark as signed"}
      </button>
      <p className="text-[10.5px] text-muted-foreground">
        Linking marks this lead as Signed and cites the resident&rsquo;s lease
        as proof in reports.
      </p>
      {error ? <p className="text-xs text-[var(--error)]">{error}</p> : null}
    </div>
  );
}
