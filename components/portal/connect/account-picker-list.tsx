"use client";

import * as React from "react";
import { AlertCircle, Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared primitives for the post-OAuth account pickers
// (/portal/connect/google-ads/select + /portal/connect/meta-ads/select).
//
// Both pickers previously hand-rolled near-identical radio-row lists that
// had already drifted (different badge colors, different disabled handling).
// One component now owns the row anatomy; the pickers only map their
// provider's account shape into AccountPickerItem.
//
// Carbon-forward: flat 2px radii, border-first selection state, no shadows.
// Blue marks selection (an action), never success.
// ---------------------------------------------------------------------------

const CONNECT_STEPS = ["Authorize", "Choose account", "Verify"] as const;

/**
 * ConnectStepper — the 3-step OAuth journey indicator. Kills the "silent
 * round-trip" disorientation: the operator lands back from Google/Meta and
 * immediately sees where they are (Authorize done, Choose account now,
 * Verify next).
 */
export function ConnectStepper({
  current,
  className,
}: {
  /** 1-based index of the active step (1 Authorize · 2 Choose account · 3 Verify). */
  current: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <ol
      aria-label="Connection progress"
      className={cn("flex items-center gap-2", className)}
    >
      {CONNECT_STEPS.map((step, i) => {
        const stepNumber = i + 1;
        const isDone = stepNumber < current;
        const isCurrent = stepNumber === current;
        return (
          <li key={step} className="flex items-center gap-2 min-w-0">
            {i > 0 ? (
              <span
                aria-hidden="true"
                className="h-px w-6 sm:w-10 shrink-0 bg-border"
              />
            ) : null}
            <span
              aria-current={isCurrent ? "step" : undefined}
              className="inline-flex items-center gap-1.5 min-w-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                  isDone && "bg-primary text-primary-foreground",
                  isCurrent && "border-2 border-primary text-primary",
                  !isDone && !isCurrent && "border border-border text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-3 w-3" strokeWidth={2.5} /> : stepNumber}
              </span>
              <span
                className={cn(
                  "truncate text-[11px]",
                  isCurrent
                    ? "font-semibold text-foreground"
                    : isDone
                      ? "font-medium text-foreground/80"
                      : "text-muted-foreground",
                )}
              >
                {step}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export type AccountPickerItem = {
  /** Stable external id — also the selection key. */
  id: string;
  name: string;
  icon: LucideIcon;
  /** Mono identifier line (account id · currency · etc). */
  detail: string;
  /** Optional inline badge. "warning" renders in the Carbon yellow family. */
  badge?: { label: string; tone: "neutral" | "warning" } | null;
  /** Disabled rows render but can't be selected — always pair with a reason. */
  disabled?: boolean;
  /** One-line explanation of why the row can't be bound. */
  disabledReason?: string | null;
};

export function AccountPickerList({
  items,
  selectedId,
  onSelect,
}: {
  items: AccountPickerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const isSelected = !item.disabled && item.id === selectedId;
        const Icon = item.icon;
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={item.disabled}
              aria-disabled={item.disabled || undefined}
              onClick={item.disabled ? undefined : () => onSelect(item.id)}
              className={cn(
                "w-full text-left rounded-[2px] border px-4 py-3 flex items-center gap-3 transition-colors",
                item.disabled
                  ? "border-dashed border-border bg-muted/30 cursor-not-allowed"
                  : isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-secondary",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isSelected ? "text-primary" : "text-muted-foreground",
                  item.disabled && "opacity-60",
                )}
                strokeWidth={1.75}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-sm font-medium truncate",
                      item.disabled ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {item.name}
                  </span>
                  {item.badge ? (
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wide rounded-[2px] px-1.5 py-0.5 inline-flex items-center gap-1",
                        item.badge.tone === "warning"
                          ? "border border-[#f1c21b]/60 bg-[rgba(241,194,27,0.16)] text-[#8a6d00]"
                          : "border border-border bg-background text-muted-foreground",
                      )}
                    >
                      {item.badge.tone === "warning" ? (
                        <AlertCircle className="h-2.5 w-2.5" />
                      ) : null}
                      {item.badge.label}
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "text-[11px] mt-0.5 font-mono",
                    item.disabled ? "text-muted-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {item.detail}
                </p>
                {item.disabled && item.disabledReason ? (
                  <p className="text-[11px] text-[#8a6d00] mt-1 leading-snug">
                    {item.disabledReason}
                  </p>
                ) : null}
              </div>
              {isSelected ? (
                <Check className="h-4 w-4 text-primary shrink-0" strokeWidth={2} />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
