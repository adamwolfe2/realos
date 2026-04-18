import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { ConvertIntakeButton } from "./convert-button";

export const metadata: Metadata = { title: "Intake detail" };
export const dynamic = "force-dynamic";

type IntakeStatus = "submitted" | "in_review" | "converted" | "rejected";

const STATUS_STYLES: Record<IntakeStatus, string> = {
  submitted: "bg-sky-100 text-sky-900 border-sky-200",
  in_review: "bg-amber-100 text-amber-900 border-amber-200",
  converted: "bg-emerald-100 text-emerald-900 border-emerald-200",
  rejected: "bg-rose-100 text-rose-900 border-rose-200",
};

function isIntakeStatus(v: string): v is IntakeStatus {
  return (
    v === "submitted" ||
    v === "in_review" ||
    v === "converted" ||
    v === "rejected"
  );
}

export default async function IntakeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  if (!scope.isAgency) notFound();

  const { id } = await params;

  const intake = await prisma.intakeSubmission.findUnique({
    where: { id },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          clerkOrgId: true,
        },
      },
    },
  });
  if (!intake) notFound();

  const selected = Array.isArray(intake.selectedModules)
    ? (intake.selectedModules as string[])
    : [];

  const status: IntakeStatus = isIntakeStatus(intake.status)
    ? intake.status
    : "submitted";

  const canAct = status === "submitted" || status === "in_review";
  const monthlySpend =
    intake.currentMonthlySpendCents != null
      ? `$${Math.round(intake.currentMonthlySpendCents / 100).toLocaleString()}/mo`
      : "—";

  return (
    <div className="max-w-4xl space-y-8">
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <Link
            href="/admin/intakes"
            className="text-xs opacity-60 hover:opacity-100"
          >
            ← Intake queue
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="font-serif text-3xl font-bold">
              {intake.companyName}
            </h1>
            <span
              className={`text-[11px] tracking-wider uppercase border rounded px-2 py-0.5 ${STATUS_STYLES[status]}`}
            >
              {status.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm opacity-70 mt-1">
            {intake.primaryContactName}, {intake.primaryContactEmail}
            {intake.primaryContactPhone
              ? ` · ${intake.primaryContactPhone}`
              : ""}
          </p>
          <p className="text-xs opacity-60 mt-1">
            Submitted {new Date(intake.submittedAt).toLocaleString()}
            {intake.reviewedAt
              ? ` · Reviewed ${new Date(intake.reviewedAt).toLocaleString()}`
              : ""}
            {intake.convertedAt
              ? ` · Converted ${new Date(intake.convertedAt).toLocaleString()}`
              : ""}
          </p>
        </div>
      </header>

      {status === "converted" && intake.org ? (
        <section className="border rounded-md p-5 bg-emerald-50/60">
          <p className="text-[10px] tracking-widest uppercase opacity-60 mb-2">
            Converted client
          </p>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold">{intake.org.name}</p>
              <p className="text-xs opacity-70">
                {intake.org.slug} · {intake.org.status}
                {intake.org.clerkOrgId
                  ? ` · Clerk org ${intake.org.clerkOrgId}`
                  : " · Clerk org not yet provisioned"}
              </p>
            </div>
            <Link
              href={`/admin/clients/${intake.org.id}`}
              className="text-xs font-semibold bg-foreground text-background px-3 py-2 rounded"
            >
              Open client →
            </Link>
          </div>
        </section>
      ) : null}

      {status === "rejected" ? (
        <section className="border rounded-md p-5 bg-rose-50/50">
          <p className="text-[10px] tracking-widest uppercase opacity-60 mb-1">
            Rejected
          </p>
          <p className="text-sm">
            This intake was marked rejected and won't be provisioned.
          </p>
        </section>
      ) : null}

      {canAct ? (
        <section className="border rounded-md p-5">
          <p className="text-[10px] tracking-widest uppercase opacity-60 mb-3">
            Actions
          </p>
          <ConvertIntakeButton intakeId={intake.id} />
          <p className="text-xs opacity-60 mt-3">
            Convert provisions an Organization (CLIENT), creates a Clerk
            organization, and emails an admin invite to{" "}
            {intake.primaryContactEmail}.
          </p>
        </section>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-md p-5">
          <h2 className="font-serif text-lg font-semibold mb-3">Company</h2>
          <dl className="space-y-1 text-sm">
            <Row k="Company name" v={intake.companyName} />
            <Row k="Short name" v={intake.shortName ?? "—"} />
            <Row k="Website" v={intake.websiteUrl ?? "—"} />
            <Row k="HQ city" v={intake.hqCity ?? "—"} />
            <Row k="HQ state" v={intake.hqState ?? "—"} />
          </dl>
        </div>

        <div className="border rounded-md p-5">
          <h2 className="font-serif text-lg font-semibold mb-3">Contact</h2>
          <dl className="space-y-1 text-sm">
            <Row k="Name" v={intake.primaryContactName} />
            <Row k="Email" v={intake.primaryContactEmail} />
            <Row k="Phone" v={intake.primaryContactPhone ?? "—"} />
            <Row k="Role" v={intake.primaryContactRole ?? "—"} />
          </dl>
        </div>

        <div className="border rounded-md p-5">
          <h2 className="font-serif text-lg font-semibold mb-3">Portfolio</h2>
          <dl className="space-y-1 text-sm">
            <Row k="Property type" v={intake.propertyType} />
            <Row
              k="Residential subtype"
              v={intake.residentialSubtype ?? "—"}
            />
            <Row
              k="Commercial subtype"
              v={intake.commercialSubtype ?? "—"}
            />
            <Row
              k="Properties"
              v={intake.numberOfProperties?.toString() ?? "—"}
            />
            <Row
              k="Backend"
              v={intake.currentBackendPlatform ?? "—"}
            />
            <Row k="Backend plan" v={intake.backendPlanTier ?? "—"} />
            <Row k="Current vendor" v={intake.currentVendor ?? "—"} />
            <Row k="Monthly spend" v={monthlySpend} />
            <Row k="Pain point" v={intake.biggestPainPoint ?? "—"} />
          </dl>
        </div>

        <div className="border rounded-md p-5">
          <h2 className="font-serif text-lg font-semibold mb-3">
            Selected modules
          </h2>
          {selected.length === 0 ? (
            <p className="text-xs opacity-60">None selected</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {selected.map((m) => (
                <li
                  key={m}
                  className="text-[11px] px-2 py-1 border rounded bg-muted/40"
                >
                  {m}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border rounded-md p-5">
          <h2 className="font-serif text-lg font-semibold mb-3">Timeline</h2>
          <dl className="space-y-1 text-sm">
            <Row k="Go-live target" v={intake.goLiveTarget ?? "—"} />
            <Row
              k="Call booked"
              v={
                intake.bookedCallAt
                  ? new Date(intake.bookedCallAt).toLocaleString()
                  : "—"
              }
            />
            <Row k="Cal booking id" v={intake.calBookingId ?? "—"} />
          </dl>
        </div>

        <div className="border rounded-md p-5">
          <h2 className="font-serif text-lg font-semibold mb-3">
            Submission metadata
          </h2>
          <dl className="space-y-1 text-sm">
            <Row
              k="Submitted at"
              v={new Date(intake.submittedAt).toLocaleString()}
            />
            <Row k="IP address" v={intake.ipAddress ?? "—"} />
            <Row k="Referrer" v={intake.referrer ?? "—"} />
            <Row k="UTM source" v={intake.utmSource ?? "—"} />
            <Row k="UTM medium" v={intake.utmMedium ?? "—"} />
            <Row k="UTM campaign" v={intake.utmCampaign ?? "—"} />
          </dl>
        </div>
      </section>

      <details className="border rounded-md p-4">
        <summary className="text-xs tracking-widest uppercase opacity-60 cursor-pointer">
          Raw payload
        </summary>
        <pre className="mt-3 text-[11px] bg-muted/40 rounded p-3 overflow-x-auto">
          {JSON.stringify(intake.raw ?? {}, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs opacity-60">{k}</dt>
      <dd className="text-right truncate max-w-[60%]">{v}</dd>
    </div>
  );
}
