"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";

// Thin Radix Dialog wrapper: focus trap, Escape, scroll lock, focus restore,
// and role="dialog"/aria-modal come from Radix. No built-in close button or
// header; callers keep their own chrome and pass sizing via className.
// Always render a DialogTitle (use className="sr-only" if the design has no
// visible title) so assistive tech announces the dialog.

const Dialog = DialogPrimitive.Root;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;
const DialogClose = DialogPrimitive.Close;

function DialogContent({
  className,
  children,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  overlayClassName?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn("fixed inset-0 z-50 bg-black/40", overlayClassName)}
      />
      <DialogPrimitive.Content
        // Callers that have no description opt out of Radix's warning.
        aria-describedby={undefined}
        className={cn(
          "fixed z-50 w-[calc(100%-2rem)] focus:outline-none",
          "inset-x-4 bottom-4 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose };
