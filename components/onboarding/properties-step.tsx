"use client";

import * as React from "react";
import { Plus, Trash2, Building2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Onboarding — multi-property step (slice S2). The operator adds one or more
// properties (each gets its own website / pixel / chatbot downstream), then
// picks how they manage them (a PMS/CRM or nothing). Submitting creates the
// properties, records the CRM choice, and starts the 14-day trial.
// ---------------------------------------------------------------------------

const INK = "#1E2A3A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const ACCENT = "#2563EB";

const FIELD =
  "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2563EB]/30";
const fieldStyle: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  color: INK,
  fontFamily: "var(--font-sans)",
};

const CRM_OPTIONS = [
  { value: "none", label: "No CRM — set up manually" },
  { value: "appfolio", label: "AppFolio" },
  { value: "yardi", label: "Yardi" },
  { value: "buildium", label: "Buildium" },
  { value: "entrata", label: "Entrata" },
  { value: "realpage", label: "RealPage" },
  { value: "salesforce", label: "Salesforce" },
  { value: "hubspot", label: "HubSpot" },
  { value: "other", label: "Something else" },
];

type Row = { name: string; city: string; state: string };

export type PropertiesStepInitial = Array<{
  name: string;
  city: string | null;
  state: string | null;
}>;

export function PropertiesStep({
  initial,
  onSubmit,
  disabled,
}: {
  initial: PropertiesStepInitial;
  onSubmit: (body: {
    properties: Array<{
      name: string;
      city?: string | null;
      state?: string | null;
    }>;
    crm: string;
  }) => void;
  disabled?: boolean;
}) {
  const [rows, setRows] = React.useState<Row[]>(() =>
    initial.length
      ? initial.map((p) => ({
          name: p.name,
          city: p.city ?? "",
          state: p.state ?? "",
        }))
      : [{ name: "", city: "", state: "" }],
  );
  const [crm, setCrm] = React.useState("none");
  const [error, setError] = React.useState<string | null>(null);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () =>
    setRows((prev) => [...prev, { name: "", city: "", state: "" }]);
  const remove = (i: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const submit = () => {
    if (disabled) return;
    const cleaned = rows
      .map((r) => ({ name: r.name.trim(), city: r.city.trim(), state: r.state.trim() }))
      .filter((r) => r.name.length > 0);
    if (cleaned.length === 0) {
      setError("Add at least one property with a name.");
      return;
    }
    setError(null);
    onSubmit({
      properties: cleaned.map((r) => ({
        name: r.name,
        city: r.city || null,
        state: r.state || null,
      })),
      crm,
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <p
          style={{
            color: MUTED,
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Add your properties
        </p>
        <h1
          className="mt-2 leading-tight"
          style={{
            color: INK,
            fontFamily: "var(--font-serif)",
            fontSize: "26px",
            fontWeight: 500,
            letterSpacing: "-0.018em",
          }}
        >
          Which properties are these for?
        </h1>
        <p
          className="mt-2"
          style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: "14px", lineHeight: 1.55 }}
        >
          Add each property you want to market. Every one gets its own site,
          pixel, and chatbot — you&apos;ll set those up per property inside the
          workspace.
        </p>
      </header>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className="rounded-xl"
            style={{ border: `1px solid ${BORDER}`, padding: "12px 14px" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-2" style={{ color: MUTED, fontFamily: "var(--font-mono)", fontSize: "10.5px", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                <Building2 className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden />
                Property {i + 1}
              </span>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  className="p-1 rounded-md hover:bg-[#F1F5F9] disabled:opacity-40"
                  aria-label={`Remove property ${i + 1}`}
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} style={{ color: MUTED }} />
                </button>
              ) : null}
            </div>
            <input
              className={FIELD}
              style={fieldStyle}
              placeholder="Property name (e.g. The Lofts at Main)"
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
              disabled={disabled}
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input
                className={FIELD}
                style={fieldStyle}
                placeholder="City (optional)"
                value={row.city}
                onChange={(e) => update(i, { city: e.target.value })}
                disabled={disabled}
              />
              <input
                className={FIELD}
                style={fieldStyle}
                placeholder="State (optional)"
                value={row.state}
                onChange={(e) => update(i, { state: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg transition-colors hover:bg-[#F8FAFC] disabled:opacity-50"
          style={{ padding: "10px 14px", border: `1px dashed ${BORDER}`, color: ACCENT, fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600 }}
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Add another property
        </button>
      </div>

      {/* CRM / PMS — last, with a no-CRM default */}
      <div>
        <label
          className="block mb-1"
          style={{ color: INK, fontFamily: "var(--font-mono)", fontSize: "10.5px", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}
        >
          How do you manage these?
        </label>
        <select
          className={FIELD}
          style={fieldStyle}
          value={crm}
          onChange={(e) => setCrm(e.target.value)}
          disabled={disabled}
        >
          {CRM_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1" style={{ color: MUTED, fontFamily: "var(--font-sans)", fontSize: "11.5px" }}>
          You can connect or skip this anytime — properties work fully manual
          without a CRM.
        </p>
      </div>

      {error ? (
        <p style={{ color: "#DC2626", fontFamily: "var(--font-sans)", fontSize: "12.5px" }}>{error}</p>
      ) : null}

      <div className="flex">
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="rounded-lg transition-colors w-full sm:w-auto sm:ml-auto"
          style={{ padding: "12px 20px", backgroundColor: ACCENT, color: "#FFFFFF", fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 600, opacity: disabled ? 0.6 : 1 }}
        >
          Start 14-day free trial
        </button>
      </div>
    </div>
  );
}
