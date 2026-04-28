"use client";

import { useTransition } from "react";
import { cancelPixelRequest } from "@/lib/actions/pixel-requests";

export function CancelPixelRequestButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("Cancel this pixel request? The customer will not be notified.")) {
      return;
    }
    startTransition(async () => {
      await cancelPixelRequest({ requestId });
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
    >
      {pending ? "Cancelling…" : "Cancel"}
    </button>
  );
}
