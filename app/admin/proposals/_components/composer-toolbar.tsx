"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProposalStatus } from "@prisma/client";
// build-fix (audit 2026-06-02): import directly from `_actions/lifecycle`
// — see `app/admin/proposals/actions.ts` for full rationale.
import {
  sendProposal,
  voidProposal,
  duplicateProposal,
} from "../_actions/lifecycle";
import { formatCents } from "@/lib/proposals/totals-shared";
import type { ComposerProposal } from "./types";

// ---------------------------------------------------------------------------
// ComposerToolbar — top action bar of the proposal detail page.
//
// Send dialog: shows recipient + scheduled trial-end + first-invoice amount
// before firing the action. Void + Duplicate live here too. Preview opens
// the public share preview route in a new tab (handled by parent — we just
// link it).
// ---------------------------------------------------------------------------

export function ComposerToolbar({
  proposal,
  firstInvoiceCents,
  shareUrl,
  saving,
  hasLines,
}: {
  proposal: ComposerProposal;
  firstInvoiceCents: number;
  shareUrl: string | null;
  saving: boolean;
  hasLines: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState<
    null | "send" | "void" | "dup" | "resend"
  >(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [copied, setCopied] = useState(false);

  // Two valid send paths:
  //   1. With prospectEmail set → "Send proposal" — Resend emails the
  //      prospect a styled email with the share URL + PDF attached.
  //   2. Without prospectEmail → "Publish & copy link" — same status
  //      transition, same share-URL mint, no email. Operator copies
  //      and pastes the URL anywhere (Slack, sales chat, on a deck).
  //      Stripe collects the payer's email at checkout.
  // Both paths require DRAFT + at least one line item.
  const canSend = proposal.status === ProposalStatus.DRAFT && hasLines;
  const sendIsPublishOnly =
    canSend && proposal.prospectEmail.length === 0;
  const canVoid =
    proposal.status !== ProposalStatus.ACCEPTED &&
    proposal.status !== ProposalStatus.CANCELED &&
    proposal.status !== ProposalStatus.EXPIRED &&
    proposal.status !== ProposalStatus.DECLINED;

  async function doSend() {
    setWorking("send");
    try {
      const result = await sendProposal({ proposalId: proposal.id });
      // Auto-copy the share URL when there's no prospect email — the
      // operator's only path to share the proposal is pasting it
      // somewhere.
      if (!result.emailed && result.shareUrl) {
        try {
          await navigator.clipboard.writeText(result.shareUrl);
          toast.success("Published · share link copied to clipboard");
        } catch {
          toast.success(`Published · ${result.shareUrl}`);
        }
      } else {
        toast.success("Proposal sent");
      }
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setWorking(null);
      setConfirmSend(false);
    }
  }

  async function doVoid() {
    setWorking("void");
    try {
      await voidProposal({ proposalId: proposal.id, reason: voidReason });
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to void");
    } finally {
      setWorking(null);
      setConfirmVoid(false);
    }
  }

  async function doDuplicate() {
    setWorking("dup");
    try {
      const { newProposalId } = await duplicateProposal({
        proposalId: proposal.id,
      });
      router.push(`/admin/proposals/${newProposalId}?edit=1`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to duplicate");
      setWorking(null);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — clipboard failures aren't fatal
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {shareUrl ? (
        <button
          type="button"
          onClick={copyShareUrl}
          className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/40 transition-colors"
          title={shareUrl}
        >
          {copied ? "Copied" : "Copy share link"}
        </button>
      ) : null}

      <a
        href={`/api/admin/proposals/${proposal.id}/pdf`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/40 transition-colors"
      >
        Download PDF
      </a>

      <button
        type="button"
        onClick={doDuplicate}
        disabled={working === "dup"}
        className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted/40 transition-colors disabled:opacity-60"
      >
        Duplicate
      </button>

      {canVoid ? (
        <button
          type="button"
          onClick={() => setConfirmVoid(true)}
          className="inline-flex items-center rounded-md border border-destructive/40 text-destructive bg-card px-2.5 py-1 text-xs font-medium hover:bg-destructive/10 transition-colors"
        >
          Void
        </button>
      ) : null}

      <div className="ml-auto inline-flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {saving ? "Saving…" : "Saved"}
        </span>
        {canSend ? (
          <button
            type="button"
            onClick={() => setConfirmSend(true)}
            disabled={!hasLines}
            className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
            title={
              sendIsPublishOnly
                ? "Publish: mints a share URL anyone can pay (no email sent)"
                : "Email the prospect and mint the share URL"
            }
          >
            {sendIsPublishOnly ? "Publish & copy link" : "Send proposal"}
          </button>
        ) : null}
      </div>

      {confirmSend ? (
        <Dialog
          title={sendIsPublishOnly ? "Publish proposal" : "Send proposal"}
          onClose={() => setConfirmSend(false)}
        >
          {sendIsPublishOnly ? (
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
              No prospect email is set. Publishing will mint a share URL
              anyone with the link can pay — Stripe collects the payer&apos;s
              email at checkout. The link gets copied to your clipboard
              automatically.
            </p>
          ) : null}
          <dl className="text-sm space-y-1.5 mb-4">
            {proposal.prospectEmail ? (
              <Row k="To" v={`${proposal.prospectName} · ${proposal.prospectEmail}`} />
            ) : (
              <Row k="To" v="Anyone with the share link" />
            )}
            <Row
              k="Cadence"
              v={
                proposal.cadence === "ANNUAL"
                  ? "Annual"
                  : proposal.cadence === "MONTHLY"
                    ? "Monthly"
                    : "One-time"
              }
            />
            <Row k="Trial days" v={String(proposal.trialDays || 0)} />
            <Row k="Due at checkout" v={formatCents(firstInvoiceCents)} />
            {proposal.expiresAt ? (
              <Row
                k="Expires"
                v={new Date(proposal.expiresAt).toLocaleDateString()}
              />
            ) : null}
          </dl>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmSend(false)}
              className="px-3 py-1.5 text-xs rounded-md border border-border bg-card hover:bg-muted/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doSend}
              disabled={working === "send"}
              className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
            >
              {working === "send"
                ? sendIsPublishOnly
                  ? "Publishing…"
                  : "Sending…"
                : sendIsPublishOnly
                  ? "Publish & copy link"
                  : "Send now"}
            </button>
          </div>
        </Dialog>
      ) : null}

      {confirmVoid ? (
        <Dialog title="Void proposal" onClose={() => setConfirmVoid(false)}>
          <p className="text-sm text-muted-foreground mb-3">
            Voiding revokes the share link and marks the proposal canceled. The
            prospect can no longer accept.
          </p>
          <label className="block text-xs text-muted-foreground mb-1">
            Reason
          </label>
          <input
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. replaced by Proposal #2 / mispriced"
            className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmVoid(false)}
              className="px-3 py-1.5 text-xs rounded-md border border-border bg-card hover:bg-muted/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doVoid}
              disabled={working === "void"}
              className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-60"
            >
              {working === "void" ? "Voiding…" : "Void proposal"}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg border border-border shadow-xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-foreground mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="text-sm text-foreground text-right">{v}</dd>
    </div>
  );
}
