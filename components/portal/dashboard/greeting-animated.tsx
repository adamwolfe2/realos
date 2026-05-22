"use client";

// ---------------------------------------------------------------------------
// GreetingAnimated — the per-word crossfade reveal for the dashboard
// greeting headline. Client-side wrapper so the parent server component
// (dashboard-greeting.tsx) stays pure server-rendered.
//
// Uses the pixel-point/animate-text `per-word-crossfade` spec — calm 700ms
// fade + 8px drift per word, 70ms stagger, ease 0.16,1,0.3,1. Reads as
// editorial polish on first paint, not a flashy intro.
//
// Norman bug #109: timezone was previously computed server-side using
// the Vercel function's UTC clock (and then a Pacific override that
// still missed any operator outside America/Los_Angeles — Norman is
// Eastern). The parent server component still passes a fallback
// greeting so SSR renders a sensible value, but we recompute on the
// client using the browser's actual hour so "Good morning / afternoon
// / evening" matches the operator's wall clock.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { PerWordCrossfade } from "@/components/ui/animate-text";

function localGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function GreetingAnimated({
  greeting,
  subject,
}: {
  greeting: string;
  subject: string;
}) {
  // SSR renders the server-side greeting so the headline is filled on
  // first paint (no flash). After hydration we swap to the browser-local
  // greeting if it differs, so an Eastern operator at 6pm sees "Good
  // evening" instead of the Vercel-UTC default.
  const [resolved, setResolved] = useState(greeting);
  useEffect(() => {
    setResolved(localGreeting());
  }, []);

  return (
    <PerWordCrossfade>
      {resolved}, <span className="text-primary">{subject}</span>
    </PerWordCrossfade>
  );
}
