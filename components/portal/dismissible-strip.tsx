"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// ---------------------------------------------------------------------------
// DismissibleStrip — wraps a top-of-page banner with a session-scoped
// dismiss button. Dismissal state lives in sessionStorage so:
//   - Re-appears next sign-in (impersonation is security-critical; the
//     user should be re-confirmed they're acting in someone else's
//     context every session)
//   - Re-appears whenever the underlying condition changes (the key
//     includes a fingerprint of the banner content)
//
// Renders nothing during SSR / before the dismissal-state check
// completes, to avoid a flash of a banner that's about to be hidden.
// ---------------------------------------------------------------------------

export function DismissibleStrip({
  storageKey,
  children,
  className,
}: {
  storageKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setDismissed(false);
      return;
    }
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      setDismissed(stored === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (dismissed === null) return null; // Still resolving
  if (dismissed) return null;

  function handleDismiss() {
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Storage unavailable (private mode, etc.) — still hide for this render.
    }
    setDismissed(true);
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      {children}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss this notice"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 rounded hover:bg-foreground/10 transition-colors opacity-60 hover:opacity-100"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
