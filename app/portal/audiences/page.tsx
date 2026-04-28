import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductLine } from "@prisma/client";
import { getScope } from "@/lib/tenancy/scope";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshSegmentsButton } from "@/components/audiences/refresh-button";
import { Target, Users, Send, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Audience segments",
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default async function AudiencesPage() {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");
  if (scope.productLine !== ProductLine.AUDIENCE_SYNC && !scope.isAlPartner) {
    redirect("/portal");
  }

  const [segments, destinationCount, recentRuns] = await Promise.all([
    prisma.audienceSegment.findMany({
      where: { orgId: scope.orgId, visible: true },
      orderBy: [{ memberCount: "desc" }, { name: "asc" }],
      take: 100,
    }),
    prisma.audienceDestination.count({
      where: { orgId: scope.orgId, enabled: true },
    }),
    prisma.audienceSyncRun.count({
      where: { orgId: scope.orgId, status: "SUCCESS" },
    }),
  ]);

  const totalReach = segments.reduce((sum, s) => sum + (s.memberCount ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Audience segments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live segments from your AudienceLab catalog. Push to ad accounts,
            CRMs, or download as CSV.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshSegmentsButton />
          <Button asChild variant="outline">
            <Link href="/portal/audiences/destinations">Destinations</Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="Active segments"
          value={segments.length.toLocaleString()}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Total reach"
          value={formatCount(totalReach)}
        />
        <StatCard
          icon={<Send className="h-4 w-4" />}
          label="Sync destinations"
          value={destinationCount.toLocaleString()}
          href="/portal/audiences/destinations"
        />
      </div>

      {segments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {segments.map((segment) => (
            <Link
              key={segment.id}
              href={`/portal/audiences/${segment.id}`}
              className="group"
            >
              <Card className="p-5 h-full transition-colors hover:border-foreground/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold truncate">
                        {segment.name}
                      </h3>
                      {segment.memberCount > 0 ? (
                        <Badge variant="secondary" className="shrink-0">
                          {formatCount(segment.memberCount)} people
                        </Badge>
                      ) : null}
                    </div>
                    {segment.description ? (
                      <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                        {segment.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1.5">
                        AL segment id{" "}
                        <span className="font-mono text-xs">
                          {segment.alSegmentId.slice(0, 12)}…
                        </span>
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="text-xs text-muted-foreground mt-3 flex items-center gap-2">
                  <span>
                    {segment.lastFetchedAt
                      ? `Synced ${timeAgo(segment.lastFetchedAt)}`
                      : "Not synced yet"}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pt-4">
        {recentRuns.toLocaleString()} successful pushes from this account
      </p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1.5">{value}</div>
    </Card>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function EmptyState() {
  return (
    <Card className="p-8 text-center">
      <Target className="h-8 w-8 text-muted-foreground mx-auto" />
      <h2 className="text-base font-semibold mt-3">No segments yet</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        Pull your AudienceLab segment catalog into LeaseStack. Once synced,
        you can push them to ad accounts, CRMs, or export as CSV.
      </p>
      <div className="mt-4">
        <RefreshSegmentsButton />
      </div>
    </Card>
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
  return `${days}d ago`;
}
