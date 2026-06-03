"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProposalLineKind, ProposalStatus } from "@prisma/client";
import { SectionCard } from "@/components/admin/page-header";
import { addLineFromCatalog, saveDraft } from "../actions";
import {
  computeProposalTotalsShared,
  type LineLikeShared,
} from "@/lib/proposals/totals-shared";
import { CatalogRail } from "./catalog-rail";
import { LineRow } from "./line-row";
import { TotalsPanel } from "./totals-panel";
import { ComposerToolbar } from "./composer-toolbar";
import { PreviewMini, SettingsPanels } from "./settings-panels";
import type {
  ComposerCatalogItem,
  ComposerLine,
  ComposerProposal,
} from "./types";

// ---------------------------------------------------------------------------
// Composer — the proposal builder.
//
// State model: local optimistic mirror of the proposal + lines. Debounced
// 800ms autosave fires `saveDraft` with the full local snapshot. On any
// "structural" action (add line from catalog) we call the dedicated server
// action so server-side numbering/sort/totals stay authoritative and then
// rely on revalidatePath to refresh the parent.
// ---------------------------------------------------------------------------

const AUTOSAVE_DELAY_MS = 800;

export function Composer({
  proposal,
  lines: initialLines,
  catalog,
  shareUrl,
  readOnly,
  softReadOnly,
}: {
  proposal: ComposerProposal;
  lines: ComposerLine[];
  catalog: ComposerCatalogItem[];
  shareUrl: string | null;
  /** Fully read-only (ACCEPTED / DECLINED / EXPIRED / CANCELED). */
  readOnly: boolean;
  /** Soft read-only (SENT / VIEWED): only publicMessage + expiresAt editable. */
  softReadOnly: boolean;
}) {
  const [localProposal, setLocalProposal] = useState<ComposerProposal>(proposal);
  const [localLines, setLocalLines] = useState<ComposerLine[]>(initialLines);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // Sync from server props after a route refresh.
  useEffect(() => {
    setLocalProposal(proposal);
  }, [proposal]);
  useEffect(() => {
    setLocalLines(initialLines);
  }, [initialLines]);

  const linesEditable = !readOnly && !softReadOnly;
  const headerHardEditable = !readOnly && !softReadOnly;
  const softFieldsEditable = !readOnly;

  const totals = useMemo(() => {
    const header = {
      cadence: localProposal.cadence,
      trialDays: localProposal.trialDays,
      discountAmountCents: localProposal.discountAmountCents,
      discountScope: localProposal.discountScope,
    };
    const linesLike: LineLikeShared[] = localLines.map((l) => ({
      unitPriceCents: l.unitPriceCents,
      quantity: l.quantity,
      recurring: l.recurring,
    }));
    return computeProposalTotalsShared(header, linesLike);
  }, [localProposal, localLines]);

  const scheduleSave = useCallback(() => {
    if (readOnly) return;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!dirtyRef.current) return;
      setSaving(true);
      try {
        await saveDraft({
          proposalId: localProposal.id,
          fields: {
            cadence: localProposal.cadence,
            trialDays: localProposal.trialDays,
            publicMessage: localProposal.publicMessage,
            internalNotes: localProposal.internalNotes,
            expiresAt: localProposal.expiresAt,
            discountAmountCents: localProposal.discountAmountCents,
            discountReason: localProposal.discountReason,
            discountScope: isDiscountScope(localProposal.discountScope)
              ? localProposal.discountScope
              : "both",
          },
          lines: linesEditable
            ? localLines.map((l, idx) => ({
                id: l.id,
                kind: l.kind,
                catalogItemId: l.catalogItemId ?? null,
                label: l.label,
                description: l.description,
                unitPriceCents: l.unitPriceCents,
                quantity: l.quantity,
                recurring: l.recurring,
                sortOrder: idx,
              }))
            : undefined,
        });
        // review-fix: dirty flag cleared only after success. Previously
        // we cleared BEFORE the await; a save that threw, or a keystroke
        // arriving during the in-flight save, was silently lost — the
        // ref stayed `false` and no follow-up timer fired until the next
        // keystroke. Clearing here means an in-flight typing burst stays
        // marked dirty until persisted; failure leaves it dirty so the
        // next scheduleSave retries.
        dirtyRef.current = false;
      } catch (err) {
        console.error("[composer] save failed:", err);
        // Keep dirtyRef true so the next scheduleSave re-attempts.
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_DELAY_MS);
  }, [localProposal, localLines, linesEditable, readOnly]);

  // Mutators
  const patchProposal = useCallback(
    (patch: Partial<ComposerProposal>) => {
      setLocalProposal((p) => ({ ...p, ...patch }));
      scheduleSave();
    },
    [scheduleSave],
  );

  const patchLine = useCallback(
    (id: string, patch: Partial<ComposerLine>) => {
      setLocalLines((arr) =>
        arr.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      );
      scheduleSave();
    },
    [scheduleSave],
  );

  const removeLine = useCallback(
    (id: string) => {
      setLocalLines((arr) => arr.filter((l) => l.id !== id));
      scheduleSave();
    },
    [scheduleSave],
  );

  const moveLine = useCallback(
    (id: string, direction: -1 | 1) => {
      setLocalLines((arr) => {
        const idx = arr.findIndex((l) => l.id === id);
        if (idx < 0) return arr;
        const target = idx + direction;
        if (target < 0 || target >= arr.length) return arr;
        // review-fix: pure swap via `map` instead of in-place index
        // assignment. Spread-copying the array and then mutating slots
        // is the exact "shallow clone + mutate" pattern flagged by the
        // global coding-style.md immutability rule.
        return arr.map((line, i) => {
          if (i === idx) return arr[target];
          if (i === target) return arr[idx];
          return line;
        });
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const addCatalog = useCallback(
    async (catalogItemId: string) => {
      try {
        await addLineFromCatalog({
          proposalId: localProposal.id,
          catalogItemId,
        });
        // The server action revalidates the page; parent will re-render with
        // the new line. We don't optimistically insert because we don't have
        // a server-generated id yet.
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : "Failed to add line");
      }
    },
    [localProposal.id],
  );

  function addBlankLine() {
    if (!linesEditable) return;
    setLocalLines((arr) => [
      ...arr,
      {
        id: `tmp-${crypto.randomUUID()}`,
        kind: ProposalLineKind.CUSTOM,
        catalogItemId: null,
        label: "Custom line",
        description: null,
        unitPriceCents: 0,
        quantity: 1,
        recurring: true,
        sortOrder: arr.length,
      },
    ]);
    scheduleSave();
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_320px] gap-5">
      {/* Left rail: catalog */}
      <aside className="space-y-3 xl:order-1">
        <SectionCard label="Catalog" padded>
          <CatalogRail
            catalog={catalog}
            onAdd={addCatalog}
            disabled={!linesEditable}
          />
        </SectionCard>
      </aside>

      {/* Center: lines + toolbar */}
      <main className="space-y-4 xl:order-2 min-w-0">
        <ComposerToolbar
          proposal={localProposal}
          firstInvoiceCents={totals.firstInvoiceTotal}
          shareUrl={shareUrl}
          saving={saving}
          hasLines={localLines.length > 0}
        />

        {softReadOnly ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            This proposal has been sent. Line items and pricing are locked —
            use Duplicate to revise. You can still update the public message
            and expiry below.
          </div>
        ) : null}

        {readOnly ? (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
            This proposal is {labelStatus(localProposal.status)} — read-only.
          </div>
        ) : null}

        <SectionCard
          label="Line items"
          action={
            linesEditable ? (
              <button
                type="button"
                onClick={addBlankLine}
                className="text-xs px-2 py-1 rounded-md border border-border bg-card hover:bg-muted/40"
              >
                + Custom line
              </button>
            ) : null
          }
        >
          {localLines.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No lines yet. Click a catalog item on the left to add one.
            </p>
          ) : (
            <ul className="space-y-2">
              {localLines.map((line, idx) => (
                <li key={line.id}>
                  <LineRow
                    line={line}
                    index={idx}
                    total={localLines.length}
                    disabled={!linesEditable}
                    onPatch={(p) => patchLine(line.id, p)}
                    onRemove={() => removeLine(line.id)}
                    onMoveUp={() => moveLine(line.id, -1)}
                    onMoveDown={() => moveLine(line.id, 1)}
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SettingsPanels
          proposal={localProposal}
          headerHardEditable={headerHardEditable}
          softFieldsEditable={softFieldsEditable}
          onPatch={patchProposal}
        />
      </main>

      {/* Right: totals + preview */}
      <aside className="space-y-4 xl:order-3">
        <TotalsPanel
          header={{
            cadence: localProposal.cadence,
            trialDays: localProposal.trialDays,
            discountAmountCents: localProposal.discountAmountCents,
            discountScope: localProposal.discountScope,
          }}
          lines={localLines.map((l) => ({
            unitPriceCents: l.unitPriceCents,
            quantity: l.quantity,
            recurring: l.recurring,
          }))}
        />

        <SectionCard label="Live preview" padded>
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Mini render of what the prospect will see.
            </p>
            <PreviewMini
              proposal={localProposal}
              lines={localLines}
              firstInvoiceCents={totals.firstInvoiceTotal}
            />
          </div>
        </SectionCard>
      </aside>
    </div>
  );
}

function labelStatus(s: ProposalStatus): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function isDiscountScope(
  v: string,
): v is "recurring" | "one_time" | "both" {
  return v === "recurring" || v === "one_time" || v === "both";
}
