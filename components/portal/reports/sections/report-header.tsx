import * as React from "react";
import { ClientLogo } from "@/components/portal/reports/client-logo";

type ReportHeaderProps = {
  kindLabel: string;
  periodLabel: string;
  orgName?: string | null;
  orgLogoUrl?: string | null;
  headline?: string | null;
  notes?: string | null;
  /** snapshot.scope?.propertyName — null for portfolio-wide reports. */
  propertyName?: string | null;
};

// Print-only branded header. Hidden on screen via the
// `print-only-header` class (CSS in [id]/page.tsx). In print this
// renders as the first thing on page 1 — wordmark + org name +
// report kind + period — so the PDF opens with a clear,
// self-contained title block instead of jumping straight into
// the metric tiles.
export function ReportPrintHeader({
  kindLabel,
  periodLabel,
  orgName,
  orgLogoUrl,
  headline,
  notes,
  propertyName,
}: ReportHeaderProps) {
  return (
    <header
      className="print-only-header"
      style={{
        display: "none",
        paddingBottom: "12pt",
        marginBottom: "10pt",
        borderBottom: "1pt solid #e0e0e0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16pt",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "9pt",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#0f62fe",
              fontWeight: 700,
              marginBottom: "4pt",
            }}
          >
            LeaseStack · {kindLabel}
          </div>
          <h1
            style={{
              fontSize: "22pt",
              fontWeight: 700,
              color: "#161616",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {orgName ?? "Performance review"}
          </h1>
          <p
            style={{
              fontSize: "10.5pt",
              color: "#525252",
              marginTop: "4pt",
              marginBottom: 0,
            }}
          >
            {propertyName
              ? `${propertyName} · ${periodLabel}`
              : `Portfolio · all properties · ${periodLabel}`}
          </p>
        </div>
        {orgLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={orgLogoUrl}
            alt={orgName ?? "Logo"}
            style={{ height: "42pt", width: "auto", objectFit: "contain" }}
          />
        ) : null}
      </div>
      {headline || notes ? (
        <div
          style={{
            marginTop: "10pt",
            paddingTop: "8pt",
            borderTop: "1pt solid #e0e0e0",
          }}
        >
          {headline ? (
            <p
              style={{
                fontSize: "11.5pt",
                fontWeight: 600,
                color: "#161616",
                margin: "0 0 4pt",
              }}
            >
              {headline}
            </p>
          ) : null}
          {notes ? (
            <p
              style={{
                fontSize: "10pt",
                color: "#525252",
                margin: 0,
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {notes}
            </p>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

// On-screen header strip.
export function ReportHeaderStrip({
  kindLabel,
  periodLabel,
  orgName,
  orgLogoUrl,
  headline,
  notes,
  propertyName,
}: ReportHeaderProps) {
  return (
    <header className="ls-report-section rounded-[2px] border border-border bg-card px-5 py-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex items-baseline gap-3 flex-wrap">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground shrink-0">
            {kindLabel}
          </span>
          <span className="text-base font-semibold tracking-tight text-foreground truncate">
            {orgName ?? "Performance review"}
          </span>
          {propertyName ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf5ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#0043ce]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0f62fe]" />
              {propertyName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8e8e8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#525252]">
              Portfolio · all properties
            </span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">
            {periodLabel}
          </span>
        </div>
        {/* Co-branded lockup: the client's own logo (rendered cleanly,
            hidden if it fails to load) alongside a "Prepared by LeaseStack"
            wordmark so the report reads as a professional, attributed
            artifact instead of a squished mystery logo. */}
        <div className="flex items-center gap-3 shrink-0">
          {orgLogoUrl ? (
            <ClientLogo
              src={orgLogoUrl}
              alt={orgName ?? "Client logo"}
              className="h-8 w-auto max-w-[132px] object-contain"
            />
          ) : null}
          {orgLogoUrl ? (
            <span className="hidden sm:block h-7 w-px bg-border" aria-hidden />
          ) : null}
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Prepared by
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/leasestack-wordmark.png"
              alt="LeaseStack"
              className="mt-1 block h-6 w-auto"
            />
          </div>
        </div>
      </div>

      {headline || notes ? (
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          {headline ? (
            <p className="text-sm font-semibold text-foreground leading-snug">
              {headline}
            </p>
          ) : null}
          {notes ? (
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {notes}
            </p>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
