"use client";

// ---------------------------------------------------------------------------
// GreetingAnimated — the per-word crossfade reveal for the dashboard
// greeting headline. Client-side wrapper so the parent server component
// (dashboard-greeting.tsx) stays pure server-rendered.
//
// Uses the pixel-point/animate-text `per-word-crossfade` spec — calm 700ms
// fade + 8px drift per word, 70ms stagger, ease 0.16,1,0.3,1. Reads as
// editorial polish on first paint, not a flashy intro.
// ---------------------------------------------------------------------------

import { PerWordCrossfade } from "@/components/ui/animate-text";

export function GreetingAnimated({
  greeting,
  subject,
}: {
  greeting: string;
  subject: string;
}) {
  return (
    <PerWordCrossfade>
      {greeting}, <span className="text-primary">{subject}</span>
    </PerWordCrossfade>
  );
}
