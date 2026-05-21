import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { ReportCadenceForm } from "@/components/portal/reports/report-cadence-form";

export const metadata: Metadata = { title: "Report cadence — Reports" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/reports/settings — operator-facing UI for the report cadence
// + recipient list + auto-send opt-in introduced for Norman bug #100.
//
// Server component fetches the current org's reportCadence /
// reportRecipients / reportAutoSend, hands them to the client form,
// and lets the form persist via the saveReportCadence server action.
// ---------------------------------------------------------------------------

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

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow={
          <Link
            href="/portal/reports"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <span aria-hidden="true">←</span> Reports
          </Link>
        }
        title="Report cadence"
        description="Pick how often we ship your client report, who receives it, and whether to auto-send the moment the snapshot is generated."
      />

      <ReportCadenceForm
        initial={{
          cadence: org.reportCadence,
          recipients: org.reportRecipients ?? [],
          autoSend: org.reportAutoSend,
        }}
      />

      <section className="rounded-xl border border-border bg-muted/30 p-4 text-[12.5px] text-muted-foreground leading-relaxed space-y-2">
        <p className="font-semibold text-foreground">How auto-send works</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="font-semibold text-foreground">Weekly</span>:
            cron runs every Monday at 07:00 UTC. Auto-send fires the
            same moment the snapshot is written.
          </li>
          <li>
            <span className="font-semibold text-foreground">Monthly</span>:
            cron runs on the 1st of each month at 07:00 UTC.
          </li>
          <li>
            <span className="font-semibold text-foreground">Daily</span>:
            ships at 07:30 UTC every day. Use sparingly — most operators
            find weekly the right rhythm.
          </li>
          <li>
            <span className="font-semibold text-foreground">None</span>{" "}
            preserves the original behavior: a draft lands in the
            inbox, you review + click Share manually.
          </li>
          <li>
            Auto-send only fires when{" "}
            <span className="font-semibold text-foreground">at least one</span>{" "}
            recipient is configured. The cron run log surfaces orgs
            that opted in but have no recipients so they don&apos;t fail
            silently.
          </li>
        </ul>
      </section>
    </div>
  );
}
