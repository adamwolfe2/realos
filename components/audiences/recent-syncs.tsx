import Link from "next/link";
import { cn } from "@/lib/utils";
import { Send, FileDown, Webhook, Facebook, BarChart3 } from "lucide-react";

export type RecentSyncRow = {
  id: string;
  segmentId: string;
  segmentName: string;
  destinationName: string;
  destinationType: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  memberCount: number;
  startedAt: Date;
  errorMessage: string | null;
};

export function RecentSyncs({ rows }: { rows: RecentSyncRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No syncs yet. Push a segment to a destination to populate this feed.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border -my-2">
      {rows.map((r) => (
        <li key={r.id} className="py-2.5 flex items-start gap-3">
          <DestinationIcon type={r.destinationType} status={r.status} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/portal/audiences/${r.segmentId}`}
                className="text-sm font-medium hover:text-primary truncate"
              >
                {r.segmentName}
              </Link>
              <span className="text-muted-foreground text-xs">→</span>
              <span className="text-sm text-muted-foreground truncate">
                {r.destinationName}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
              {r.memberCount.toLocaleString()} members •{" "}
              {timeAgo(r.startedAt)}
            </div>
            {r.errorMessage ? (
              <div className="mt-1 text-[11px] text-rose-700 truncate">
                {r.errorMessage}
              </div>
            ) : null}
          </div>
          <StatusPill status={r.status} />
        </li>
      ))}
    </ul>
  );
}

function StatusPill({ status }: { status: RecentSyncRow["status"] }) {
  const tone =
    status === "SUCCESS"
      ? "text-emerald-700 bg-emerald-50"
      : status === "FAILED"
        ? "text-rose-700 bg-rose-50"
        : status === "RUNNING"
          ? "text-amber-700 bg-amber-50"
          : "text-muted-foreground bg-muted";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shrink-0",
        tone,
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

function DestinationIcon({
  type,
  status,
}: {
  type: string;
  status: RecentSyncRow["status"];
}) {
  const Icon =
    type === "CSV_DOWNLOAD"
      ? FileDown
      : type === "WEBHOOK"
        ? Webhook
        : type === "META_CUSTOM_AUDIENCE"
          ? Facebook
          : type === "GOOGLE_CUSTOMER_MATCH"
            ? BarChart3
            : Send;
  const tone =
    status === "FAILED"
      ? "text-rose-700 bg-rose-50"
      : status === "SUCCESS"
        ? "text-primary bg-primary/10"
        : "text-muted-foreground bg-muted";
  return (
    <span
      className={cn(
        "shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md mt-0.5",
        tone,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
