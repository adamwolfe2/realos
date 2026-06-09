"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StatusPill, type StatusTone } from "@/components/portal/ui/status-pill";
import { ApplicationStatus, ApplicantRole } from "@prisma/client";
import { Mail, Phone, CalendarClock, ExternalLink, ShieldCheck } from "lucide-react";
import type { ApplicationGroup } from "@/lib/applications/queries";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  STARTED: "Started",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn",
};

const STATUS_TONE: Record<ApplicationStatus, StatusTone> = {
  STARTED: "info",
  SUBMITTED: "active",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  DENIED: "danger",
  WITHDRAWN: "neutral",
};

const ROLE_LABEL: Record<ApplicantRole, string> = {
  PRIMARY: "Primary applicant",
  CO_APPLICANT: "Co-applicant",
  CO_SIGNER: "Co-signer",
  OCCUPANT: "Occupant",
  GUARANTOR: "Guarantor",
};

function fmt(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

export function ApplicantDetailDrawer({
  group,
  unitName,
  propertyName,
  onClose,
}: {
  group: ApplicationGroup | null;
  unitName: string;
  propertyName: string;
  onClose: () => void;
}) {
  const open = group !== null;

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {group ? (
          <>
            <SheetHeader className="border-b border-border">
              <div className="flex items-center gap-2">
                <StatusPill
                  label={STATUS_LABEL[group.status]}
                  tone={STATUS_TONE[group.status]}
                />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {group.applicants.length} applicant
                  {group.applicants.length === 1 ? "" : "s"}
                </span>
              </div>
              <SheetTitle className="text-base">{group.primaryName}</SheetTitle>
              <SheetDescription>
                {unitName} · {propertyName}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-3 px-4 pb-6">
              {group.applicants.map((a) => (
                <div
                  key={a.applicationId}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {a.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.isPrimary
                          ? ROLE_LABEL[a.role]
                          : `${ROLE_LABEL[a.role]} for ${group.primaryName}`}
                      </p>
                    </div>
                    <StatusPill
                      label={STATUS_LABEL[a.status]}
                      tone={STATUS_TONE[a.status]}
                    />
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarClock className="h-3 w-3 shrink-0" />
                      <span>Desired move-in</span>
                    </div>
                    <dd className="text-foreground tabular-nums">
                      {fmt(a.desiredMoveIn)}
                    </dd>

                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarClock className="h-3 w-3 shrink-0" />
                      <span>Received</span>
                    </div>
                    <dd className="text-foreground tabular-nums">
                      {fmt(a.receivedAt ?? a.appliedAt ?? a.createdAt)}
                    </dd>

                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ShieldCheck className="h-3 w-3 shrink-0" />
                      <span>Screening</span>
                    </div>
                    <dd className="text-foreground">
                      {a.screeningStatus ?? "None requested"}
                    </dd>

                    {a.decidedAt ? (
                      <>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarClock className="h-3 w-3 shrink-0" />
                          <span>Decided</span>
                        </div>
                        <dd className="text-foreground tabular-nums">
                          {fmt(a.decidedAt)}
                        </dd>
                      </>
                    ) : null}
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {a.email ? (
                      <a
                        href={`mailto:${encodeURIComponent(a.email)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-foreground hover:border-primary/40"
                      >
                        <Mail className="h-3 w-3" /> {a.email}
                      </a>
                    ) : null}
                    {a.phone ? (
                      <a
                        href={`tel:${encodeURIComponent(a.phone)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-foreground hover:border-primary/40"
                      >
                        <Phone className="h-3 w-3" /> {a.phone}
                      </a>
                    ) : null}
                  </div>

                  <Link
                    href={`/portal/leads/${a.leadId}`}
                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    Open lead <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
