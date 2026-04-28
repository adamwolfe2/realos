import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductLine } from "@prisma/client";
import { getScope } from "@/lib/tenancy/scope";
import { Button } from "@/components/ui/button";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { TopLocations } from "@/components/audiences/top-locations";
import { PushPanel } from "@/components/audiences/push-panel";
import { MemberPreview } from "@/components/audiences/member-preview";
import {
  ArrowLeft,
  Users,
  MapPin,
  Mail,
  Phone,
  Send,
} from "lucide-react";

export const dynamic = "force-dynamic";

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
      take: 6,
      include: {
        destination: { select: { name: true, type: true } },
      },
    }),
  ]);

  if (!segment) notFound();

  const raw = segment.rawPayload as Record<string, unknown> | null;
  const topStates =
    (raw?.top_states as Array<{ state: string; count: number }> | undefined) ??
    [];
  const topZips =
    (raw?.top_zips as Array<{ zip: string; city?: string; count: number }> | undefined) ??
    [];
  const emailMatchRate = raw?.email_match_rate as number | undefined;
  const phoneMatchRate = raw?.phone_match_rate as number | undefined;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/portal/audiences"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          All segments
        </Link>
      </div>

      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {segment.name}
          </h1>
          {segment.description ? (
            <p className="mt-0.5 text-sm text-muted-foreground max-w-2xl">
              {segment.description}
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-muted-foreground">
            AL id <span className="font-mono">{segment.alSegmentId}</span> •
            Synced {timeAgo(segment.lastFetchedAt)}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Reach"
          value={formatCount(segment.memberCount)}
          hint={`${segment.memberCount.toLocaleString()} total members`}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Email match"
          value={
            emailMatchRate != null
              ? `${Math.round(emailMatchRate * 100)}%`
              : "—"
          }
          hint="Members with verified email"
          icon={<Mail className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Phone match"
          value={
            phoneMatchRate != null
              ? `${Math.round(phoneMatchRate * 100)}%`
              : "—"
          }
          hint="Members with mobile or direct"
          icon={<Phone className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Top market"
          value={topStates[0]?.state ?? "—"}
          hint={
            topStates[0]
              ? `${formatCount(topStates[0].count)} in ${topStates[0].state}`
              : "Geographic data pending"
          }
          icon={<MapPin className="h-3.5 w-3.5" />}
        />
      </section>

      <DashboardSection
        eyebrow="Push to destination"
        title="Send segment"
        description="Filter by location and pick where to send. CSV downloads stream right back to your browser."
      >
        <PushPanel
          segmentId={segment.id}
          memberCount={segment.memberCount}
          destinations={destinations.map((d) => ({
            id: d.id,
            name: d.name,
            type: d.type,
          }))}
        />
      </DashboardSection>

      <DashboardSection
        eyebrow="Sample data"
        title="Member preview"
        description="Five anonymized members so you can see what's in this segment before you push."
      >
        <MemberPreview segmentId={segment.id} />
      </DashboardSection>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <DashboardSection
          eyebrow="Where they are"
          title="Top states"
          className="lg:col-span-2"
        >
          <TopLocations
            rows={topStates.slice(0, 5).map((s) => ({
              label: s.state,
              value: s.count,
            }))}
            emptyHint="No state data on this segment."
          />
        </DashboardSection>

        <DashboardSection
          eyebrow="Where they are"
          title="Top zip codes"
          className="lg:col-span-3"
        >
          <TopLocations
            rows={topZips.slice(0, 5).map((z) => ({
              label: z.zip,
              sublabel: z.city,
              value: z.count,
            }))}
            emptyHint="No zip code data on this segment."
          />
        </DashboardSection>
      </div>

      <DashboardSection
        eyebrow="Activity"
        title="Recent pushes"
        href="/portal/audiences/history"
      >
        {recentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">
            No pushes yet for this segment.
          </p>
        ) : (
          <ul className="-my-2 divide-y divide-border">
            {recentRuns.map((run) => (
              <li
                key={run.id}
                className="py-2.5 flex items-center justify-between text-sm gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{run.destination.name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {run.destination.type
                      .toLowerCase()
                      .replace(/_/g, " ")}{" "}
                    • {run.memberCount.toLocaleString()} members •{" "}
                    {timeAgo(run.startedAt)}
                  </p>
                  {run.errorMessage ? (
                    <p className="text-[11px] text-rose-700 mt-0.5 truncate">
                      {run.errorMessage}
                    </p>
                  ) : null}
                </div>
                <RunPill status={run.status} />
              </li>
            ))}
          </ul>
        )}
      </DashboardSection>
    </div>
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
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shrink-0 ${tone}`}
    >
      {status.toLowerCase()}
    </span>
  );
}
