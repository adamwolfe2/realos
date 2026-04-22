import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { ConvertIntakeButton } from "./convert-button";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  humanPropertyType,
  humanResidentialSubtype,
  humanCommercialSubtype,
  humanTenantStatus,
  tenantStatusTone,
} from "@/lib/format";
import type { BadgeTone } from "@/lib/format";

export const metadata: Metadata = { title: "Intake detail" };
export const dynamic = "force-dynamic";

type IntakeStatus =
  | "submitted"
  | "consultation_booked"
  | "in_review"
  | "converted"
  | "rejected";

function isIntakeStatus(v: string): v is IntakeStatus {
  return (
    v === "submitted" ||
    v === "consultation_booked" ||
    v === "in_review" ||
    v === "converted" ||
    v === "rejected"
  );
}

function humanIntakeStatus(s: IntakeStatus): string {
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
  }
}

function intakeStatusTone(s: IntakeStatus): BadgeTone {
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
  }
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

  const canAct =
    status === "submitted" ||
    status === "consultation_booked" ||
    status === "in_review";
  const monthlySpend =
    intake.currentMonthlySpendCents != null
      ? `$${Math.round(intake.currentMonthlySpendCents / 100).toLocaleString()}/mo`
      : "—";

  const portfolioTypeLabel = [
    humanPropertyType(intake.propertyType),
    intake.residentialSubtype
      ? humanResidentialSubtype(intake.residentialSubtype)
      : intake.commercialSubtype
        ? humanCommercialSubtype(intake.commercialSubtype)
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/admin/intakes"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <span aria-hidden="true">←</span> Intake queue
          </Link>
        }
        title={intake.companyName}
        description={
          <span className="flex items-center gap-2 flex-wrap">
            <StatusBadge tone={intakeStatusTone(status)}>
              {humanIntakeStatus(status)}
            </StatusBadge>
            <span className="text-muted-foreground/60">·</span>
            <span>
              {intake.primaryContactName}, {intake.primaryContactEmail}
              {intake.primaryContactPhone
                ? ` · ${intake.primaryContactPhone}`
                : ""}
            </span>
          </span>
        }
      />

      <p className="text-xs text-muted-foreground -mt-2">
        Submitted {new Date(intake.submittedAt).toLocaleString()}
        {intake.reviewedAt
          ? ` · Reviewed ${new Date(intake.reviewedAt).toLocaleString()}`
          : ""}
        {intake.convertedAt
          ? ` · Converted ${new Date(intake.convertedAt).toLocaleString()}`
          : ""}
      </p>

      {status === "converted" && intake.org ? (
        <SectionCard
          label="Converted client"
          action={
            <Link
              href={`/admin/clients/${intake.org.id}`}
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary-dark transition-colors"
            >
              Open client →
            </Link>
          }
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">
              {intake.org.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {intake.org.slug}
            </span>
            <StatusBadge tone={tenantStatusTone(intake.org.status)}>
              {humanTenantStatus(intake.org.status)}
            </StatusBadge>
            <span className="text-xs text-muted-foreground">
              {intake.org.clerkOrgId
                ? `Clerk org ${intake.org.clerkOrgId}`
                : "Clerk org not yet provisioned"}
            </span>
          </div>
        </SectionCard>
      ) : null}

      {status === "rejected" ? (
        <SectionCard label="Rejected">
          <p className="text-sm text-muted-foreground">
            This intake was marked rejected and won't be provisioned.
          </p>
        </SectionCard>
      ) : null}

      {canAct ? (
        <SectionCard
          label="Actions"
          description={`Convert provisions an Organization (CLIENT), creates a Clerk organization, and emails an admin invite to ${intake.primaryContactEmail}.`}
        >
          <ConvertIntakeButton intakeId={intake.id} />
        </SectionCard>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard label="Company">
          <dl className="space-y-1 text-sm">
            <Row k="Company name" v={intake.companyName} />
            <Row k="Short name" v={intake.shortName ?? "—"} />
            <Row k="Website" v={intake.websiteUrl ?? "—"} />
            <Row k="HQ city" v={intake.hqCity ?? "—"} />
            <Row k="HQ state" v={intake.hqState ?? "—"} />
          </dl>
        </SectionCard>

        <SectionCard label="Contact">
          <dl className="space-y-1 text-sm">
            <Row k="Name" v={intake.primaryContactName} />
            <Row k="Email" v={intake.primaryContactEmail} />
            <Row k="Phone" v={intake.primaryContactPhone ?? "—"} />
            <Row k="Role" v={intake.primaryContactRole ?? "—"} />
          </dl>
        </SectionCard>

        <SectionCard label="Portfolio">
          <dl className="space-y-1 text-sm">
            <Row k="Property type" v={portfolioTypeLabel || "—"} />
            <Row
              k="Properties"
              v={intake.numberOfProperties?.toString() ?? "—"}
            />
            <Row k="Backend" v={intake.currentBackendPlatform ?? "—"} />
            <Row k="Backend plan" v={intake.backendPlanTier ?? "—"} />
            <Row k="Current vendor" v={intake.currentVendor ?? "—"} />
            <Row k="Monthly spend" v={monthlySpend} />
            <Row k="Pain point" v={intake.biggestPainPoint ?? "—"} />
          </dl>
        </SectionCard>

        <SectionCard label="Selected modules">
          {selected.length === 0 ? (
            <p className="text-xs text-muted-foreground">None selected</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {selected.map((m) => (
                <li
                  key={m}
                  className="text-[11px] px-2 py-1 rounded-md border border-border bg-muted/40 text-foreground"
                >
                  {m}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard label="Timeline">
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
        </SectionCard>

        <SectionCard label="Submission metadata">
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
        </SectionCard>
      </section>

      <details className="rounded-lg border border-border bg-card p-4">
        <summary className="text-xs tracking-widest uppercase text-muted-foreground cursor-pointer">
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
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="text-right truncate max-w-[60%] text-foreground">{v}</dd>
    </div>
  );
}
