import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductLine } from "@prisma/client";
import { getScope } from "@/lib/tenancy/scope";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import {
  SchedulesManager,
  type ScheduleRow,
} from "@/components/audiences/schedules-manager";
import { ArrowLeft, Calendar, Activity, Pause } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scheduled syncs" };

type SearchParams = Promise<{ segmentId?: string }>;

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");
  if (scope.productLine !== ProductLine.AUDIENCE_SYNC && !scope.isAlPartner) {
    redirect("/portal");
  }

  const { segmentId } = await searchParams;

  const [schedules, segments, destinations] = await Promise.all([
    prisma.audienceSyncSchedule.findMany({
      where: { orgId: scope.orgId },
      orderBy: [{ enabled: "desc" }, { nextRunAt: "asc" }],
      include: {
        segment: { select: { id: true, name: true } },
        destination: { select: { id: true, name: true, type: true } },
      },
    }),
    prisma.audienceSegment.findMany({
      where: { orgId: scope.orgId, visible: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.audienceDestination.findMany({
      where: { orgId: scope.orgId, enabled: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, type: true },
    }),
  ]);

  const enabledCount = schedules.filter((s) => s.enabled).length;
  const pausedCount = schedules.length - enabledCount;
  const nextScheduled = schedules
    .filter((s) => s.enabled)
    .reduce<Date | null>((acc, s) => {
      if (!acc) return s.nextRunAt;
      return s.nextRunAt < acc ? s.nextRunAt : acc;
    }, null);

  const scheduleRows: ScheduleRow[] = schedules.map((s) => ({
    id: s.id,
    segmentId: s.segment.id,
    segmentName: s.segment.name,
    destinationName: s.destination.name,
    destinationType: s.destination.type,
    frequency: s.frequency,
    dayOfWeek: s.dayOfWeek,
    hourUtc: s.hourUtc,
    enabled: s.enabled,
    nextRunAt: s.nextRunAt.toISOString(),
    lastRunAt: s.lastRunAt?.toISOString() ?? null,
    filterSummary: summarizeFilter(s.filterSnapshot),
  }));

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
        <h1 className="text-xl font-semibold tracking-tight">
          Scheduled syncs
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Push a segment to a destination on a daily or weekly cadence. The
          system handles the runs while you focus on the campaign.
        </p>
      </header>

      <section
        aria-label="Schedule metrics"
        className="grid grid-cols-2 md:grid-cols-3 gap-3"
      >
        <KpiTile
          label="Active schedules"
          value={enabledCount.toLocaleString()}
          hint={
            schedules.length === 0
              ? "Set one up to push automatically"
              : `${schedules.length.toLocaleString()} total`
          }
          icon={<Calendar className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Next run"
          value={nextScheduled ? formatRelative(nextScheduled) : "—"}
          hint={
            nextScheduled
              ? formatAbs(nextScheduled)
              : "No active schedules yet"
          }
          icon={<Activity className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Paused"
          value={pausedCount.toLocaleString()}
          hint="Disabled schedules don't fire"
          icon={<Pause className="h-3.5 w-3.5" />}
        />
      </section>

      <DashboardSection
        eyebrow="Recurring"
        title="Schedules"
        description={
          schedules.length === 0
            ? "Set one up to push this segment automatically."
            : `${schedules.length} schedule${schedules.length === 1 ? "" : "s"} configured`
        }
      >
        <SchedulesManager
          schedules={scheduleRows}
          segments={segments}
          destinations={destinations}
          initialSegmentId={segmentId}
        />
      </DashboardSection>
    </div>
  );
}

function formatRelative(d: Date): string {
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "due now";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  const days = Math.floor(h / 24);
  return `in ${days}d`;
}

function formatAbs(d: Date): string {
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${date} at ${hh}:${mm} UTC`;
}

function summarizeFilter(filter: unknown): string | null {
  if (!filter || typeof filter !== "object") return null;
  const f = filter as {
    zipCodes?: string[];
    states?: string[];
    cities?: string[];
  };
  const parts: string[] = [];
  if (f.zipCodes?.length)
    parts.push(`${f.zipCodes.length} zip${f.zipCodes.length === 1 ? "" : "s"}`);
  if (f.states?.length)
    parts.push(
      `${f.states.length} state${f.states.length === 1 ? "" : "s"}`,
    );
  if (f.cities?.length)
    parts.push(
      `${f.cities.length} cit${f.cities.length === 1 ? "y" : "ies"}`,
    );
  return parts.length ? parts.join(", ") : null;
}
