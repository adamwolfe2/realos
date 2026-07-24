"use client";

import * as React from "react";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, X, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  savePropertyKnowledgeBase,
  type SaveKnowledgeBaseInput,
} from "@/lib/actions/knowledge-base";
import {
  computeKbCompleteness,
  type FloorPlan,
  type KnowledgeBaseShape,
} from "@/lib/properties/kb-completeness";

// Per-property structured knowledge base editor (slice S1). Drives the bot's
// grounded PROPERTY FACTS block. Completeness banner is WARN-ONLY — it nudges,
// never blocks. Floor plans are the headline: a type + square footage pair
// stops the bot inventing unit sizes (Telegraph "triple = 200 sq ft" bug).

const FIELD =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";
const LABEL = "block text-xs font-medium text-foreground mb-1";

// Floor-plan rows hold strings while editing (controlled inputs); we parse to
// numbers/cents only on submit. Prices are entered in whole dollars.
type FloorPlanRow = {
  type: string;
  bedrooms: string;
  bathrooms: string;
  squareFeet: string;
  priceMinDollars: string;
  priceMaxDollars: string;
  notes: string;
};

export type KnowledgeBaseRecord = KnowledgeBaseShape & { id?: string };

function emptyRow(): FloorPlanRow {
  return {
    type: "",
    bedrooms: "",
    bathrooms: "",
    squareFeet: "",
    priceMinDollars: "",
    priceMaxDollars: "",
    notes: "",
  };
}

function num(v: string): number | null {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
}

function centsFromDollars(v: string): number | null {
  const n = num(v);
  return n == null ? null : Math.round(n * 100);
}

function rowToFloorPlan(r: FloorPlanRow): FloorPlan {
  return {
    type: r.type.trim(),
    bedrooms: num(r.bedrooms),
    bathrooms: num(r.bathrooms),
    squareFeet: num(r.squareFeet),
    priceMinCents: centsFromDollars(r.priceMinDollars),
    priceMaxCents: centsFromDollars(r.priceMaxDollars),
    notes: r.notes.trim() || null,
  };
}

function planToRow(fp: FloorPlan): FloorPlanRow {
  const dollars = (c: number | null | undefined) =>
    typeof c === "number" && c > 0 ? String(Math.round(c / 100)) : "";
  return {
    type: fp.type ?? "",
    bedrooms: fp.bedrooms != null ? String(fp.bedrooms) : "",
    bathrooms: fp.bathrooms != null ? String(fp.bathrooms) : "",
    squareFeet: fp.squareFeet != null ? String(fp.squareFeet) : "",
    priceMinDollars: dollars(fp.priceMinCents),
    priceMaxDollars: dollars(fp.priceMaxCents),
    notes: fp.notes ?? "",
  };
}

export function KnowledgeBaseForm({
  propertyId,
  propertyName,
  kb,
}: {
  propertyId: string;
  propertyName: string;
  kb: KnowledgeBaseRecord | null;
}) {
  const [pending, startTransition] = useTransition();

  const initialPlans: FloorPlan[] = kb?.floorPlans ?? [];
  const [rows, setRows] = useState<FloorPlanRow[]>(
    initialPlans.length ? initialPlans.map(planToRow) : [emptyRow()],
  );
  const [community, setCommunity] = useState<string[]>(kb?.communityAmenities ?? []);
  const [unit, setUnit] = useState<string[]>(kb?.unitAmenities ?? []);

  const [text, setText] = useState({
    petPolicy: kb?.petPolicy ?? "",
    parkingInfo: kb?.parkingInfo ?? "",
    laundryInfo: kb?.laundryInfo ?? "",
    utilitiesIncluded: kb?.utilitiesIncluded ?? "",
    smokingPolicy: kb?.smokingPolicy ?? "",
    leaseTerms: kb?.leaseTerms ?? "",
    depositInfo: kb?.depositInfo ?? "",
    currentSpecials: kb?.currentSpecials ?? "",
    applicationProcess: kb?.applicationProcess ?? "",
    applicationRequirements: kb?.applicationRequirements ?? "",
    neighborhoodInfo: kb?.neighborhoodInfo ?? "",
    transitInfo: kb?.transitInfo ?? "",
    tourInfo: kb?.tourInfo ?? "",
    additionalNotes: kb?.additionalNotes ?? "",
  });

  // Live completeness — recomputed from current editor state so the operator
  // watches the score climb as they fill fields. Pure function, no DB.
  const completeness = useMemo(() => {
    const shape: KnowledgeBaseShape = {
      floorPlans: rows.map(rowToFloorPlan),
      communityAmenities: community,
      unitAmenities: unit,
      ...text,
    };
    return computeKbCompleteness(shape);
  }, [rows, community, unit, text]);

  function setField(key: keyof typeof text, value: string) {
    setText((prev) => ({ ...prev, [key]: value }));
  }

  function updateRow(i: number, key: keyof FloorPlanRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, idx) => idx !== i)));
  }

  function onSubmit() {
    // Drop fully-empty floor-plan rows (no type) so a stray blank row doesn't
    // trip validation. Server re-validates everything regardless.
    const floorPlans = rows
      .map(rowToFloorPlan)
      .filter((fp) => fp.type.trim().length > 0);

    const input: SaveKnowledgeBaseInput = {
      propertyId,
      floorPlans,
      communityAmenities: community,
      unitAmenities: unit,
      ...text,
    };

    startTransition(async () => {
      const res = await savePropertyKnowledgeBase(input);
      if (res.ok) toast.success("Knowledge base saved");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <CompletenessBanner completeness={completeness} />

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {propertyName} — knowledge base
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Structured facts the chatbot answers from. Floor plans are the most
            important: a type plus square footage stops the bot guessing unit
            sizes. Leave anything you don&apos;t have blank.
          </p>
        </div>

        {/* Floor plans repeater */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">Floor plans</label>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
            >
              <Plus className="h-3 w-3" aria-hidden="true" /> Add plan
            </button>
          </div>

          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Plan {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                  aria-label={`Remove plan ${i + 1}`}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" /> Remove
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="sm:col-span-2">
                  <label className={LABEL}>Type (required)</label>
                  <input
                    value={r.type}
                    onChange={(e) => updateRow(i, "type", e.target.value)}
                    placeholder="Single, Double, Triple, Studio, 1 Bedroom…"
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>Bedrooms</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={r.bedrooms}
                    onChange={(e) => updateRow(i, "bedrooms", e.target.value)}
                    placeholder="e.g. 1"
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>Bathrooms</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={r.bathrooms}
                    onChange={(e) => updateRow(i, "bathrooms", e.target.value)}
                    placeholder="e.g. 1.5"
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>Square feet</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={r.squareFeet}
                    onChange={(e) => updateRow(i, "squareFeet", e.target.value)}
                    placeholder="e.g. 450"
                    className={FIELD}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>Rent min ($/mo)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={r.priceMinDollars}
                      onChange={(e) => updateRow(i, "priceMinDollars", e.target.value)}
                      placeholder="1200"
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Rent max ($/mo)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={r.priceMaxDollars}
                      onChange={(e) => updateRow(i, "priceMaxDollars", e.target.value)}
                      placeholder="1400"
                      className={FIELD}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>Notes</label>
                  <input
                    value={r.notes}
                    onChange={(e) => updateRow(i, "notes", e.target.value)}
                    placeholder="Optional — e.g. corner units, top floor only"
                    className={FIELD}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Amenities */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TagInput
            label="Community amenities"
            values={community}
            onChange={setCommunity}
            placeholder="Add amenity, press Enter"
          />
          <TagInput
            label="In-unit amenities"
            values={unit}
            onChange={setUnit}
            placeholder="Add amenity, press Enter"
          />
        </div>

        {/* Policies + terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextArea label="Pet policy" value={text.petPolicy} onChange={(v) => setField("petPolicy", v)} />
          <TextArea label="Parking" value={text.parkingInfo} onChange={(v) => setField("parkingInfo", v)} />
          <Field label="Laundry" value={text.laundryInfo} onChange={(v) => setField("laundryInfo", v)} />
          <TextArea label="Utilities included" value={text.utilitiesIncluded} onChange={(v) => setField("utilitiesIncluded", v)} />
          <Field label="Smoking policy" value={text.smokingPolicy} onChange={(v) => setField("smokingPolicy", v)} />
          <TextArea label="Lease terms" value={text.leaseTerms} onChange={(v) => setField("leaseTerms", v)} />
          <Field label="Deposit" value={text.depositInfo} onChange={(v) => setField("depositInfo", v)} />
          <TextArea label="Current specials" value={text.currentSpecials} onChange={(v) => setField("currentSpecials", v)} />
          <TextArea label="Application process" value={text.applicationProcess} onChange={(v) => setField("applicationProcess", v)} />
          <TextArea label="Application requirements" value={text.applicationRequirements} onChange={(v) => setField("applicationRequirements", v)} />
          <TextArea label="Neighborhood" value={text.neighborhoodInfo} onChange={(v) => setField("neighborhoodInfo", v)} />
          <Field label="Transit" value={text.transitInfo} onChange={(v) => setField("transitInfo", v)} />
          <Field label="Tours" value={text.tourInfo} onChange={(v) => setField("tourInfo", v)} />
          <TextArea label="Additional notes" value={text.additionalNotes} onChange={(v) => setField("additionalNotes", v)} />
        </div>

        <div className="flex">
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 w-full sm:w-auto sm:ml-auto"
          >
            {pending ? "Saving…" : "Save knowledge base"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletenessBanner({
  completeness,
}: {
  completeness: ReturnType<typeof computeKbCompleteness>;
}) {
  const { score, items, missingCritical } = completeness;
  const complete = missingCritical.length === 0;
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        complete
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {complete ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
          )}
          <span className="text-sm font-semibold text-foreground">
            Knowledge base {score}% complete
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {complete
            ? "All key facts in place"
            : `${missingCritical.length} key fact${missingCritical.length === 1 ? "" : "s"} missing`}
        </span>
      </div>

      {!complete && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          This won&apos;t block your chatbot — it just keeps the bot from
          deflecting questions it could answer. Missing: {missingCritical.join(", ")}.
        </p>
      )}

      <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {items.map((it) => (
          <li key={it.key} className="flex items-center gap-1.5 text-[11px]">
            {it.done ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" aria-hidden="true" />
            ) : (
              <Circle
                className={cn(
                  "h-3 w-3 shrink-0",
                  it.critical ? "text-amber-600" : "text-muted-foreground/50",
                )}
                aria-hidden="true"
              />
            )}
            <span className={it.done ? "text-muted-foreground line-through" : "text-foreground"}>
              {it.label}
              {it.critical ? "" : " (optional)"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={FIELD} />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={FIELD}
      />
    </div>
  );
}

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && draft === "" && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="rounded-md border border-border bg-background px-2 py-1.5">
        {values.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {values.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground"
              >
                {v}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((x) => x !== v))}
                  aria-label={`Remove ${v}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
          placeholder={placeholder}
          className="w-full bg-transparent px-1 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}
