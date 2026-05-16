"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleChatbotEnabled } from "@/lib/actions/chatbot-config";

export function MasterToggle({
  enabled,
  moduleActive,
}: {
  enabled: boolean;
  moduleActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  function flip() {
    if (!moduleActive) return;
    const next = !optimistic;
    setOptimistic(next);
    setError(null);
    startTransition(async () => {
      const result = await toggleChatbotEnabled(next);
      if (!result.ok) {
        setError(result.error);
        setOptimistic(!next);
        return;
      }
      router.refresh();
    });
  }

  const live = optimistic && moduleActive;

  return (
    <section className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold">Widget status</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Master switch for the embedded chatbot widget. When off, the
          install script silently does nothing on your site.
        </p>
        {error ? (
          <p className="text-xs text-destructive mt-2">{error}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-semibold ${
            live ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {live ? "On" : "Off"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={live}
          aria-label="Toggle chatbot"
          disabled={!moduleActive || pending}
          onClick={flip}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            live ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
              live ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
