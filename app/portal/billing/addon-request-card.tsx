"use client";

import { useState } from "react";

// Landing card for /portal/billing?addon=<key>. Paid add-ons have no Stripe
// checkout yet (sales-led), so this records an activation request and emails
// ops instead of leaving the operator on a page that ignores the click.
// ponytail: replace with Stripe Checkout once ls_addon_* prices exist.
export function AddonRequestCard({
  moduleKey,
  name,
  tagline,
  monthlyPriceCents,
}: {
  moduleKey: string;
  name: string;
  tagline: string;
  monthlyPriceCents: number;
}) {
  const [state, setState] = useState<"idle" | "pending" | "sent" | "error">(
    "idle",
  );

  async function request() {
    setState("pending");
    try {
      const res = await fetch("/api/portal/marketplace/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey, intent: "activate" }),
      });
      const json = await res.json().catch(() => null);
      setState(res.ok && json?.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="rounded-lg border border-[var(--color-primary)] bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Add to your plan
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">
        {name}
        {monthlyPriceCents > 0 ? (
          <span className="ml-2 text-sm font-normal text-slate-500">
            ${(monthlyPriceCents / 100).toLocaleString()}/mo
          </span>
        ) : null}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{tagline}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={request}
          disabled={state === "pending" || state === "sent"}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {state === "sent" ? "Request sent" : "Request activation"}
        </button>
        <p className="text-sm text-slate-600" role="status">
          {state === "sent"
            ? "We will add it to your subscription and confirm by email within one business day."
            : state === "error"
              ? "That did not go through. Email team@leasestack.co and we will set it up."
              : "Nothing is charged until we confirm the change with you."}
        </p>
      </div>
    </section>
  );
}
