import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

export type FailureSummary = {
  count: number;
  destinationName: string;
  lastError: string | null;
  lastFailedAt: Date;
};

export function FailureBanner({
  totalFailedRuns,
  destinations,
}: {
  totalFailedRuns: number;
  destinations: FailureSummary[];
}) {
  if (totalFailedRuns === 0) return null;

  const top = destinations[0];
  const headline =
    destinations.length === 1
      ? `${top.destinationName} failed ${top.count} time${top.count === 1 ? "" : "s"} in the last 24h`
      : `${totalFailedRuns} failed pushes across ${destinations.length} destinations in the last 24h`;

  return (
    <div
      role="status"
      className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 flex items-start gap-3"
    >
      <AlertTriangle className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-rose-900">{headline}</p>
        {top.lastError ? (
          <p className="text-xs text-rose-800 mt-0.5 truncate">
            Latest: {top.lastError}
          </p>
        ) : null}
      </div>
      <Link
        href="/portal/audiences/history"
        className="inline-flex items-center gap-1 text-xs font-medium text-rose-900 hover:underline shrink-0"
      >
        View history
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
