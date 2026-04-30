import { formatDistanceToNow, format } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  FileText,
  Globe,
  MessageCircle,
  Radar,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatTranscript } from "./chat-transcript";
import type { TimelineEvent } from "./timeline-events";

// ---------------------------------------------------------------------------
// Timeline — renders a vertical rail of events, newest first.
// The rail runs through the icon dot so adjacent events feel connected.
// ---------------------------------------------------------------------------

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-[12px] border border-border bg-card p-8 text-center">
        <p className="text-sm text-foreground">
          No activity yet. Install the Cursive pixel and enable the chatbot to
          see every touchpoint here.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative">
      {/* Vertical rail — centered behind the icon column (icon is w-9, so x = 18px) */}
      <div
        aria-hidden
        className="absolute left-[18px] top-3 bottom-3 w-px bg-[var(--border-warm)]"
      />
      {events.map((e) => (
        <li key={e.id} className="relative flex items-start gap-4 py-4">
          <EventIcon event={e} />
          <div className="flex-1 min-w-0 pt-1">
            <EventBody event={e} />
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Icon dot per event type
// ---------------------------------------------------------------------------

type IconConfig = { icon: LucideIcon; tone: "default" | "accent" | "success" };

function iconFor(event: TimelineEvent): IconConfig {
  switch (event.kind) {
    case "lead_created":
      return { icon: Sparkles, tone: "accent" };
    case "pixel_first_seen":
      return { icon: Radar, tone: "default" };
    case "pixel_page_view":
    case "pixel_page_rollup":
      return { icon: Globe, tone: "default" };
    case "chatbot_conversation":
      return { icon: MessageCircle, tone: "accent" };
    case "tour":
      return { icon: Calendar, tone: "default" };
    case "application":
      return { icon: FileText, tone: "default" };
    case "status_signed":
      return { icon: CheckCircle2, tone: "success" };
    case "review_request_sent":
      return { icon: Star, tone: "accent" };
  }
}

function EventIcon({ event }: { event: TimelineEvent }) {
  const { icon: Icon, tone } = iconFor(event);
  return (
    <div
      className={cn(
        "relative z-10 h-9 w-9 shrink-0 rounded-[10px]",
        "flex items-center justify-center",
        "bg-card ring-1",
        tone === "accent" && "ring-primary text-primary",
        tone === "success" && "ring-[var(--success)] text-[var(--success)]",
        tone === "default" &&
          "ring-border text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body renderer per event kind
// ---------------------------------------------------------------------------

function timeLabel(ts: Date): string {
  return formatDistanceToNow(ts, { addSuffix: true });
}

function exactTime(ts: Date): string {
  return format(ts, "MMM d, yyyy 'at' h:mm a");
}

function EventBody({ event }: { event: TimelineEvent }) {
  return (
    <div className="rounded-[10px] px-3 py-2 transition-colors duration-200 hover:bg-card">
      {renderBody(event)}
    </div>
  );
}

function renderBody(event: TimelineEvent): React.ReactNode {
  switch (event.kind) {
    case "lead_created": {
      const detail = event.sourceDetail ? ` · ${event.sourceDetail}` : "";
      return (
        <>
          <p className="text-sm text-foreground">
            <span className="font-medium">Lead created</span> via{" "}
            <span className="text-foreground">{event.source}</span>
            {detail}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {timeLabel(event.ts)} · {exactTime(event.ts)}
          </p>
        </>
      );
    }
    case "pixel_first_seen": {
      const via = event.utmSource
        ? `UTM source ${event.utmSource}`
        : event.referrer
        ? `via ${event.referrer}`
        : "direct";
      return (
        <>
          <p className="text-sm text-foreground">
            <span className="font-medium">First pixel resolution</span>{" "}
            <span className="text-foreground">— {via}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {timeLabel(event.ts)}
          </p>
        </>
      );
    }
    case "pixel_page_view":
      return (
        <>
          <p className="text-sm text-foreground">
            Visited{" "}
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded-[6px] text-foreground">
              {event.path}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {timeLabel(event.ts)}
          </p>
        </>
      );
    case "pixel_page_rollup": {
      const preview = event.pages
        .slice(0, 3)
        .map((p) => p.path)
        .join(", ");
      const rest =
        event.pages.length > 3
          ? ` and ${event.pages.length - 3} more`
          : "";
      const durationMin = Math.max(
        1,
        Math.round(
          (event.ts.getTime() - event.startedAt.getTime()) / (60 * 1000)
        )
      );
      return (
        <>
          <p className="text-sm text-foreground">
            Browsed{" "}
            <span className="font-medium">{event.pages.length} pages</span> in
            one session
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {preview}
            {rest}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {timeLabel(event.ts)} · {durationMin} min session
          </p>
        </>
      );
    }
    case "chatbot_conversation": {
      const c = event.conversation;
      const minutes = Math.max(
        1,
        Math.round(
          (c.lastMessageAt.getTime() - c.createdAt.getTime()) / (60 * 1000)
        )
      );
      const persona = c.capturedName ? `with ${c.capturedName}` : "conversation";
      return (
        <>
          <p className="text-sm text-foreground">
            <span className="font-medium">Chatbot {persona}</span>
            {" — "}
            {c.messageCount} messages, {minutes} min
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {timeLabel(event.ts)}
            {c.capturedEmail ? ` · captured ${c.capturedEmail}` : ""}
          </p>
          <ChatTranscript rawMessages={c.messages} />
        </>
      );
    }
    case "tour": {
      const t = event.tour;
      const when = t.scheduledAt ? exactTime(t.scheduledAt) : "unscheduled";
      const type = t.tourType ?? "in person";
      return (
        <>
          <p className="text-sm text-foreground">
            <span className="font-medium">Tour {t.status.toLowerCase()}</span>
            {" — "}
            <span className="text-foreground">
              {type} · {when}
            </span>
          </p>
          {t.notes ? (
            <p className="mt-1 text-xs text-foreground line-clamp-3">
              {t.notes}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {timeLabel(event.ts)}
          </p>
        </>
      );
    }
    case "application": {
      const a = event.application;
      const verb = a.decidedAt
        ? `decided ${a.status.toLowerCase()}`
        : `${a.status.toLowerCase()}`;
      return (
        <>
          <p className="text-sm text-foreground">
            <span className="font-medium">Application {verb}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {timeLabel(event.ts)}
            {a.appliedAt
              ? ` · submitted ${format(a.appliedAt, "MMM d")}`
              : ""}
            {a.decidedAt
              ? ` · decided ${format(a.decidedAt, "MMM d")}`
              : ""}
          </p>
        </>
      );
    }
    case "status_signed":
      return (
        <>
          <p className="text-sm text-foreground">
            <span className="font-medium">Lease signed</span>{" "}
            <span className="text-[var(--success)]">— converted</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {timeLabel(event.ts)}
          </p>
        </>
      );
    case "review_request_sent":
      return (
        <>
          <p className="text-sm text-foreground">
            <span className="font-medium">Review request sent</span>{" "}
            <span className="text-muted-foreground">— Google review email</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {timeLabel(event.ts)} · {exactTime(event.ts)}
          </p>
        </>
      );
  }
}
