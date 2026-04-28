import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductLine } from "@prisma/client";
import { getScope } from "@/lib/tenancy/scope";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { ArrowLeft, FileDown, Webhook, Facebook, BarChart3, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sync history" };

export default async function HistoryPage() {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");
  if (scope.productLine !== ProductLine.AUDIENCE_SYNC && !scope.isAlPartner) {
    redirect("/portal");
  }

  const runs = await prisma.audienceSyncRun.findMany({
    where: { orgId: scope.orgId },
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      segment: { select: { id: true, name: true } },
      destination: { select: { name: true, type: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/portal/audiences"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to segments
        </Link>
      </div>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">Sync history</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Every push, manual or scheduled. Member counts and errors logged.
        </p>
      </header>

      <DashboardSection
        eyebrow="Activity log"
        title="All sync runs"
        description={`${runs.length} run${runs.length === 1 ? "" : "s"} in this view`}
      >
        {runs.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No syncs yet. Pick a segment and push it to a destination.
          </div>
        ) : (
          <div className="-mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="text-left font-semibold py-2 px-5">Segment</th>
                  <th className="text-left font-semibold py-2 px-3">Destination</th>
                  <th className="text-right font-semibold py-2 px-3">Members</th>
                  <th className="text-left font-semibold py-2 px-3">Started</th>
                  <th className="text-right font-semibold py-2 px-3">Duration</th>
                  <th className="text-right font-semibold py-2 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-5 align-top">
                      <Link
                        href={`/portal/audiences/${run.segment.id}`}
                        className="font-medium hover:text-primary truncate block"
                      >
                        {run.segment.name}
                      </Link>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="flex items-center gap-2 min-w-0">
                        <DestinationIcon type={run.destination.type} />
                        <span className="text-sm truncate">
                          {run.destination.name}
                        </span>
                      </div>
                      {run.errorMessage ? (
                        <p className="text-[11px] text-rose-700 mt-1 truncate max-w-md">
                          {run.errorMessage}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {run.memberCount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground tabular-nums">
                      {new Date(run.startedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3 text-right text-xs text-muted-foreground tabular-nums">
                      {run.finishedAt
                        ? formatDuration(run.startedAt, run.finishedAt)
                        : "—"}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <RunPill status={run.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>
    </div>
  );
}

function DestinationIcon({ type }: { type: string }) {
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
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground bg-muted shrink-0">
      <Icon className="h-3 w-3" />
    </span>
  );
}

function RunPill({ status }: { status: string }) {
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
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        tone,
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
