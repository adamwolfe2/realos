"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setAdRetentionOverride } from "@/app/portal/ads/retention-actions";

// ---------------------------------------------------------------------------
// AdRetentionPanel — operator-facing summary of the tier's history policy.
//
// Read-only for Foundation + Growth (the resolver ignores overrides on
// those tiers anyway). Scale + Enterprise get an editable "months of
// daily granularity" field; null/empty reverts to the tier default.
//
// The CSV export link is always visible — every tier can download whatever
// history they have, even if the daily window is short.
// ---------------------------------------------------------------------------

export type AdRetentionPanelProps = {
  tier: "foundation" | "growth" | "scale" | "enterprise";
  dailyWindowMonths: number;
  monthlyEnabled: boolean;
  /** Operator-set override; null = using tier default. */
  customOverride: number | null;
  /** True if the current user is allowed to write the override. */
  canEdit: boolean;
  summary: string;
};

const TIER_LABEL: Record<AdRetentionPanelProps["tier"], string> = {
  foundation: "Foundation",
  growth: "Growth",
  scale: "Scale",
  enterprise: "Enterprise",
};

export function AdRetentionPanel(props: AdRetentionPanelProps) {
  const supportsOverride =
    props.tier === "scale" || props.tier === "enterprise";

  const [value, setValue] = React.useState<string>(
    props.customOverride != null ? String(props.customOverride) : "",
  );
  const [isPending, startTransition] = React.useTransition();

  const placeholder =
    supportsOverride
      ? `${props.tier === "enterprise" ? 24 : 24} (tier default)`
      : "";

  function handleSave() {
    const trimmed = value.trim();
    let next: number | null;
    if (trimmed === "") {
      next = null;
    } else {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 1 || n > 120) {
        toast.error("Enter a whole number between 1 and 120 months.");
        return;
      }
      next = Math.floor(n);
    }
    startTransition(async () => {
      const r = await setAdRetentionOverride(next);
      if ("error" in r && r.error) {
        toast.error(r.error);
      } else {
        toast.success(
          next == null
            ? "Reverted to tier default."
            : `Daily window set to ${next} months.`,
        );
      }
    });
  }

  return (
    <section
      aria-labelledby="ad-retention-heading"
      className="rounded-xl border bg-card text-card-foreground p-5 space-y-4"
    >
      <header className="flex items-start gap-3">
        <div className="rounded-md bg-muted/60 p-2">
          <Database className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            id="ad-retention-heading"
            className="text-sm font-semibold leading-tight"
          >
            Data retention
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {TIER_LABEL[props.tier]} plan
          </p>
        </div>
      </header>

      <p className="text-sm text-foreground">{props.summary}</p>

      {supportsOverride && (
        <div className="space-y-2 pt-2 border-t border-border">
          <label
            htmlFor="ad-retention-months"
            className="text-xs font-medium text-foreground"
          >
            Daily window (months)
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="ad-retention-months"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              disabled={!props.canEdit || isPending}
              className="h-8 w-24 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={!props.canEdit || isPending}
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
            {props.customOverride != null && (
              <span className="text-xs text-muted-foreground">
                override active
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {props.canEdit
              ? "Leave blank to use the tier default. Older data still rolls up to monthly buckets."
              : "Ask an admin to change this."}
          </p>
        </div>
      )}

      <div className="pt-2 border-t border-border">
        <Link
          href="/api/portal/ads/export"
          prefetch={false}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-foreground/80 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export historical CSV
        </Link>
        <p className="text-[11px] text-muted-foreground mt-1">
          Daily + monthly rows. Limited to one download per hour per workspace.
        </p>
      </div>
    </section>
  );
}
