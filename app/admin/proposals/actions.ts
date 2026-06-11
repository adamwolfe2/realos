"use server";

import { revalidatePath } from "next/cache";
import { Prisma, ProposalStatus, ProposalLineKind, ProposalCadence } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { computeSubtotalsCents } from "@/lib/proposals/totals";
import { generateProposalNumber } from "@/lib/proposals/numbering";

// Server actions for the proposal builder. Every export calls requireAgency()
// and re-validates the proposal status before mutating — defense in depth so
// a stale browser tab can't bypass UI gates.

type ProspectInput = {
  name: string;
  email: string;
  company?: string | null;
  intakeId?: string | null;
  orgId?: string | null;
};

type ProposalTimelinePhaseInput = {
  phase: string;
  startWeek: number;
  endWeek: number;
  deliverables: string[];
};

type ProposalFields = {
  cadence?: ProposalCadence | null;
  trialDays?: number;
  publicMessage?: string | null;
  internalNotes?: string | null;
  expiresAt?: string | null;     // ISO date string, "" → null
  discountAmountCents?: number;
  discountReason?: string | null;
  discountScope?: "recurring" | "one_time" | "both";
  // Scope of work + delivery timeline (Adam ask 2026-06-03). Both surface
  // on the PDF + share page between the title block and the line items.
  scopeNarrative?: string | null;
  timeline?: ProposalTimelinePhaseInput[] | null;
};

type LineInput = {
  id?: string;                   // present = update, absent = insert
  kind: ProposalLineKind;
  catalogItemId?: string | null;
  label: string;
  description?: string | null;
  unitPriceCents: number;
  quantity?: number;
  recurring?: boolean;
  sortOrder?: number;
};

function clampInt(n: unknown, min: number, max: number): number {
  const raw = Number(n);
  if (!Number.isFinite(raw)) return min;
  return Math.max(min, Math.min(max, Math.floor(raw)));
}

function parseExpires(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function assertEditable(
  status: ProposalStatus,
  mode: "full" | "soft" = "full",
): void {
  // ACCEPTED / DECLINED / EXPIRED / CANCELED → no edits at all.
  if (
    status === ProposalStatus.ACCEPTED ||
    status === ProposalStatus.DECLINED ||
    status === ProposalStatus.EXPIRED ||
    status === ProposalStatus.CANCELED
  ) {
    throw new Error(`Proposal is ${status.toLowerCase()} and cannot be edited`);
  }
  // SENT / VIEWED → only soft edits (publicMessage, expiresAt) allowed.
  if (
    mode === "full" &&
    (status === ProposalStatus.SENT || status === ProposalStatus.VIEWED)
  ) {
    throw new Error(
      "Proposal has been sent; line items and pricing are locked. Use Duplicate to revise.",
    );
  }
}

// createDraft
export async function createDraft(args: {
  prospect: ProspectInput;
}): Promise<{ proposalId: string }> {
  const scope = await requireAgency();

  // Best-effort uniqueness: generateProposalNumber reads a count; on a P2002
  // race we retry once with a fresh count. Any other error bubbles.
  for (let attempt = 0; attempt < 2; attempt++) {
    const number = await generateProposalNumber();
    try {
      const created = await prisma.proposal.create({
        data: {
          number,
          status: ProposalStatus.DRAFT,
          prospectName: args.prospect.name || "Untitled prospect",
          prospectEmail: args.prospect.email || "",
          prospectCompany: args.prospect.company ?? null,
          prospectOrgId: args.prospect.orgId ?? null,
          intakeId: args.prospect.intakeId ?? null,
          cadence: ProposalCadence.MONTHLY,
          createdById: scope.userId,
        },
        select: { id: true },
      });
      revalidatePath("/admin/proposals");
      return { proposalId: created.id };
    } catch (err) {
      const isUnique =
        err != null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002";
      if (!isUnique) throw err;
      // race on number — loop again
    }
  }
  throw new Error("Failed to allocate proposal number after retry");
}

// saveDraft — header fields + optional bulk lines replacement
export async function saveDraft(args: {
  proposalId: string;
  fields?: ProposalFields;
  lines?: LineInput[];
}): Promise<{ ok: true }> {
  await requireAgency();
  const { proposalId, fields, lines } = args;

  const existing = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { status: true },
  });
  if (!existing) throw new Error("Proposal not found");

  const isSent =
    existing.status === ProposalStatus.SENT ||
    existing.status === ProposalStatus.VIEWED;

  // For DRAFT: allow everything. For SENT/VIEWED: only publicMessage +
  // expiresAt. ACCEPTED/etc: nothing.
  assertEditable(existing.status, isSent ? "soft" : "full");

  await prisma.$transaction(async (tx) => {
    if (lines && !isSent) {
      // Replace strategy: delete all then re-create with explicit sortOrder.
      // Simpler than diffing and the lists are tiny (<50 lines typical).
      await tx.proposalLineItem.deleteMany({ where: { proposalId } });
      if (lines.length > 0) {
        await tx.proposalLineItem.createMany({
          data: lines.map((l, idx) => ({
            proposalId,
            kind: l.kind,
            catalogItemId: l.catalogItemId ?? null,
            label: l.label,
            description: l.description ?? null,
            unitPriceCents: clampInt(l.unitPriceCents, 0, 100_000_000),
            quantity: clampInt(l.quantity ?? 1, 1, 10_000),
            recurring: l.recurring ?? true,
            sortOrder: l.sortOrder ?? idx,
          })),
        });
      }
    }

    // Recompute subtotals from the canonical (post-write) line set so the
    // cached fields on Proposal stay in sync inside the same transaction.
    const freshLines = await tx.proposalLineItem.findMany({
      where: { proposalId },
      select: { unitPriceCents: true, quantity: true, recurring: true },
    });
    const subtotals = computeSubtotalsCents(freshLines);

    const data: Prisma.ProposalUpdateInput = {
      recurringSubtotalCents: subtotals.recurring,
      oneTimeSubtotalCents: subtotals.oneTime,
      // Invalidate PDF cache on any change
      pdfCachedAt: null,
      pdfBlobUrl: null,
      // Bump checkoutVersion so the next /accept generates a FRESH
      // Stripe coupon + checkout session — without this, a discount or
      // price edit silently replays the previous Stripe idempotency key
      // and the customer is charged the OLD amount (security review,
      // HIGH). Cheap to bump even on no-op saves; coupons expire 24h.
      checkoutVersion: { increment: 1 },
    };

    if (fields) {
      if (!isSent) {
        if (fields.cadence !== undefined) data.cadence = fields.cadence;
        if (fields.trialDays !== undefined) {
          data.trialDays = clampInt(fields.trialDays, 0, 365);
        }
        if (fields.internalNotes !== undefined) {
          data.internalNotes = fields.internalNotes;
        }
        if (fields.discountAmountCents !== undefined) {
          data.discountAmountCents = clampInt(
            fields.discountAmountCents,
            0,
            100_000_000,
          );
        }
        if (fields.discountReason !== undefined) {
          data.discountReason = fields.discountReason;
        }
        if (fields.discountScope !== undefined) {
          data.discountScope = fields.discountScope;
        }
      }
      // Always-editable while not terminal:
      if (fields.publicMessage !== undefined) {
        data.publicMessage = fields.publicMessage;
      }
      if (fields.expiresAt !== undefined) {
        data.expiresAt = parseExpires(fields.expiresAt);
      }
      // Scope + timeline editable while DRAFT only (parity with line
      // items). Once SENT, the prospect has a copy in their inbox; we
      // don't want stealth edits to the scope they already reviewed.
      if (!isSent) {
        if (fields.scopeNarrative !== undefined) {
          // 8 KB ceiling — markdown bodies past that don't survive the
          // PDF text-flow well anyway and tend to be paste-bombs.
          const raw =
            typeof fields.scopeNarrative === "string"
              ? fields.scopeNarrative
              : null;
          data.scopeNarrative =
            raw == null
              ? null
              : raw.length > 8000
                ? raw.slice(0, 8000)
                : raw;
        }
        if (fields.timeline !== undefined) {
          if (fields.timeline === null) {
            data.timeline = Prisma.DbNull;
          } else {
            // Sanitize each phase: trim strings, clamp weeks, drop bad
            // rows. The same normalizer runs on read in lib/proposals/
            // types.ts so the stored shape is always trusted.
            const cleaned: ProposalTimelinePhaseInput[] = [];
            for (const p of fields.timeline ?? []) {
              if (!p || typeof p !== "object") continue;
              const phase =
                typeof p.phase === "string" ? p.phase.trim() : "";
              if (!phase) continue;
              const start = clampInt(p.startWeek, 0, 520);
              const end = clampInt(p.endWeek, start, 520);
              const deliverables = Array.isArray(p.deliverables)
                ? p.deliverables
                    .filter(
                      (d): d is string =>
                        typeof d === "string" && d.trim().length > 0,
                    )
                    .map((d) => d.trim().slice(0, 240))
                    .slice(0, 20)
                : [];
              cleaned.push({
                phase: phase.slice(0, 80),
                startWeek: start,
                endWeek: end,
                deliverables,
              });
              if (cleaned.length >= 24) break; // 2-year cap on phase count
            }
            data.timeline =
              cleaned as unknown as Prisma.InputJsonValue;
          }
        }
      }
    }

    await tx.proposal.update({ where: { id: proposalId }, data });
  });

  revalidatePath(`/admin/proposals/${proposalId}`);
  revalidatePath("/admin/proposals");
  return { ok: true };
}

// addLineFromCatalog — convenience for the catalog rail
export async function addLineFromCatalog(args: {
  proposalId: string;
  catalogItemId: string;
}): Promise<{ ok: true }> {
  await requireAgency();
  const { proposalId, catalogItemId } = args;

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { status: true },
  });
  if (!proposal) throw new Error("Proposal not found");
  assertEditable(proposal.status, "full");

  const catalog = await prisma.proposalCatalogItem.findUnique({
    where: { id: catalogItemId },
  });
  if (!catalog || !catalog.active) throw new Error("Catalog item not found");

  await prisma.$transaction(async (tx) => {
    const count = await tx.proposalLineItem.count({ where: { proposalId } });
    await tx.proposalLineItem.create({
      data: {
        proposalId,
        catalogItemId: catalog.id,
        kind:
          catalog.kind === "TIER"
            ? ProposalLineKind.TIER
            : ProposalLineKind.ADDON,
        label: catalog.label,
        description: catalog.description,
        unitPriceCents: catalog.defaultPriceCents,
        quantity: 1,
        recurring: catalog.cadence != null,
        sortOrder: count,
      },
    });
    const freshLines = await tx.proposalLineItem.findMany({
      where: { proposalId },
      select: { unitPriceCents: true, quantity: true, recurring: true },
    });
    const subtotals = computeSubtotalsCents(freshLines);
    await tx.proposal.update({
      where: { id: proposalId },
      data: {
        recurringSubtotalCents: subtotals.recurring,
        oneTimeSubtotalCents: subtotals.oneTime,
        pdfCachedAt: null,
        pdfBlobUrl: null,
        // See saveDraft for the security rationale on checkoutVersion bump.
        checkoutVersion: { increment: 1 },
      },
    });
  });

  revalidatePath(`/admin/proposals/${proposalId}`);
  return { ok: true };
}

// updateLine / removeLine / reorderLines
async function recomputeAndRevalidate(proposalId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const freshLines = await tx.proposalLineItem.findMany({
      where: { proposalId },
      select: { unitPriceCents: true, quantity: true, recurring: true },
    });
    const subtotals = computeSubtotalsCents(freshLines);
    await tx.proposal.update({
      where: { id: proposalId },
      data: {
        recurringSubtotalCents: subtotals.recurring,
        oneTimeSubtotalCents: subtotals.oneTime,
        pdfCachedAt: null,
        pdfBlobUrl: null,
        // Force a fresh Stripe coupon + checkout key on next /accept so
        // edited prices actually flow through (security review HIGH —
        // see saveDraft for full rationale).
        checkoutVersion: { increment: 1 },
      },
    });
  });
  revalidatePath(`/admin/proposals/${proposalId}`);
}

export async function updateLine(args: {
  proposalId: string;
  lineId: string;
  patch: {
    label?: string;
    description?: string | null;
    unitPriceCents?: number;
    quantity?: number;
    recurring?: boolean;
  };
}): Promise<{ ok: true }> {
  await requireAgency();
  const proposal = await prisma.proposal.findUnique({
    where: { id: args.proposalId },
    select: { status: true },
  });
  if (!proposal) throw new Error("Proposal not found");
  assertEditable(proposal.status, "full");

  const data: Prisma.ProposalLineItemUpdateManyMutationInput = {};
  if (args.patch.label !== undefined) data.label = args.patch.label;
  if (args.patch.description !== undefined) {
    data.description = args.patch.description;
  }
  if (args.patch.unitPriceCents !== undefined) {
    data.unitPriceCents = clampInt(args.patch.unitPriceCents, 0, 100_000_000);
  }
  if (args.patch.quantity !== undefined) {
    data.quantity = clampInt(args.patch.quantity, 1, 10_000);
  }
  if (args.patch.recurring !== undefined) {
    data.recurring = args.patch.recurring;
  }

  // Scope the mutation to THIS proposal — updating by lineId alone let a
  // valid (editable) proposalId be paired with a lineId from another (e.g.
  // accepted/sent) proposal, tampering with a signed contract. (Codex.)
  const updated = await prisma.proposalLineItem.updateMany({
    where: { id: args.lineId, proposalId: args.proposalId },
    data,
  });
  if (updated.count === 0) {
    throw new Error("Line item not found on this proposal");
  }
  await recomputeAndRevalidate(args.proposalId);
  return { ok: true };
}

export async function removeLine(args: {
  proposalId: string;
  lineId: string;
}): Promise<{ ok: true }> {
  await requireAgency();
  const proposal = await prisma.proposal.findUnique({
    where: { id: args.proposalId },
    select: { status: true },
  });
  if (!proposal) throw new Error("Proposal not found");
  assertEditable(proposal.status, "full");

  // Scoped delete — never remove a line belonging to a different proposal.
  const deleted = await prisma.proposalLineItem.deleteMany({
    where: { id: args.lineId, proposalId: args.proposalId },
  });
  if (deleted.count === 0) {
    throw new Error("Line item not found on this proposal");
  }
  await recomputeAndRevalidate(args.proposalId);
  return { ok: true };
}

export async function reorderLines(args: {
  proposalId: string;
  ids: string[];
}): Promise<{ ok: true }> {
  await requireAgency();
  const proposal = await prisma.proposal.findUnique({
    where: { id: args.proposalId },
    select: { status: true },
  });
  if (!proposal) throw new Error("Proposal not found");
  assertEditable(proposal.status, "full");

  // Each reorder is scoped to THIS proposal — an id from another proposal
  // matches nothing (no-op) instead of reordering a foreign contract. (Codex.)
  await prisma.$transaction(
    args.ids.map((id, idx) =>
      prisma.proposalLineItem.updateMany({
        where: { id, proposalId: args.proposalId },
        data: { sortOrder: idx },
      }),
    ),
  );
  // review-fix: reorder visibly changes the PDF (line ordering is part
  // of the rendered document) AND the Stripe checkout (line ordering
  // surfaces on the receipt). Without this, the cached PDF blob keeps
  // serving the pre-reorder document and the next /accept builds a
  // session with stale ordering.
  await recomputeAndRevalidate(args.proposalId);
  return { ok: true };
}

// build-fix (audit 2026-06-02): the original block re-exported async
// server actions AND a type alias from this `"use server"` file. Next 16
// + Turbopack reject any non-async-function export in a "use server"
// file — including `export type` and `export { fn } from "x"` (which
// Turbopack treats as a passthrough, not a definition).
//
// Resolution: move the re-export bundle to a standalone barrel at
// `./actions-index.ts` that is NOT a "use server" file. That barrel can
// safely re-export each server action by name from its source file —
// the source files keep their own `"use server"` directive so the
// async boundary is preserved. Consumers that need the type alias
// import it directly from `./_actions/prospect-search`. Importers of
// the action surface continue to use this `actions.ts` file (no
// downstream change needed) because every action they need is either
// defined here directly or surfaced through `actions-index.ts`.
