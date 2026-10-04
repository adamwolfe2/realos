"use client";

import { useEffect, useState } from "react";
import { StatusChip } from "@/components/portal/ui/status-chip";

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
      <StatusChip
        status="connecting"
        label="Pending verification — waiting for first event"
      />
    );
  }

  const ageMs = nowMs - new Date(lastEventAtIso as string).getTime();
  const label = formatRelativeAge(ageMs);
  return (
    <StatusChip
      status="live"
      label={`Last event ${label}${
        typeof totalEventsCount === "number" && totalEventsCount > 0
          ? ` · ${totalEventsCount.toLocaleString()} total`
          : ""
      }`}
    />
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
