import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Flame, Globe } from "lucide-react";
import type { RecentIdentifiedVisitor } from "@/lib/dashboard/queries";

function intentTone(score: number): { label: string; className: string } {
  if (score >= 70) return { label: "Hot", className: "bg-rose-50 text-rose-700" };
  if (score >= 40) return { label: "Warm", className: "bg-amber-50 text-amber-700" };
  return { label: "Active", className: "bg-emerald-50 text-emerald-700" };
}

function sourceLabel(utmSource: string | null, referrer: string | null): string {
  if (utmSource) return utmSource;
  if (!referrer) return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return referrer.length > 24 ? `${referrer.slice(0, 21)}…` : referrer;
  }
}

export function RecentIdentifiedVisitors({
  visitors,
}: {
  visitors: RecentIdentifiedVisitor[];
}) {
  if (visitors.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No identified visitors yet. They'll show up here as the pixel resolves
        site traffic to real names and emails.
      </p>
    );
  }

  return (
    <ul className="-my-1 divide-y divide-border">
      {visitors.map((v) => {
        const tone = intentTone(v.intentScore);
        const source = sourceLabel(v.utmSource, v.referrer);
        return (
          <li key={v.id}>
            <Link
              href={`/portal/visitors/${v.id}`}
              className="flex items-center justify-between gap-3 px-1 py-2.5 -mx-1 rounded-md hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {v.name}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone.className}`}
                  >
                    <Flame className="h-2.5 w-2.5" />
                    {tone.label}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {v.email ? (
                    <span className="truncate max-w-[140px]">{v.email}</span>
                  ) : null}
                  {v.email ? <span aria-hidden="true">·</span> : null}
                  <Globe className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{source}</span>
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {formatDistanceToNow(v.lastSeenAt, { addSuffix: true })}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
