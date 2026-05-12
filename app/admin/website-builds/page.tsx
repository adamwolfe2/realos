import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { BRAND_NAME } from "@/lib/brand";
import { WEBSITE_BUILD_CAL_LINK } from "@/lib/billing/catalog";

export const metadata: Metadata = {
  title: `Website builds | ${BRAND_NAME} Admin`,
};

export const dynamic = "force-dynamic";

const STATUS_ORDER = [
  "requested",
  "scoping",
  "designing",
  "building",
  "review",
  "live",
  "cancelled",
] as const;

const STATUS_LABEL: Record<(typeof STATUS_ORDER)[number], string> = {
  requested: "Requested",
  scoping: "Scoping",
  designing: "Designing",
  building: "Building",
  review: "Review",
  live: "Live",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<
  (typeof STATUS_ORDER)[number],
  "default" | "active" | "warn" | "success"
> = {
  requested: "warn",
  scoping: "active",
  designing: "active",
  building: "active",
  review: "active",
  live: "success",
  cancelled: "default",
};

// ---------------------------------------------------------------------------
// /admin/website-builds — agency fulfillment queue for paid custom site
// builds. Lists every WebsiteBuildRequest grouped by status, with the
// customer's org, the SKU + amount paid, and the kickoff call status.
// ---------------------------------------------------------------------------

export default async function AdminWebsiteBuildsPage() {
  let scope;
  try {
    scope = await requireAgency();
  } catch {
    redirect("/sign-in");
  }
  void scope;

  const builds = await prisma.websiteBuildRequest.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      orgId: true,
      org: { select: { id: true, name: true, primaryContactEmail: true } },
      propertyId: true,
      property: { select: { id: true, name: true } },
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
      amountPaidCents: true,
      calBookingUrl: true,
      calBookedAt: true,
      kickoffCallAt: true,
      status: true,
      assignedTo: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      createdAt: true,
      updatedAt: true,
      launchedAt: true,
      cancelledAt: true,
    },
  });

  const counts = STATUS_ORDER.reduce(
    (acc, s) => {
      acc[s] = builds.filter((b) => b.status === s).length;
      return acc;
    },
    {} as Record<(typeof STATUS_ORDER)[number], number>,
  );

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Website builds"
        description="Paid custom website build queue. Each row was paid up front via Stripe and routes through a kickoff call before build starts."
      />

      <section className="grid grid-cols-2 md:grid-cols-7 gap-2">
        {STATUS_ORDER.map((s) => (
          <div
            key={s}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {STATUS_LABEL[s]}
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1.5">
              {counts[s]}
            </div>
          </div>
        ))}
      </section>

      {builds.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
          <p className="text-sm font-semibold">No builds yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            When a customer pays for a custom website build through{" "}
            <Link
              href="/portal/billing"
              className="underline underline-offset-2"
            >
              /portal/billing
            </Link>
            , a row lands here with the Stripe payment reference and a
            Cal.com link for the kickoff call.
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                <th className="text-left py-2.5 px-4">Customer</th>
                <th className="text-left py-2.5 px-3">Property</th>
                <th className="text-right py-2.5 px-3">Paid</th>
                <th className="text-left py-2.5 px-3">Status</th>
                <th className="text-left py-2.5 px-3">Kickoff</th>
                <th className="text-left py-2.5 px-3">Assignee</th>
                <th className="text-right py-2.5 px-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {builds.map((b) => (
                <tr key={b.id} className="text-sm">
                  <td className="py-3 px-4">
                    <Link
                      href={`/admin/clients/${b.orgId}`}
                      className="font-medium hover:underline"
                    >
                      {b.org.name}
                    </Link>
                    {b.org.primaryContactEmail ? (
                      <div className="text-[11px] text-muted-foreground">
                        {b.org.primaryContactEmail}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground">
                    {b.property?.name ?? "—"}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    $
                    {Math.round(b.amountPaidCents / 100).toLocaleString()}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge
                      status={b.status as (typeof STATUS_ORDER)[number]}
                    />
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {b.calBookedAt ? (
                      <span className="text-foreground">
                        Booked{" "}
                        {new Date(b.calBookedAt).toLocaleDateString()}
                      </span>
                    ) : b.calBookingUrl ? (
                      <a
                        href={b.calBookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        Awaiting booking
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {b.assignedTo
                      ? `${b.assignedTo.firstName ?? ""} ${b.assignedTo.lastName ?? ""}`.trim() ||
                        b.assignedTo.email
                      : <span className="text-muted-foreground">Unassigned</span>}
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-muted-foreground tabular-nums">
                    {new Date(b.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Kickoff call link</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Customers are sent here after paying. Update it via{" "}
          <code className="text-foreground">WEBSITE_BUILD_CAL_LINK</code> in{" "}
          <code className="text-foreground">lib/billing/catalog.ts</code>.
        </p>
        <a
          href={WEBSITE_BUILD_CAL_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-sm text-primary underline underline-offset-2"
        >
          {WEBSITE_BUILD_CAL_LINK}
        </a>
      </section>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: (typeof STATUS_ORDER)[number];
}) {
  const tone = STATUS_TONE[status];
  const classes =
    tone === "success"
      ? "bg-primary/10 text-primary"
      : tone === "active"
        ? "bg-blue-50 text-blue-700"
        : tone === "warn"
          ? "bg-amber-50 text-amber-800"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${classes}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
