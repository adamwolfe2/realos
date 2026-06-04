"use client";

import { useFormStatus } from "react-dom";

// Client submit button for the brief-generation form. The action runs
// for ~60-120 sec end-to-end (AEO scan × 4 engines × 5 prompts + AI
// Overview + Firecrawl render + page health) — without explicit
// pending UI the operator clicks Generate, nothing visibly changes,
// and they assume the button is broken.
//
// useFormStatus reflects the in-flight server action and gates the
// button + surfaces a progress hint. Keep the messaging warm — long
// waits are tolerable when you know what's happening.

export function GenerateBriefSubmit() {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center h-10 px-6 rounded-md text-[13px] font-semibold text-white disabled:opacity-70 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#2563EB" }}
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin"
              aria-hidden
            />
            Generating brief…
          </span>
        ) : (
          "Generate brief"
        )}
      </button>
      <p className="text-[11.5px] text-muted-foreground leading-snug">
        {pending
          ? "Scanning ChatGPT, Perplexity, Gemini, Google AI Overview, plus Firecrawl page render. Keep this tab open — you'll land on the share URL when it's ready (≈60-120 sec)."
          : "You'll be redirected to the share URL when it's ready (≈90 sec)."}
      </p>
    </div>
  );
}
