import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { createReport } from "@/lib/actions/reports";
import { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Client reports" };
export const dynamic = "force-dynamic";

type Search = { kind?: string; status?: string };

export default async function ReportsListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;

  const where: Prisma.ClientReportWhereInput = { ...tenantWhere(scope) };
  if (sp.kind === "weekly" || sp.kind === "monthly" || sp.kind === "custom") {
    where.kind = sp.kind;
  }
  if (sp.status === "draft" || sp.status === "shared" || sp.status === "archived") {
    where.status = sp.status;
  }

  const reports = await prisma.clientReport.findMany({
    where,
    orderBy: { generatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      generatedAt: true,
      sharedAt: true,
      viewCount: true,
      headline: true,
    },
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Client reports
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Weekly and monthly reviews
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Generate a frozen snapshot of the numbers, add a personal note,
            then share a clean link with your client. Nothing auto-sends. You
            review every report before it leaves the building.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={generateWeekly}>
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Generate weekly report
            </button>
          </form>
          <form action={generateMonthly}>
            <button
              type="submit"
              className="inline-flex items-center rounded-md border border-border bg-card text-foreground px-3.5 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Generate monthly report
            </button>
          </form>
        </div>
      </div>

      {/* Filters */}
      <form
        action="/portal/reports"
        className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Kind
          </span>
          <select
            name="kind"
            defaultValue={sp.kind ?? ""}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Status
          </span>
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="shared">Shared</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex items-center rounded-md border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Apply filters
        </button>
        <Link
          href="/portal/reports"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Reset
        </Link>
      </form>

      {/* List */}
      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            No reports yet
          </div>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            Start with a weekly snapshot
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Generate your first report to capture this week&apos;s leads, tours,
            ad spend, and organic traffic as a frozen snapshot. Add a personal
            note, then copy a shareable link for your client.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {reports.map((r) => (
              <Link
                key={r.id}
                href={`/portal/reports/${r.id}`}
                className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                      {kindLabel(r.kind)}
                    </span>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-sm font-semibold text-foreground truncate">
                    {r.headline ||
                      `${formatDate(r.periodStart)} to ${formatDate(r.periodEnd)}`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Generated {formatDate(r.generatedAt)}
                    {r.sharedAt ? ` \u00b7 Shared ${formatDate(r.sharedAt)}` : ""}
                    {r.viewCount > 0 ? ` \u00b7 ${r.viewCount} views` : ""}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Open</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server actions bound to the two generator buttons.
// ---------------------------------------------------------------------------

async function generateWeekly(): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const res = await createReport("weekly");
  redirect(`/portal/reports/${res.id}`);
}

async function generateMonthly(): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const res = await createReport("monthly");
  redirect(`/portal/reports/${res.id}`);
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "shared"
      ? "bg-emerald-100 text-emerald-800"
      : status === "archived"
        ? "bg-muted text-muted-foreground"
        : "bg-sky-100 text-sky-800";
  return (
    <span className={"text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded " + tone}>
      {status}
    </span>
  );
}

function kindLabel(kind: string): string {
  if (kind === "weekly") return "Weekly";
  if (kind === "monthly") return "Monthly";
  return "Custom";
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
