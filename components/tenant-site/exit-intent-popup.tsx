"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export function ExitIntentPopup({
  orgId,
  headline,
  body,
  ctaText,
  offerCode,
}: {
  orgId: string;
  headline: string | null;
  body: string | null;
  ctaText: string | null;
  offerCode: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Radix portals to <body>, outside the tenant wrapper that defines
  // --tenant-primary. Read the resolved value from a sentinel inside the
  // wrapper and re-apply it on the dialog content.
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const [tenantPrimary, setTenantPrimary] = useState<string | undefined>();

  useEffect(() => {
    if (!open || !sentinelRef.current) return;
    const v = getComputedStyle(sentinelRef.current)
      .getPropertyValue("--tenant-primary")
      .trim();
    if (v) setTenantPrimary(v);
  }, [open]);

  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        window.sessionStorage.getItem("leasestack.exitIntentShown")
      ) {
        setDismissed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (dismissed) return;
    function onMouseLeave(e: MouseEvent) {
      if (e.clientY < 10) {
        setOpen(true);
        setDismissed(true);
        try {
          window.sessionStorage.setItem("leasestack.exitIntentShown", "1");
        } catch {
          // ignore
        }
      }
    }
    document.addEventListener("mouseleave", onMouseLeave);
    return () => document.removeEventListener("mouseleave", onMouseLeave);
  }, [dismissed]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    if (!email) {
      setError("Email required");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          email,
          source: "FORM",
          sourceDetail: offerCode
            ? `exit_intent:${offerCode}`
            : "exit_intent",
        }),
      });
      if (!res.ok) throw new Error(`Submit failed (${res.status})`);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <span ref={sentinelRef} hidden aria-hidden="true" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          overlayClassName="bg-black/60"
          className="bg-white rounded-lg max-w-md p-6 md:p-8 shadow-2xl"
          style={
            tenantPrimary
              ? ({ "--tenant-primary": tenantPrimary } as React.CSSProperties)
              : undefined
          }
        >
        {submitted ? (
          <div className="text-center py-4">
            <DialogTitle className="font-serif text-2xl font-bold mb-2">
              Got it, thanks.
            </DialogTitle>
            <p className="text-sm opacity-70">
              We'll email you when the next term opens up.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 text-sm underline"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <DialogTitle className="font-serif text-2xl font-bold mb-2">
              {headline ?? "Before you go."}
            </DialogTitle>
            <p className="text-sm opacity-80 mb-5">
              {body ??
                "Drop your email and we'll send you next term's openings the moment they're live."}
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input
                name="email"
                type="email"
                required
                aria-label="Email address"
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 text-sm font-semibold rounded"
                style={{
                  backgroundColor: "var(--tenant-primary)",
                  color: "white",
                }}
              >
                {submitting ? "Sending…" : ctaText ?? "Send me updates"}
              </button>
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
            </form>
          </>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
}
