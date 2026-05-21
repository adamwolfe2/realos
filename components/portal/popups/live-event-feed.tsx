"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Eye, MousePointer2, X, Loader2 } from "lucide-react";

type EventType = "SHOWN" | "DISMISSED" | "CTA_CLICKED" | "CONVERTED";

interface RecentEvent {
  id: string;
  type: EventType;
  pageUrl: string | null;
  sessionId: string | null;
  occurredAt: string;
}

interface Props {
  campaignId: string;
}

const POLL_INTERVAL_MS = 3_000;
const MAX_RENDERED_EVENTS = 20;

/**
 * Real-time event feed for a popup campaign.
 *
 * Polls /api/portal/popups/{id}/recent-events every 3s and renders
 * the most recent SHOWN / DISMISSED / CTA_CLICKED / CONVERTED events.
 * Operator opens this page in one tab, hits their website (or the
 * preview link) in another, and sees events arrive live with a
 * subtle highlight on the new row.
 *
 * Polling-not-SSE because the volume of events for a single popup is
 * very low (handful per hour at most for most tenants), and polling
 * survives stale connections, NAT timeouts, and Next.js route
 * handler limits more gracefully than long-lived SSE streams.
 */
export function LiveEventFeed({ campaignId }: Props) {
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  // Track the IDs we've already rendered so we can highlight new
  // arrivals without flashing on every poll.
  const seenIds = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/portal/popups/${encodeURIComponent(campaignId)}/recent-events`,
        { method: "GET", credentials: "same-origin", cache: "no-store" },
      );
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { events: RecentEvent[] };
      const fresh = data.events ?? [];

      // Compute the set of newly-arrived event IDs (in fresh, not in seen).
      const incoming = new Set<string>();
      for (const e of fresh) if (!seenIds.current.has(e.id)) incoming.add(e.id);

      if (incoming.size > 0) {
        setNewIds(incoming);
        for (const id of incoming) seenIds.current.add(id);
        // Drop the highlight after 2s so the next poll's "new" set
        // doesn't double-up.
        setTimeout(() => setNewIds(new Set()), 2_000);
      }

      setEvents(fresh.slice(0, MAX_RENDERED_EVENTS));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchEvents();
    if (paused) return;
    const id = window.setInterval(fetchEvents, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchEvents, paused]);

  return (
    <div className="rounded-xl border border-border bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-emerald-600" />
          <h3 className="text-[12.5px] font-semibold text-foreground">Live activity</h3>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            {paused ? "paused" : "live"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            last 30 min · refreshes every {POLL_INTERVAL_MS / 1000}s
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </header>

      <div className="max-h-72 overflow-y-auto">
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading recent events…
          </div>
        ) : error && events.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
            Couldn&apos;t load events ({error}). Will retry on the next tick.
          </p>
        ) : events.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
            <p>No events in the last 30 minutes.</p>
            <p className="mt-1 text-[11px]">
              Use <strong>Preview on live site</strong> or <strong>Test-fire</strong> above to send a synthetic event.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((e) => (
              <EventRow key={e.id} event={e} highlight={newIds.has(e.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EventRow({ event, highlight }: { event: RecentEvent; highlight: boolean }) {
  const { Icon, tone, label } = eventStyle(event.type);
  const isTestFire = event.pageUrl === "[portal-test-fire]" || (event.sessionId ?? "").startsWith("operator-test-");

  return (
    <li
      className={`flex items-start gap-2 px-3 py-2 text-[12px] transition-colors ${
        highlight ? "bg-emerald-50" : "bg-transparent"
      }`}
    >
      <Icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${tone}`} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          {label}
          {isTestFire ? (
            <span className="ml-2 rounded-full bg-foreground/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Test fire
            </span>
          ) : null}
        </p>
        {event.pageUrl && !isTestFire ? (
          <p className="truncate text-[11px] text-muted-foreground">{event.pageUrl}</p>
        ) : null}
      </div>
      <time className="flex-shrink-0 text-[11px] text-muted-foreground" dateTime={event.occurredAt}>
        {formatRelative(event.occurredAt)}
      </time>
    </li>
  );
}

function eventStyle(type: EventType): { Icon: typeof Eye; tone: string; label: string } {
  switch (type) {
    case "SHOWN":
      return { Icon: Eye, tone: "text-blue-600", label: "Shown" };
    case "DISMISSED":
      return { Icon: X, tone: "text-muted-foreground", label: "Dismissed" };
    case "CTA_CLICKED":
      return { Icon: MousePointer2, tone: "text-emerald-600", label: "CTA clicked" };
    case "CONVERTED":
      return { Icon: MousePointer2, tone: "text-emerald-600", label: "Converted (lead captured)" };
    default:
      return { Icon: Eye, tone: "text-muted-foreground", label: type };
  }
}

function formatRelative(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
