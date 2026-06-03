"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Accept-and-pay button for /proposal/[token].
//
// POSTs to /api/proposals/[token]/accept which returns { redirectUrl }; the
// browser navigates from there into Stripe Checkout. On any failure we
// surface an inline error so the prospect knows to email the agency rather
// than refreshing into a half-paid state.
// ---------------------------------------------------------------------------

type AcceptResponse = { redirectUrl: string };

export function AcceptButton({
  token,
  label = "Accept & pay",
  agencyEmail,
}: {
  token: string;
  label?: string;
  agencyEmail: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proposals/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        },
      );
      if (!res.ok) {
        let message =
          "We couldn't start checkout right now. Please try again in a moment, or contact us.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          // Non-JSON body — keep generic message.
        }
        setError(message);
        setSubmitting(false);
        return;
      }
      const body = (await res.json()) as AcceptResponse;
      if (!body?.redirectUrl) {
        setError(
          "Checkout link missing. Please refresh or contact us to resend.",
        );
        setSubmitting(false);
        return;
      }
      // Navigate to Stripe Checkout. Use location.assign so the back button
      // returns the prospect to this proposal page (not to a half-loaded
      // intermediate state).
      window.location.assign(body.redirectUrl);
    } catch (_err) {
      setError(
        "We couldn't reach checkout. Check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="inline-flex w-full items-center justify-center rounded-md bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1D4ED8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        aria-busy={submitting}
      >
        {submitting ? "Starting checkout…" : label}
      </button>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}{" "}
          <a
            href={`mailto:${agencyEmail}?subject=Proposal%20checkout%20issue`}
            className="font-medium underline underline-offset-2"
          >
            Email us
          </a>
        </p>
      ) : null}
    </div>
  );
}
