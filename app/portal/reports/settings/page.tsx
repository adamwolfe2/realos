import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { ReportCadenceForm } from "@/components/portal/reports/report-cadence-form";
import {
  LocalTime,
  NextScheduledReport,
} from "@/components/portal/reports/schedule-times";

export const metadata: Metadata = { title: "Report cadence — Reports" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/reports/settings — operator-facing UI for the report cadence
// + recipient list + auto-send opt-in introduced for Norman bug #100.
//
// Server component fetches the current org's reportCadence /
// reportRecipients / reportAutoSend, hands them to the client form,
// and lets the form persist via the saveReportCadence server action.
//
// The "Next scheduled report" line is display-only: it derives the next
// cron fire from reportCadence using the same UTC schedule the crons run
// on (daily 07:30, weekly Mon 07:00, monthly 1st 07:00) and never touches
// the schedule itself.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Next cron fire for a cadence, in UTC. Mirrors the cron schedule:
 *  daily 07:30 UTC · weekly Monday 07:00 UTC · monthly 1st 07:00 UTC. */
function nextScheduledRunUtc(cadence: string, now: Date): Date | null {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  if (cadence === "daily") {
    const today = Date.UTC(y, m, d, 7, 30);
    return new Date(today > now.getTime() ? today : today + DAY_MS);
  }
  if (cadence === "weekly") {
    const todayRun = Date.UTC(y, m, d, 7, 0);
    const daysToMonday = (1 - new Date(todayRun).getUTCDay() + 7) % 7;
    const candidate = todayRun + daysToMonday * DAY_MS;
    return new Date(
      candidate > now.getTime() ? candidate : candidate + 7 * DAY_MS,
    );
  }
  if (cadence === "monthly") {
    const thisMonth = Date.UTC(y, m, 1, 7, 0);
    return new Date(
      thisMonth > now.getTime() ? thisMonth : Date.UTC(y, m + 1, 1, 7, 0),
    );
  }
  return null;
}

/** Deterministic UTC label used as the SSR fallback (the client swaps in
 *  the viewer's local time after mount). */
function formatUtcRun(d: Date): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
  return `${formatted} UTC`;
}

export default async function ReportCadenceSettingsPage() {
  const scope = await requireScope();
  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: {
      id: true,
      name: true,
      reportCadence: true,
      reportRecipients: true,
      reportAutoSend: true,
    },
  });
  if (!org) return null;

  const nextRun = nextScheduledRunUtc(org.reportCadence, new Date());

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow={
          <Link
            href="/portal/reports"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Reports
          </Link>
        }
        title="Report cadence"
        description="Configure how often client reports are generated, who receives them, and whether each report is sent automatically once the snapshot is generated."
      />

      <div className="ls-card flex items-center gap-2.5 px-4 py-3 text-[12.5px] text-muted-foreground">
        <CalendarClock
          className="h-4 w-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <NextScheduledReport
          nextRunAtIso={nextRun ? nextRun.toISOString() : null}
          utcLabel={nextRun ? formatUtcRun(nextRun) : null}
        />
      </div>

      <ReportCadenceForm
        initial={{
          cadence: org.reportCadence,
          recipients: org.reportRecipients ?? [],
          autoSend: org.reportAutoSend,
        }}
      />

      <section className="ls-card p-4 text-[12.5px] text-muted-foreground leading-relaxed space-y-2">
        <p className="font-semibold text-foreground">How scheduled sending works</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="font-semibold text-foreground">Weekly</span>:
            reports generate every Monday at 07:00 UTC
            <LocalTime hourUtc={7} weekdayUtc={1} />. When auto-send is
            enabled, delivery occurs as soon as the snapshot is written.
          </li>
          <li>
            <span className="font-semibold text-foreground">Monthly</span>:
            reports generate on the 1st of each month at 07:00 UTC
            <LocalTime hourUtc={7} />.
          </li>
          <li>
            <span className="font-semibold text-foreground">Daily</span>:
            reports generate every day at 07:30 UTC
            <LocalTime hourUtc={7} minuteUtc={30} />. Weekly is the
            recommended cadence for most portfolios.
          </li>
          <li>
            <span className="font-semibold text-foreground">Off</span>{" "}
            preserves the original behavior: a draft is generated and an
            operator reviews and shares each report manually.
          </li>
          <li>
            Automatic sending only occurs when{" "}
            <span className="font-semibold text-foreground">at least one</span>{" "}
            recipient is configured. Organizations that enable auto-send
            without recipients are surfaced in the cron run log rather than
            failing silently.
          </li>
        </ul>
      </section>
    </div>
  );
}
