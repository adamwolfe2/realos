import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductLine } from "@prisma/client";
import { getScope } from "@/lib/tenancy/scope";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

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
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link
          href="/portal/audiences"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to segments
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sync history</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every push, manual or scheduled, with member counts and errors.
        </p>
      </header>

      {runs.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No syncs yet. Pick a segment and push it to a destination.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {runs.map((run) => (
            <div key={run.id} className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/portal/audiences/${run.segment.id}`}
                    className="font-medium hover:underline truncate"
                  >
                    {run.segment.name}
                  </Link>
                  <span className="text-muted-foreground text-sm">→</span>
                  <span className="text-sm truncate">
                    {run.destination.name}
                  </span>
                  <Badge variant="outline" className="shrink-0">
                    {run.destination.type.toLowerCase().replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {run.memberCount.toLocaleString()} members •{" "}
                  {new Date(run.startedAt).toLocaleString()}
                  {run.finishedAt
                    ? ` • finished in ${formatDuration(
                        run.startedAt,
                        run.finishedAt,
                      )}`
                    : ""}
                </p>
                {run.errorMessage ? (
                  <p className="text-xs text-destructive mt-1.5">
                    {run.errorMessage}
                  </p>
                ) : null}
              </div>
              <RunBadge status={run.status} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function RunBadge({ status }: { status: string }) {
  if (status === "SUCCESS") {
    return <Badge variant="secondary">Success</Badge>;
  }
  if (status === "FAILED") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (status === "RUNNING") {
    return <Badge variant="outline">Running</Badge>;
  }
  return <Badge variant="outline">{status.toLowerCase()}</Badge>;
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
