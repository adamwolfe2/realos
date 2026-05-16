"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function RequestActivationButton({
  slug,
  name,
  state,
}: {
  slug: string;
  name: string;
  state: "available" | "requested";
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(state === "requested");

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/tenant/integration-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ integrationSlug: slug, message }),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b.error ?? `Failed (${res.status})`);
        }
        setSubmitted(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      }
    });
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
        <p className="text-sm font-medium text-primary">
          Activation requested.
        </p>
        <p className="text-xs text-primary/80 mt-1">
          Your account team has been notified. We'll email you when {name} is
          live in your portal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground">
          Anything we should know? (optional)
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder={`e.g. "We use ${name} on three properties. Already have OAuth creds ready."`}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className={cn(
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
          "bg-primary text-primary-foreground hover:bg-primary-dark",
          "disabled:opacity-60",
        )}
      >
        {pending ? "Requesting…" : `Request ${name} activation`}
      </button>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
