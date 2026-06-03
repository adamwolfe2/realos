"use client";

import { ProposalCadence } from "@prisma/client";
import { SectionCard } from "@/components/admin/page-header";
import type { ComposerProposal } from "./types";

// ---------------------------------------------------------------------------
// Settings panels — cadence/trial/expires, public message, internal notes.
// Extracted from composer.tsx to keep that file under the 400-line cap.
// ---------------------------------------------------------------------------

export function SettingsPanels({
  proposal,
  headerHardEditable,
  softFieldsEditable,
  onPatch,
}: {
  proposal: ComposerProposal;
  headerHardEditable: boolean;
  softFieldsEditable: boolean;
  onPatch: (patch: Partial<ComposerProposal>) => void;
}) {
  return (
    <>
      <SectionCard label="Cadence + trial">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Cadence">
            <select
              disabled={!headerHardEditable}
              value={proposal.cadence ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onPatch({
                  cadence:
                    v === "MONTHLY"
                      ? ProposalCadence.MONTHLY
                      : v === "ANNUAL"
                        ? ProposalCadence.ANNUAL
                        : null,
                });
              }}
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUAL">Annual</option>
              <option value="">One-time only</option>
            </select>
          </Field>
          <Field label="Trial days">
            <input
              type="number"
              min={0}
              max={365}
              disabled={!headerHardEditable}
              value={proposal.trialDays}
              onChange={(e) =>
                onPatch({
                  trialDays: Math.max(
                    0,
                    Math.min(365, Math.floor(Number(e.target.value) || 0)),
                  ),
                })
              }
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </Field>
          <Field label="Expires at">
            <input
              type="date"
              disabled={!softFieldsEditable}
              value={
                proposal.expiresAt ? proposal.expiresAt.slice(0, 10) : ""
              }
              onChange={(e) =>
                onPatch({
                  expiresAt: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        label="Public message"
        description="Shown above the line items on the share page and PDF."
      >
        <textarea
          disabled={!softFieldsEditable}
          value={proposal.publicMessage ?? ""}
          onChange={(e) => onPatch({ publicMessage: e.target.value })}
          rows={4}
          placeholder="A note to the prospect — what this proposal covers and why it's tailored to them."
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </SectionCard>

      <SectionCard
        label="Internal notes"
        description="Agency-only. Never shown to the prospect."
      >
        <textarea
          disabled={!headerHardEditable}
          value={proposal.internalNotes ?? ""}
          onChange={(e) => onPatch({ internalNotes: e.target.value })}
          rows={3}
          placeholder="Negotiation context, follow-up reminders, etc."
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </SectionCard>
    </>
  );
}

export function PreviewMini({
  proposal,
  lines,
  firstInvoiceCents,
}: {
  proposal: ComposerProposal;
  lines: Array<{
    id: string;
    label: string;
    unitPriceCents: number;
    quantity: number;
    recurring: boolean;
  }>;
  firstInvoiceCents: number;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-4 space-y-2">
      <div className="text-xs text-muted-foreground uppercase tracking-widest">
        LeaseStack
      </div>
      <div className="text-sm font-semibold text-foreground">
        Proposal for {proposal.prospectCompany || proposal.prospectName}
      </div>
      {proposal.publicMessage ? (
        <p className="text-xs text-muted-foreground line-clamp-3 italic">
          "{proposal.publicMessage}"
        </p>
      ) : null}
      <ul className="space-y-1 pt-2 border-t border-border/60">
        {lines.slice(0, 5).map((l) => (
          <li
            key={l.id}
            className="flex items-baseline justify-between gap-2 text-[11px]"
          >
            <span className="text-foreground truncate">{l.label}</span>
            <span className="tabular-nums text-muted-foreground">
              ${((l.unitPriceCents * l.quantity) / 100).toLocaleString()}
              {l.recurring ? "/mo" : ""}
            </span>
          </li>
        ))}
        {lines.length > 5 ? (
          <li className="text-[11px] text-muted-foreground italic">
            + {lines.length - 5} more
          </li>
        ) : null}
      </ul>
      <div className="pt-2 border-t border-border/60 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Due today</span>
        <span className="text-sm font-semibold text-foreground tabular-nums">
          ${(firstInvoiceCents / 100).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
