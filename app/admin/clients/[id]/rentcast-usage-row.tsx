"use client";

import { useState, useTransition } from "react";
import { updateRentCastBudget } from "@/lib/actions/admin-rentcast";

// ---------------------------------------------------------------------------
// Admin breadcrumb row — surfaces RentCast usage on /admin/clients/[id]
// so operators can spot a runaway tenant at a glance. Budget is editable
// inline (admin-gated via the server action's `requireAgency` call).
// ---------------------------------------------------------------------------

type Props = {
  orgId: string;
  used: number;
  initialBudget: number;
  monthKey: string;
};

export function RentCastUsageRow({ orgId, used, initialBudget, monthKey }: Props) {
  const [budget, setBudget] = useState<string>(String(initialBudget));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);

  function onSave() {
    if (pending) return;
    setError(null);
    setSaved(false);
    const parsed = Number(budget);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a non-negative number.");
      return;
    }
    startTransition(async () => {
      const res = await updateRentCastBudget({
        orgId,
        monthlyBudget: Math.floor(parsed),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  const overBudget = used > Number(budget || 0);

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <div className="min-w-0">
        <div className="text-foreground">RentCast usage</div>
        <div className="text-[11px] text-muted-foreground">
          {used} / {budget} this month ({monthKey}) ·{" "}
          {overBudget ? "Over budget" : "Within budget"}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {error ? (
          <span className="text-[10px] text-destructive">{error}</span>
        ) : null}
        {saved ? (
          <span className="text-[10px] text-emerald-700">Saved</span>
        ) : null}
        <input
          type="number"
          min={0}
          step={1}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          disabled={pending}
          className="w-20 rounded border border-[var(--hair)] bg-background px-2 py-1 text-right text-[12px] tabular-nums"
          aria-label="RentCast monthly budget"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={pending || budget === String(initialBudget)}
          className="rounded-md border border-[var(--hair)] bg-background px-2.5 py-1 text-[11.5px] text-foreground hover:bg-muted/40 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
