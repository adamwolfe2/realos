import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Sparkles, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

type ActivityItem = {
  id: string;
  kind: "rec_status" | "draft_event" | "rec_created";
  /** ISO timestamp */
  occurredAt: string;
  title: string;
  detail: string | null;
  href: string | null;
  tone: "neutral" | "positive" | "warning";
};

type Props = {
  items: ActivityItem[];
};

const ICON_MAP: Record<ActivityItem["kind"], typeof Sparkles> = {
  rec_status: Sparkles,
  draft_event: FileText,
  rec_created: AlertCircle,
};

const TONE_STYLES: Record<ActivityItem["tone"], { icon: string }> = {
  neutral: { icon: "text-muted-foreground" },
  positive: { icon: "text-green-600" },
  warning: { icon: "text-amber-600" },
};

// ---------------------------------------------------------------------------
// PropertyActivityFeed — compact recent-events surface on the property
// detail page. Pulls from AuditEvent (SeoActionRecommendation +
// ContentDraft entity types) plus ContentDraft state changes.
//
// Server component — no client JS. Hidden when there are no events.
// Built so an operator can answer "what happened with my SEO this
// week?" without leaving the property page.
// ---------------------------------------------------------------------------
export function PropertyActivityFeed({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
            Recent activity
          </p>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">
            What happened in the last 14 days
          </h3>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
          {items.length}
        </span>
      </header>
      <ul className="divide-y divide-border/60">
        {items.slice(0, 10).map((item) => {
          const Icon = ICON_MAP[item.kind] ?? CheckCircle2;
          const iconTone = TONE_STYLES[item.tone].icon;
          return (
            <li key={item.id} className="px-4 py-2.5">
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-start gap-3 group"
                >
                  <Icon
                    className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${iconTone}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
                      {item.title}
                    </p>
                    {item.detail ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground self-center">
                    {formatDistanceToNow(new Date(item.occurredAt), {
                      addSuffix: false,
                    })}
                  </span>
                </Link>
              ) : (
                <div className="flex items-start gap-3">
                  <Icon
                    className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${iconTone}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground leading-snug">
                      {item.title}
                    </p>
                    {item.detail ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground self-center">
                    {formatDistanceToNow(new Date(item.occurredAt), {
                      addSuffix: false,
                    })}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
