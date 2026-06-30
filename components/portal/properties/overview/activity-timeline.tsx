import {
  Activity,
  CalendarCheck,
  FileSignature,
  FileText,
  Star,
  UserPlus,
} from "lucide-react";
import type {
  ActivityEvent,
  ActivityKind,
  ActivityLeadRow,
  ActivityLeaseRow,
  ActivityMentionRow,
  ActivityTourRow,
} from "./types";

// ---------------------------------------------------------------------------
// Activity timeline — unified feed across leads, tours, leases, mentions.
// ---------------------------------------------------------------------------

function fullName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  const joined = [f, l].filter(Boolean).join(" ");
  return joined.length > 0 ? joined : "Someone";
}

function sourceWord(source: string): string {
  const map: Record<string, string> = {
    GOOGLE_ADS: "Google Ads",
    META_ADS: "Meta Ads",
    ORGANIC: "organic",
    CHATBOT: "the chatbot",
    FORM: "the web form",
    PIXEL_OUTREACH: "pixel outreach",
    REFERRAL: "a referral",
    DIRECT: "direct",
    EMAIL_CAMPAIGN: "email",
    COLD_EMAIL: "cold email",
    MANUAL: "manual entry",
    OTHER: "other",
  };
  return map[source] ?? source.replace(/_/g, " ").toLowerCase();
}

export function buildActivityEvents({
  leads,
  tours,
  // Lease activity intentionally not rendered in the timeline. Norman
  // feedback (issue #73): "Lease signed" / renewal-sent events are
  // rent-roll reporting territory and pull focus from marketing-side
  // signals (leads, tours, applications, reviews). The query still runs
  // so we can re-enable cheaply if/when we add an ops-flavoured view.
  leases: _leases,
  mentions,
}: {
  leads: ActivityLeadRow[];
  tours: ActivityTourRow[];
  leases: ActivityLeaseRow[];
  mentions: ActivityMentionRow[];
}): ActivityEvent[] {
  void _leases;
  const events: ActivityEvent[] = [];

  for (const l of leads) {
    events.push({
      id: `lead:${l.id}`,
      kind: "lead",
      summary: `${fullName(l.firstName, l.lastName)} came in via ${sourceWord(l.source)}`,
      occurredAt: l.createdAt,
    });
  }

  for (const t of tours) {
    const who = fullName(t.lead?.firstName, t.lead?.lastName);
    let summary = `${who} requested a tour`;
    if (t.status === "SCHEDULED" || t.status === "REQUESTED") {
      summary = t.scheduledAt
        ? `${who} scheduled a tour for ${formatShortDate(t.scheduledAt)}`
        : `${who} requested a tour`;
    } else if (t.status === "COMPLETED") {
      summary = `${who} completed a tour`;
    } else if (t.status === "NO_SHOW") {
      summary = `${who} no-showed for tour`;
    } else if (t.status === "CANCELLED") {
      summary = `${who} cancelled a tour`;
    }
    events.push({
      id: `tour:${t.id}`,
      kind: "tour",
      summary,
      occurredAt: t.createdAt,
    });
  }

  // Lease loop intentionally omitted — see "leases: _leases" comment above.

  for (const m of mentions) {
    const who = m.authorName ?? "Someone";
    const sourceLabel =
      m.source === "GOOGLE_REVIEW"
        ? "Google"
        : m.source === "YELP"
          ? "Yelp"
          : m.source === "REDDIT"
            ? "Reddit"
            : m.source === "FACEBOOK_PUBLIC"
              ? "Facebook"
              : "web";
    const rating = m.rating != null ? ` (${m.rating}★)` : "";
    events.push({
      id: `mention:${m.id}`,
      kind: "review",
      summary: `${who} left a ${sourceLabel} review${rating}`,
      occurredAt: m.publishedAt ?? m.createdAt,
    });
  }

  events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return events.slice(0, 8);
}

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Activity
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            Recent events
          </h3>
        </div>
        {events.length > 0 ? (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Latest {events.length}
          </span>
        ) : null}
      </div>

      {events.length === 0 ? (
        <div className="flex items-center gap-2.5 px-1 py-3 text-muted-foreground">
          <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-[12px] leading-snug">
            Activity appears as leads, tours, and leases come in.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <ActivityRow key={e.id} event={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const { Icon, tone } = activityVisual(event.kind);
  return (
    <li className="flex items-start gap-3 min-w-0">
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${tone}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 flex items-baseline justify-between gap-3">
        <p className="text-[12.5px] text-foreground leading-snug truncate">
          {event.summary}
        </p>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {formatAgeShort(event.occurredAt)}
        </span>
      </div>
    </li>
  );
}

function activityVisual(kind: ActivityKind): {
  Icon: typeof UserPlus;
  tone: string;
} {
  switch (kind) {
    case "lead":
      return { Icon: UserPlus, tone: "bg-primary/10 text-primary" };
    case "tour":
      return { Icon: CalendarCheck, tone: "bg-primary/10 text-primary" };
    case "lease":
      return { Icon: FileSignature, tone: "bg-muted text-foreground" };
    case "renewal":
      return { Icon: FileText, tone: "bg-amber-500/10 text-amber-600" };
    case "notice":
      return { Icon: FileText, tone: "bg-amber-500/10 text-amber-600" };
    case "review":
      return { Icon: Star, tone: "bg-muted text-muted-foreground" };
  }
}

// Tighter timestamp for activity rows — no "ago" suffix to keep the
// right-rail width predictable.
function formatAgeShort(date: Date): string {
  const ms = date.getTime() - Date.now();
  const past = ms <= 0;
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60000);
  if (past) {
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 14) return `${days}d`;
    return formatShortDate(date);
  }
  // Future (scheduled tour, lease end). Show calendar date.
  return formatShortDate(date);
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
