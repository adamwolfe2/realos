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

// ---------------------------------------------------------------------------
// ActivityFeed
//
// Right-rail rolling feed of "things that just happened" across the
// workspace. Each item is a typed event with a small color-coded icon, a
// one-line summary, and a timestamp. When real event sources land, the
// feed maps each event row to one of these item shapes.
// ---------------------------------------------------------------------------

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
  lead: "bg-emerald-50 text-emerald-700",
  tour: "bg-blue-50 text-blue-700",
  visitor: "bg-amber-50 text-amber-800",
  chatbot: "bg-violet-50 text-violet-700",
  campaign: "bg-rose-50 text-rose-700",
  application: "bg-indigo-50 text-indigo-700",
  milestone: "bg-[var(--warm-sand)] text-[var(--charcoal-warm)]",
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-[var(--stone-gray)]">
        Quiet so far. New leads, tours, and visitor activity will stream in here.
      </p>
    );
  }

  return (
    <ol className="relative pl-3 -my-1.5">
      {/* Vertical thread line */}
      <span
        aria-hidden="true"
        className="absolute left-[5px] top-2 bottom-2 w-px bg-[var(--border-cream)]"
      />
      {items.map((item) => {
        const Icon = ICON[item.kind];
        const Inner = (
          <div className="flex items-start gap-2.5 py-2">
            <span
              className={cn(
                "relative -ml-3 z-10 grid place-items-center h-6 w-6 rounded-full border border-[var(--border-cream)] bg-[var(--ivory)] shrink-0",
              )}
            >
              <span
                className={cn(
                  "grid place-items-center h-5 w-5 rounded-full",
                  TONE[item.kind],
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs leading-snug text-[var(--near-black)]">
                {item.title}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--stone-gray)]">
                <span>{formatDistanceToNow(item.at, { addSuffix: true })}</span>
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
                className="block rounded-md -mx-1 px-1 hover:bg-[var(--warm-sand)]/40 transition-colors"
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
