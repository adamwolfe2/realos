"use client";

import { useState } from "react";

// Buy button on /marketplace/[id]. Hits POST /api/marketplace/leads/[id]/checkout
// and redirects the browser to Stripe Checkout on success.

export function BuyLeadButton({
  leadId,
  priceCents,
}: {
  leadId: string;
  priceCents: number;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketplace/leads/${leadId}/checkout`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.error === "lead_unavailable"
            ? "This lead was just sold or expired."
            : data?.error === "stripe_not_configured"
              ? "Checkout is temporarily unavailable."
              : data?.error === "stripe_error" && data?.message
                ? `Stripe: ${data.message}`
                : "Could not start checkout. Try again.",
        );
        return;
      }
      if (data.alreadyOwned) {
        window.location.href = "/marketplace/buyer";
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setError("Unexpected response. Try again.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        style={{
          display: "block",
          width: "100%",
          textAlign: "center",
          padding: "11px 18px",
          borderRadius: "10px",
          backgroundColor: "#2563EB",
          color: "#fff",
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          fontWeight: 600,
          border: "none",
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.7 : 1,
          transition: "opacity 180ms ease",
        }}
      >
        {submitting ? "Starting checkout…" : `Buy lead — $${(priceCents / 100).toFixed(0)}`}
      </button>
      {error && (
        <p
          style={{
            color: "#B91C1C",
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            marginTop: "8px",
          }}
        >
          {error}
        </p>
      )}
    </>
  );
}
