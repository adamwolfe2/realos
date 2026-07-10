import * as React from "react";
import Link from "next/link";
import {
  UserPlus,
  CalendarCheck,
  Eye,
  MessageSquare,
  Megaphone,
  FileText,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export type ActivityKind =
  | "lead"
  | "tour"
  | "visitor"
  | "chatbot"
  | "campaign"
  | "application"
  | "milestone";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: React.ReactNode;
  /** Plain string title used for run-grouping. If absent we fall back to
   *  React.ReactNode title which can't be compared safely. */
  groupKey?: string;
  meta?: React.ReactNode;
  href?: string;
  at: Date;
};

const ICON: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  lead: UserPlus,
  tour: CalendarCheck,
  visitor: Eye,
  chatbot: MessageSquare,
  campaign: Megaphone,
  application: FileText,
  milestone: Sparkles,
};

const TONE: Record<ActivityKind, string> = {
  lead: "bg-primary/10 text-primary",
  tour: "bg-primary/10 text-primary",
  visitor: "bg-primary/10 text-primary",
  chatbot: "bg-muted text-muted-foreground",
  campaign: "bg-muted text-muted-foreground",
  application: "bg-primary/10 text-primary",
  milestone: "bg-muted text-foreground",
};

// Premium-pass: pre-fix the feed rendered the same event 8x in a row
// ("Chatbot — Conversation started" * 8). The user's screenshot of the
// dashboard read as noise because every row was identical. We now collapse
// consecutive identical events of the same kind into a single row with a
// count + meta line (e.g. "Chatbot — 8 conversations started"). The
// underlying items stay typed the same; collapse is purely a render
// concern so callers don't need to change.
function collapseRuns(items: ActivityItem[]): Array<
  ActivityItem & { count: number; spanFrom?: Date }
> {
  const result: Array<ActivityItem & { count: number; spanFrom?: Date }> = [];
  for (const item of items) {
    const last = result[result.length - 1];
    // Group when (a) same kind, (b) same group key when supplied, (c)
    // titles match when group key absent. Avoids merging "Lead created"
    // with "Lead converted" just because both are kind=lead.
    const canGroup =
      last &&
      last.kind === item.kind &&
      (item.groupKey
        ? last.groupKey === item.groupKey
        : typeof last.title === "string" &&
          typeof item.title === "string" &&
          last.title === item.title);
    if (canGroup) {
      last.count += 1;
      // Keep the oldest event in the run as spanFrom so we can render
      // "8 over the last 2 days" instead of "8 just now".
      last.spanFrom = item.at;
      continue;
    }
    result.push({ ...item, count: 1 });
  }
  return result;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Quiet so far. New leads, tours, and visitor activity will stream in here.
      </p>
    );
  }

  const grouped = collapseRuns(items);

  return (
    <ol className="relative pl-3 -my-1.5">
      <span
        aria-hidden="true"
        className="absolute left-[5px] top-2 bottom-2 w-px bg-border"
      />
      {grouped.map((item) => {
        const Icon = ICON[item.kind];
        const isGroup = item.count > 1;
        // For a collapsed run, replace the title with the count form so
        // operators see "8 conversations started" instead of 8 identical
        // rows of "Conversation started".
        const renderedTitle = isGroup ? (
          <>
            <span className="font-semibold tabular-nums">{item.count}</span>{" "}
            {typeof item.title === "string"
              ? pluralizeRunTitle(item.title, item.count)
              : item.title}
          </>
        ) : (
          item.title
        );
        const Inner = (
          <div className="flex items-start gap-2.5 py-2">
            <span
              className={cn(
                "relative -ml-3 z-10 grid place-items-center h-5 w-5 rounded-full border border-border bg-card shrink-0",
              )}
            >
              <span
                className={cn(
                  "grid place-items-center h-4 w-4 rounded-full",
                  TONE[item.kind],
                )}
              >
                <Icon className="h-2.5 w-2.5" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs leading-snug text-foreground">
                {renderedTitle}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>
                  {item.spanFrom
                    ? `${formatDistanceToNow(item.spanFrom, { addSuffix: true })} → ${formatDistanceToNow(item.at, { addSuffix: true })}`
                    : formatDistanceToNow(item.at, { addSuffix: true })}
                </span>
                {item.meta ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{item.meta}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className="block rounded-md -mx-1 px-1 hover:bg-muted/40 transition-colors"
              >
                {Inner}
              </Link>
            ) : (
              Inner
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Very small singular → plural transform for the most common run titles
// the feed surfaces. Falls back to the original title if no rule matches
// (the caller should pass plural-safe copy for new event types).
function pluralizeRunTitle(title: string, count: number): string {
  if (count === 1) return title;
  // "Conversation started" → "conversations started"
  // "New lead" → "new leads"
  // "Tour scheduled" → "tours scheduled"
  const lc = title.charAt(0).toLowerCase() + title.slice(1);
  // Heuristic: split on first whitespace, pluralize first word if it's a
  // common singular noun the feed actually emits.
  const PLURALS: Record<string, string> = {
    conversation: "conversations",
    lead: "leads",
    visitor: "visitors",
    tour: "tours",
    application: "applications",
    campaign: "campaigns",
    mention: "mentions",
    review: "reviews",
  };
  const m = lc.match(/^(\w+)(\b.*)$/);
  if (!m) return lc;
  const first = m[1].toLowerCase();
  if (PLURALS[first]) {
    return `${PLURALS[first]}${m[2]}`;
  }
  // Try "New X" → "new Xs"
  if (first === "new") {
    return lc.endsWith("s") ? lc : `${lc}s`;
  }
  return lc;
}
