import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import type { BadgeTone } from "@/lib/format";
import { humanPropertyType } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Intake queue" };
export const dynamic = "force-dynamic";

// IntakeSubmission.status is a raw string in the schema ("submitted",
// "in_review", "converted", "rejected") — not a Prisma enum — so we keep a
// small local mapping instead of a human*Status helper in lib/format.
function humanIntakeStatus(s: string): string {
  switch (s) {
    case "submitted":
      return "Submitted";
    case "consultation_booked":
      return "Call booked";
    case "in_review":
      return "In review";
    case "converted":
      return "Converted";
    case "rejected":
      return "Rejected";
    default:
      return s.charAt(0).toUpperCase() + s.slice(1).replaceAll("_", " ");
  }
}

function intakeStatusTone(s: string): BadgeTone {
  switch (s) {
    case "converted":
      return "success";
    case "consultation_booked":
    case "in_review":
      return "warning";
    case "rejected":
      return "danger";
    case "submitted":
      return "info";
    default:
      return "neutral";
  }
}

export default async function IntakeList({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAgency();

  const { filter = "open" } = await searchParams;

  const where =
    filter === "converted"
      ? { convertedAt: { not: null } }
      : filter === "all"
        ? {}
        : { convertedAt: null };

  const submissions = await prisma.intakeSubmission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: 200,
    include: {
      org: { select: { id: true, name: true, slug: true, status: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intake queue"
        description="New intakes land here. Convert accepted submissions into a provisioned tenant."
        actions={
          <nav className="flex flex-wrap gap-1.5" aria-label="Filter intakes">
            <FilterLink filter={filter} value="open" label="Open" />
            <FilterLink filter={filter} value="converted" label="Converted" />
            <FilterLink filter={filter} value="all" label="All" />
          </nav>
        }
      />

      {submissions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No submissions match this filter.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {submissions.map((s) => {
            const selected = Array.isArray(s.selectedModules)
              ? s.selectedModules.length
              : 0;
            return (
              <li key={s.id}>
                <Link
                  href={`/admin/intakes/${s.id}`}
                  className="block rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        {s.companyName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {humanPropertyType(s.propertyType)}
                        {s.numberOfProperties
                          ? `, ${s.numberOfProperties} properties`
                          : ""}
                        {s.currentBackendPlatform &&
                        s.currentBackendPlatform !== "NONE"
                          ? `, ${s.currentBackendPlatform}`
                          : ""}
                        {s.biggestPainPoint
                          ? ` · Pain: "${s.biggestPainPoint}"`
                          : ""}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {s.primaryContactName}, {s.primaryContactEmail}
                        {selected ? ` · ${selected} modules` : ""}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(s.submittedAt, {
                          addSuffix: true,
                        })}
                      </span>
                      <StatusBadge tone={intakeStatusTone(s.status)}>
                        {humanIntakeStatus(s.status)}
                      </StatusBadge>
                      {s.bookedCallAt ? (
                        <span className="text-[11px] text-emerald-700">
                          Call booked
                        </span>
                      ) : null}
                      {s.org ? (
                        <span className="text-[11px] text-emerald-700">
                          Converted · {s.org.slug}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterLink({
  filter,
  value,
  label,
}: {
  filter: string;
  value: string;
  label: string;
}) {
  const active = filter === value;
  return (
    <Link
      href={
        value === "open" ? "/admin/intakes" : `/admin/intakes?filter=${value}`
      }
      className={cn(
        "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:bg-muted/50",
      )}
    >
      {label}
    </Link>
  );
}
