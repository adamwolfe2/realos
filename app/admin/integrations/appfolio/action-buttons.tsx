"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminRunAppfolioSync,
  adminClearStuckSyncStatus,
  adminMarkPropertiesAppfolio,
  type AdminSyncResult,
} from "@/lib/actions/admin-appfolio";

type Variant = "sync" | "clear" | "attach";

export function AppfolioActionButton({
  orgId,
  variant,
  label,
  disabled,
}: {
  orgId: string;
  variant: Variant;
  label: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminSyncResult | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      let res: AdminSyncResult;
      switch (variant) {
        case "sync":
          res = await adminRunAppfolioSync(orgId);
          break;
        case "clear":
          res = await adminClearStuckSyncStatus(orgId);
          break;
        case "attach":
          res = await adminMarkPropertiesAppfolio(orgId);
          break;
      }
      setResult(res);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending || disabled}
        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted/50 disabled:opacity-40"
      >
        {pending ? "Running…" : label}
      </button>
      {result ? (
        result.ok ? (
          <span className="text-[10px] text-primary">
            {variant === "sync"
              ? `${result.stats.listingsUpserted} listings, ${result.stats.leadsUpserted} leads`
              : "Done"}
          </span>
        ) : (
          <span className="text-[10px] text-destructive">{result.error}</span>
        )
      ) : null}
    </div>
  );
}
