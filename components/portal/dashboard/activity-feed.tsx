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
  milestone: "bg-muted text-foreground",
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Quiet so far. New leads, tours, and visitor activity will stream in here.
      </p>
    );
  }

  return (
    <ol className="relative pl-3 -my-1.5">
      <span
        aria-hidden="true"
        className="absolute left-[5px] top-2 bottom-2 w-px bg-border"
      />
      {items.map((item) => {
        const Icon = ICON[item.kind];
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
                {item.title}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
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
