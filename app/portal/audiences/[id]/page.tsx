import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductLine } from "@prisma/client";
import { getScope } from "@/lib/tenancy/scope";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send } from "lucide-react";
import { PushPanel } from "@/components/audiences/push-panel";

export const dynamic = "force-dynamic";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await getScope();
  if (!scope) redirect("/sign-in");
  if (scope.productLine !== ProductLine.AUDIENCE_SYNC && !scope.isAlPartner) {
    redirect("/portal");
  }

  const [segment, destinations, recentRuns] = await Promise.all([
    prisma.audienceSegment.findFirst({
      where: { id, orgId: scope.orgId },
    }),
    prisma.audienceDestination.findMany({
      where: { orgId: scope.orgId, enabled: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.audienceSyncRun.findMany({
      where: { orgId: scope.orgId, segmentId: id },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: {
        destination: { select: { name: true, type: true } },
      },
    }),
  ]);

  if (!segment) notFound();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link
          href="/portal/audiences"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All segments
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">
            {segment.name}
          </h1>
          <Badge variant="secondary">
            {formatCount(segment.memberCount)} people
          </Badge>
        </div>
        {segment.description ? (
          <p className="text-sm text-muted-foreground max-w-2xl">
            {segment.description}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          AL id <span className="font-mono">{segment.alSegmentId}</span>
        </p>
      </header>

      <PushPanel
        segmentId={segment.id}
        memberCount={segment.memberCount}
        destinations={destinations.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
        }))}
      />

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent pushes</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/portal/audiences/history">View all</Link>
          </Button>
        </div>
        {recentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">
            No pushes yet for this segment.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {recentRuns.map((run) => (
              <li
                key={run.id}
                className="py-2.5 flex items-center justify-between text-sm gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {run.destination.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {run.destination.type.replace(/_/g, " ").toLowerCase()} •{" "}
                    {run.memberCount.toLocaleString()} members •{" "}
                    {new Date(run.startedAt).toLocaleString()}
                  </p>
                </div>
                <RunBadge status={run.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
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
  return <Badge variant="outline">{status.toLowerCase()}</Badge>;
}
