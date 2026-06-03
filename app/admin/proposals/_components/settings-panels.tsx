"use client";

import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { ProposalCadence } from "@prisma/client";
import { SectionCard } from "@/components/admin/page-header";
import type { ComposerProposal, ComposerTimelinePhase } from "./types";

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
        label="Scope of work"
        description="Narrative description of what you'll deliver. Renders between the title and the line items on the PDF. Markdown bold (**text**) survives."
      >
        <textarea
          disabled={!headerHardEditable}
          value={proposal.scopeNarrative ?? ""}
          onChange={(e) =>
            onPatch({ scopeNarrative: e.target.value || null })
          }
          rows={8}
          placeholder={`We'll build and launch a per-property marketing surface — hosted property pages, the AI Leasing Chatbot trained on your unit data, and the Cursive visitor pixel for identity resolution. Includes weekly performance reviews and a dedicated Slack channel for the first 60 days.`}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 font-sans"
        />
      </SectionCard>

      <TimelineEditor
        phases={proposal.timeline}
        editable={headerHardEditable}
        onChange={(timeline) => onPatch({ timeline })}
      />

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

function TimelineEditor({
  phases,
  editable,
  onChange,
}: {
  phases: ComposerTimelinePhase[];
  editable: boolean;
  onChange: (next: ComposerTimelinePhase[]) => void;
}) {
  function patchPhase(
    idx: number,
    patch: Partial<ComposerTimelinePhase>,
  ): void {
    const next = phases.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onChange(next);
  }
  function addPhase(): void {
    const lastEnd =
      phases.length > 0 ? phases[phases.length - 1].endWeek : -1;
    onChange([
      ...phases,
      {
        phase: `Phase ${phases.length + 1}`,
        startWeek: Math.max(0, lastEnd + 1),
        endWeek: Math.max(0, lastEnd + 2),
        deliverables: [],
      },
    ]);
  }
  function removePhase(idx: number): void {
    onChange(phases.filter((_, i) => i !== idx));
  }
  function movePhase(idx: number, dir: -1 | 1): void {
    const target = idx + dir;
    if (target < 0 || target >= phases.length) return;
    const next = [...phases];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    onChange(next);
  }
  function patchDeliverable(
    pIdx: number,
    dIdx: number,
    value: string,
  ): void {
    const phase = phases[pIdx];
    const deliverables = phase.deliverables.map((d, i) =>
      i === dIdx ? value : d,
    );
    patchPhase(pIdx, { deliverables });
  }
  function addDeliverable(pIdx: number): void {
    patchPhase(pIdx, {
      deliverables: [...phases[pIdx].deliverables, ""],
    });
  }
  function removeDeliverable(pIdx: number, dIdx: number): void {
    patchPhase(pIdx, {
      deliverables: phases[pIdx].deliverables.filter((_, i) => i !== dIdx),
    });
  }

  return (
    <SectionCard
      label="Delivery timeline"
      description="Phases keyed off acceptance (week 0 = signed-and-paid day). Renders as a phase × deliverables table on the PDF."
    >
      <div className="space-y-3">
        {phases.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No phases yet. Add one to publish a delivery schedule on the
            PDF — prospects expect to know when they'll see the first
            deliverable.
          </p>
        ) : null}
        {phases.map((p, idx) => (
          <div
            key={idx}
            className="rounded-md border border-border bg-card p-3 space-y-2"
          >
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 md:col-span-5">
                <Field label={`Phase ${idx + 1} name`}>
                  <input
                    type="text"
                    disabled={!editable}
                    value={p.phase}
                    onChange={(e) =>
                      patchPhase(idx, { phase: e.target.value })
                    }
                    placeholder="Kickoff"
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </Field>
              </div>
              <div className="col-span-4 md:col-span-2">
                <Field label="Start week">
                  <input
                    type="number"
                    min={0}
                    max={520}
                    disabled={!editable}
                    value={p.startWeek}
                    onChange={(e) =>
                      patchPhase(idx, {
                        startWeek: Math.max(
                          0,
                          Math.floor(Number(e.target.value) || 0),
                        ),
                      })
                    }
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </Field>
              </div>
              <div className="col-span-4 md:col-span-2">
                <Field label="End week">
                  <input
                    type="number"
                    min={p.startWeek}
                    max={520}
                    disabled={!editable}
                    value={p.endWeek}
                    onChange={(e) =>
                      patchPhase(idx, {
                        endWeek: Math.max(
                          p.startWeek,
                          Math.floor(Number(e.target.value) || p.startWeek),
                        ),
                      })
                    }
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </Field>
              </div>
              <div className="col-span-4 md:col-span-3 flex items-center justify-end gap-1 pt-4">
                <button
                  type="button"
                  disabled={!editable || idx === 0}
                  onClick={() => movePhase(idx, -1)}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={!editable || idx === phases.length - 1}
                  onClick={() => movePhase(idx, 1)}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => removePhase(idx)}
                  className="p-1.5 rounded hover:bg-muted text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Delete phase"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Deliverables
              </p>
              {p.deliverables.length === 0 ? (
                <p className="text-[11.5px] italic text-muted-foreground">
                  No deliverables yet — add what the prospect should
                  expect from this phase.
                </p>
              ) : null}
              {p.deliverables.map((d, dIdx) => (
                <div key={dIdx} className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled={!editable}
                    value={d}
                    onChange={(e) =>
                      patchDeliverable(idx, dIdx, e.target.value)
                    }
                    placeholder="Site live on staging URL"
                    className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => removeDeliverable(idx, dIdx)}
                    className="p-1.5 rounded hover:bg-muted text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remove deliverable"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={!editable}
                onClick={() => addDeliverable(idx)}
                className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                Add deliverable
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          disabled={!editable}
          onClick={addPhase}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          Add phase
        </button>
      </div>
    </SectionCard>
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
