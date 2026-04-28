import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

export type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  alSegmentId: string;
  memberCount: number;
  lastFetchedAt: Date | null;
  spark: number[];
  destinationCount: number;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function timeAgo(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export function SegmentTable({ rows }: { rows: SegmentRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No segments yet. Hit Refresh segments to pull your AudienceLab catalog.
      </div>
    );
  }
  return (
    <div className="-mx-5 -mb-5 -mt-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
            <th className="text-left font-semibold py-2 px-5 w-[40%]">
              Segment
            </th>
            <th className="text-right font-semibold py-2 px-3">Reach</th>
            <th className="text-left font-semibold py-2 px-3 w-[20%]">
              28d activity
            </th>
            <th className="text-right font-semibold py-2 px-3">Destinations</th>
            <th className="text-right font-semibold py-2 px-3">Synced</th>
            <th className="px-5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={row.id}
              className="group hover:bg-muted/40 transition-colors"
            >
              <td className="py-3 px-5 align-top">
                <Link
                  href={`/portal/audiences/${row.id}`}
                  className="block min-w-0"
                >
                  <div className="font-medium text-foreground truncate">
                    {row.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {row.description ??
                      `AL id ${row.alSegmentId.slice(0, 14)}…`}
                  </div>
                </Link>
              </td>
              <td className="py-3 px-3 text-right tabular-nums font-medium">
                {formatCount(row.memberCount)}
              </td>
              <td className="py-3 px-3">
                <Sparkline data={row.spark} />
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                {row.destinationCount > 0 ? (
                  <span className="text-foreground">
                    {row.destinationCount}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-3 px-3 text-right text-xs text-muted-foreground tabular-nums">
                {timeAgo(row.lastFetchedAt)}
              </td>
              <td className="py-3 px-5 text-right">
                <Link
                  href={`/portal/audiences/${row.id}`}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground",
                    "group-hover:bg-primary/10 group-hover:text-primary transition-colors",
                  )}
                  aria-label={`Open ${row.name}`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Sparkline({ data, height = 22 }: { data: number[]; height?: number }) {
  if (!data || data.length < 2) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = height;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `M0,${h} L${points.split(" ").join(" L")} L${w},${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-20 h-5"
      aria-hidden="true"
    >
      <path d={areaPath} fill="#2563EB" opacity="0.08" />
      <polyline
        points={points}
        fill="none"
        stroke="#2563EB"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
