"use client";

import { useState, useTransition } from "react";
import {
  toggleClientModule,
  type ToggleableModule,
} from "@/lib/actions/admin-modules";

export function ModuleToggle({
  orgId,
  module,
  label,
  initialEnabled,
}: {
  orgId: string;
  module: ToggleableModule;
  label: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    if (pending) return;
    setError(null);
    const next = !enabled;
    setEnabled(next); // optimistic
    startTransition(async () => {
      const res = await toggleClientModule({
        orgId,
        module,
        enabled: next,
      });
      if (!res.ok) {
        setEnabled(!next); // rollback
        setError(res.error);
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {error ? (
          <span className="text-[10px] text-destructive">{error}</span>
        ) : null}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`Toggle ${label}`}
          disabled={pending}
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-primary/5" : "bg-foreground/20"
          } disabled:opacity-50`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-[18px]" : "translate-x-[2px]"
            }`}
          />
        </button>
      </div>
    </li>
  );
}
