"use client";

import { useEffect, useState } from "react";

// Live "Webhook last received Xs ago" badge for the Cursive integration
// surface. Reads CursiveIntegration.lastEventAt and renders compact
// relative time that ticks every 15s so an operator watching the page
// during install sees the counter advance the moment the upstream
// pixel fires its first event.
//
// Why ticks client-side instead of just rendering once on the server:
// the user installs the snippet, switches to the upstream provider to
// click Test, then flips back to LeaseStack. With pure-SSR labels
// they'd have to refresh to see the verification flip. Cheap
// setInterval keeps the badge honest
// without re-fetching the integration row every tick — the page revalidates
// on its own router cadence to pull the new timestamp.

type Props = {
  // Serialized ISO timestamp so client + server boundary stays explicit.
  // null = no events yet, integration sits in "Pending verification".
  lastEventAtIso: string | null;
  totalEventsCount?: number;
};

export function CursiveWebhookBadge({ lastEventAtIso, totalEventsCount }: Props) {
  const verified = Boolean(lastEventAtIso);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    // Only need to tick when we're displaying a relative time. Pre-verify
    // there's nothing to recompute so we skip the interval entirely.
    if (!lastEventAtIso) return;
    const id = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [lastEventAtIso]);

  if (!verified) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <span className="text-[11px] font-medium text-amber-700">
          Pending verification — waiting for first event
        </span>
      </div>
    );
  }

  const ageMs = nowMs - new Date(lastEventAtIso as string).getTime();
  const label = formatRelativeAge(ageMs);
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1">
      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      <span className="text-[11px] font-medium text-emerald-700">
        Last event {label}
        {typeof totalEventsCount === "number" && totalEventsCount > 0
          ? ` · ${totalEventsCount.toLocaleString()} total`
          : ""}
      </span>
    </div>
  );
}

// Short, ticker-friendly relative-age formatter. Distinct from
// lib/sync/freshness.formatAge() which rounds to whole minutes —
// for the install-day "is it working yet" experience operators want
// to see seconds tick by during the first minute.
function formatRelativeAge(ageMs: number): string {
  if (ageMs < 0) return "just now";
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
