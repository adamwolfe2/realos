"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// SideDrawer — the canonical "show me detail on this row" surface used
// across Leads, Visitors, Renewals, Conversations, Insights, Reports.
// Wraps the shadcn Sheet primitive with our portal chrome:
//
//   • opens from the right (default) at 480px — wider than the Radix default
//     w-3/4 because operator detail surfaces fit a sidebar of stats + body
//   • SheetTitle is required (a11y) but visually flexible; pass a string for
//     the default chrome, or a node for richer hero (avatar + name + chip).
//   • Content scrolls; the optional `footer` slot stays sticky at the bottom
//     so primary actions ("Save", "Mark contacted") never scroll out of view.
//
// Usage:
//   const [openId, setOpenId] = useState<string | null>(null);
//   <SideDrawer
//     open={openId === lead.id}
//     onOpenChange={(o) => setOpenId(o ? lead.id : null)}
//     title={lead.name}
//     description={lead.email}
//     footer={<button className="btn-primary">Mark contacted</button>}
//   >
//     {/* lead detail content */}
//   </SideDrawer>
// ---------------------------------------------------------------------------

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary actions cluster — sticky at the bottom of the drawer. */
  footer?: React.ReactNode;
  /** Inline actions in the header (e.g. kebab menu, link to full page). */
  headerActions?: React.ReactNode;
  /** Sheet width — defaults to 480px. */
  width?: "sm" | "md" | "lg";
  /** Side to open from. Defaults to right; left is rare. */
  side?: "left" | "right";
  children: React.ReactNode;
  className?: string;
};

const WIDTH_TO_CLASS: Record<NonNullable<Props["width"]>, string> = {
  sm: "sm:max-w-md",       // ~448px
  md: "sm:max-w-[480px]",  // 480px — default
  lg: "sm:max-w-[560px]",  // ~560px
};

export function SideDrawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  headerActions,
  width = "md",
  side = "right",
  children,
  className,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "p-0 gap-0",
          // Radix default w-3/4 is too wide on desktop — operators want a
          // surgical sidebar, not a full-page takeover.
          "w-full",
          WIDTH_TO_CLASS[width],
          className,
        )}
      >
        {/* Header — fixed at top, includes title + optional headerActions
            cluster (e.g. kebab menu, deep-link to full page). */}
        <header className="shrink-0 flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base font-semibold leading-tight text-foreground">
              {title}
            </SheetTitle>
            {description ? (
              <SheetDescription className="mt-0.5 text-xs text-muted-foreground leading-snug">
                {description}
              </SheetDescription>
            ) : null}
          </div>
          {headerActions ? (
            // Spacer so the absolute-positioned X close button (rendered by
            // the underlying SheetContent) doesn't collide with our actions.
            <div className="shrink-0 flex items-center gap-1 pr-7">
              {headerActions}
            </div>
          ) : (
            <div className="shrink-0 w-7" aria-hidden="true" />
          )}
        </header>

        {/* Body — scrolls. Generous padding so dense detail still breathes. */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer — sticky, only rendered if actions are passed. */}
        {footer ? (
          <footer className="shrink-0 border-t border-border bg-card/60 px-5 py-3 flex items-center justify-end gap-2">
            {footer}
          </footer>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
