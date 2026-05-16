"use client";

import { useState } from "react";
import { Copy, Check, Users, FileText, CheckSquare } from "lucide-react";

export type ReferralPropertyStat = {
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  orgSlug: string;
  referralLeads: number;
  referralLeads30d: number;
  referralApps: number;
  referralSigned: number;
  qrDataUrl: string | null;
};

export function ReferralLinkCard({ stat }: { stat: ReferralPropertyStat }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const referralUrl = `https://${stat.orgSlug}.leasestack.co/contact?ref=${stat.propertySlug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Property name */}
      <div>
        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          Property
        </div>
        <h3 className="mt-0.5 text-base font-semibold text-foreground">
          {stat.propertyName}
        </h3>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          icon={<Users className="h-3.5 w-3.5" />}
          label="Leads (30d)"
          value={stat.referralLeads30d}
        />
        <StatTile
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Applications"
          value={stat.referralApps}
        />
        <StatTile
          icon={<CheckSquare className="h-3.5 w-3.5" />}
          label="Signed"
          value={stat.referralSigned}
        />
      </div>

      {/* Referral link */}
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          Resident referral link
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground font-mono truncate select-all">
            {referralUrl}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            aria-label="Copy referral link"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-primary" />
                <span className="text-primary">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
        {copyFailed ? (
          <p className="text-[11px] text-destructive">
            Copy failed — select the link and copy manually.
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Share this link with current residents. When a prospect submits the
            contact form using this link, the lead is tagged as a referral.
          </p>
        )}
      </div>

      {/* QR Code */}
      {stat.qrDataUrl ? (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            QR code
          </div>
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stat.qrDataUrl}
              alt={`QR code for ${stat.propertyName} referral link`}
              className="w-24 h-24 border border-border rounded-md"
            />
            <div className="space-y-2 flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Print or display this QR code on flyers, bulletin boards, or in
                common areas. Residents scan it to open the referral link
                directly.
              </p>
              <a
                href={stat.qrDataUrl}
                download={`${stat.propertySlug}-referral-qr.png`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                Download QR
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {/* Email template suggestion */}
      <details className="group">
        <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-1.5">
          <span className="text-muted-foreground group-open:rotate-90 transition-transform inline-block">
            ▶
          </span>
          Show email template for residents
        </summary>
        <div className="mt-2 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
          {`Subject: Know someone looking for a place?

Hey [Name],

Love having you here at ${stat.propertyName}! If you know anyone who's looking for a great place to live, send them this link:

${referralUrl}

They'll get to the contact form and we'll reach out right away.

Thanks for spreading the word!`}
        </div>
      </details>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[9px] uppercase tracking-widest font-semibold">
          {label}
        </span>
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}
