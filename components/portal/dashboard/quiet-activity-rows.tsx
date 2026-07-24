import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ActivityItem } from "@/components/portal/dashboard/activity-feed";

// ---------------------------------------------------------------------------
// QuietActivityRows — the dashboard's activity feed shrunk from a standalone
// card with a timeline rail down to 3 icon-less one-line rows under the
// attention queue. The full ActivityFeed component (with icons + collapsed
// runs) still lives on the property-level tabs; this is a deliberately
// quieter summary for the home dashboard.
// ---------------------------------------------------------------------------

export function QuietActivityRows({ items }: { items: ActivityItem[] }) {
  const visible = items.slice(0, 3);

  return (
    <div className="ls-card p-4">
      <div className="ls-eyebrow mb-2">Recent</div>
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Quiet so far. New leads, tours, and visitor activity will show up
          here.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-2 text-[12px]"
            >
              <span className="min-w-0 truncate text-foreground">
                {item.title}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatDistanceToNow(item.at, { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/portal/leads"
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
      >
        Open leads
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}
