import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";

export const metadata: Metadata = { title: "Intake queue" };
export const dynamic = "force-dynamic";

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
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Intake queue</h1>
          <p className="text-sm opacity-60 mt-1">
            New intakes land here. Convert accepted submissions into a
            provisioned tenant.
          </p>
        </div>
        <nav className="flex gap-1 text-xs">
          <FilterLink filter={filter} value="open" label="Open" />
          <FilterLink filter={filter} value="converted" label="Converted" />
          <FilterLink filter={filter} value="all" label="All" />
        </nav>
      </header>

      {submissions.length === 0 ? (
        <p className="text-sm opacity-60 border rounded-md p-4">
          No submissions match this filter.
        </p>
      ) : (
        <ul className="space-y-2">
          {submissions.map((s) => {
            const selected =
              Array.isArray(s.selectedModules) ? s.selectedModules.length : 0;
            return (
              <li key={s.id}>
                <Link
                  href={`/admin/intakes/${s.id}`}
                  className="block border rounded-md p-4 hover:bg-muted/40"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {s.companyName}
                      </div>
                      <div className="text-xs opacity-60">
                        {s.propertyType}
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
                      <div className="text-xs opacity-60 mt-1">
                        {s.primaryContactName}, {s.primaryContactEmail}
                        {selected ? ` · ${selected} modules` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs">
                        {formatDistanceToNow(s.submittedAt, {
                          addSuffix: true,
                        })}
                      </div>
                      <div className="text-[11px] opacity-70">{s.status}</div>
                      {s.bookedCallAt ? (
                        <div className="text-[11px] text-emerald-700">
                          Call booked
                        </div>
                      ) : null}
                      {s.org ? (
                        <div className="text-[11px] text-emerald-700">
                          Converted, {s.org.slug}
                        </div>
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
      href={value === "open" ? "/admin/intakes" : `/admin/intakes?filter=${value}`}
      className={`px-3 py-1.5 border rounded ${
        active ? "bg-primary text-primary-foreground hover:bg-primary-dark transition-colors" : ""
      }`}
    >
      {label}
    </Link>
  );
}
