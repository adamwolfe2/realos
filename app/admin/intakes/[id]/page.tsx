import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { ConvertIntakeForm } from "./convert-form";

export const metadata: Metadata = { title: "Intake detail" };
export const dynamic = "force-dynamic";

export default async function IntakeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAgency();
  const { id } = await params;

  const intake = await prisma.intakeSubmission.findUnique({
    where: { id },
    include: {
      org: {
        select: { id: true, name: true, slug: true, status: true },
      },
    },
  });
  if (!intake) notFound();

  const selected = Array.isArray(intake.selectedModules)
    ? (intake.selectedModules as string[])
    : [];

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <Link
          href="/admin/intakes"
          className="text-xs opacity-60 hover:opacity-100"
        >
          ← Intake queue
        </Link>
        <h1 className="font-serif text-3xl font-bold mt-2">
          {intake.companyName}
        </h1>
        <p className="text-sm opacity-70 mt-1">
          {intake.primaryContactName}, {intake.primaryContactEmail}
          {intake.primaryContactPhone ? ` · ${intake.primaryContactPhone}` : ""}
        </p>
        <p className="text-xs opacity-60 mt-1">
          Submitted {new Date(intake.submittedAt).toLocaleString()} ·{" "}
          Status: {intake.status}
          {intake.bookedCallAt
            ? ` · Call booked ${new Date(
                intake.bookedCallAt
              ).toLocaleString()}`
            : ""}
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel label="Company">
          <Row k="Short name" v={intake.shortName ?? "—"} />
          <Row k="Website" v={intake.websiteUrl ?? "—"} />
          <Row k="HQ city" v={intake.hqCity ?? "—"} />
          <Row k="HQ state" v={intake.hqState ?? "—"} />
          <Row k="Contact role" v={intake.primaryContactRole ?? "—"} />
        </Panel>

        <Panel label="Property">
          <Row k="Property type" v={intake.propertyType} />
          <Row
            k="Residential subtype"
            v={intake.residentialSubtype ?? "—"}
          />
          <Row
            k="Commercial subtype"
            v={intake.commercialSubtype ?? "—"}
          />
          <Row k="Properties" v={intake.numberOfProperties?.toString() ?? "—"} />
        </Panel>

        <Panel label="Current stack">
          <Row k="Backend" v={intake.currentBackendPlatform ?? "—"} />
          <Row k="Plan" v={intake.backendPlanTier ?? "—"} />
          <Row k="Vendor" v={intake.currentVendor ?? "—"} />
          <Row
            k="Monthly spend"
            v={
              intake.currentMonthlySpendCents != null
                ? `$${Math.round(
                    intake.currentMonthlySpendCents / 100
                  ).toLocaleString()}/mo`
                : "—"
            }
          />
          <Row k="Pain point" v={intake.biggestPainPoint ?? "—"} />
          <Row k="Go-live target" v={intake.goLiveTarget ?? "—"} />
        </Panel>

        <Panel label="Selected modules">
          {selected.length === 0 ? (
            <p className="text-xs opacity-60">None</p>
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
        </Panel>
      </section>

      <section className="border rounded-md p-6">
        <h2 className="font-serif text-xl font-bold mb-2">
          Convert to tenant
        </h2>
        {intake.org ? (
          <div className="space-y-2">
            <p className="text-sm opacity-70">
              Already converted to{" "}
              <Link
                href={`/admin/clients/${intake.org.id}`}
                className="underline"
              >
                {intake.org.name}
              </Link>
              .
            </p>
          </div>
        ) : (
          <ConvertIntakeForm
            intakeId={intake.id}
            defaultSlug={intake.shortName ?? intake.companyName}
            defaultPropertyName={intake.companyName}
          />
        )}
      </section>
    </div>
  );
}

function Panel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-md p-4">
      <p className="text-[10px] tracking-widest uppercase opacity-60 mb-3">
        {label}
      </p>
      <dl className="space-y-1 text-sm">{children}</dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs opacity-60">{k}</dt>
      <dd className="text-right truncate">{v}</dd>
    </div>
  );
}
