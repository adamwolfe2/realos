"use client";

import * as React from "react";
import type { PropertyType } from "@prisma/client";
import { ArrowRight, ArrowLeft } from "lucide-react";

// Step 2 of the onboarding wizard. Collects the user's first property:
// name, address, units, year. Only `name` is strictly required so the
// user can complete the wizard quickly and fill in address/units later
// from the portal. We surface the optional fields right here anyway
// because they drive several downstream features (SEO, map pins,
// chatbot grounding).

type Initial = {
  id: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  totalUnits: number | null;
  yearBuilt: number | null;
  propertyType: PropertyType;
} | null;

type SubmitBody = {
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  totalUnits?: number | null;
  yearBuilt?: number | null;
};

export function PropertyStep({
  initial,
  orgPropertyType,
  onSubmit,
  disabled,
}: {
  initial: Initial;
  orgPropertyType: PropertyType;
  onSubmit: (body: SubmitBody) => void;
  disabled: boolean;
}) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [addressLine1, setAddressLine1] = React.useState(
    initial?.addressLine1 ?? "",
  );
  const [city, setCity] = React.useState(initial?.city ?? "");
  const [state, setState] = React.useState(initial?.state ?? "");
  const [postalCode, setPostalCode] = React.useState(initial?.postalCode ?? "");
  const [totalUnits, setTotalUnits] = React.useState<string>(
    initial?.totalUnits ? String(initial.totalUnits) : "",
  );
  const [yearBuilt, setYearBuilt] = React.useState<string>(
    initial?.yearBuilt ? String(initial.yearBuilt) : "",
  );

  void orgPropertyType; // kept for future per-type field rendering

  const canSubmit = name.trim().length > 1 && !disabled;

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      addressLine1: addressLine1.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      postalCode: postalCode.trim() || null,
      totalUnits: totalUnits ? parseInt(totalUnits, 10) : null,
      yearBuilt: yearBuilt ? parseInt(yearBuilt, 10) : null,
    });
  };

  return (
    <form onSubmit={handle} className="space-y-7">
      <header>
        <p
          className="eyebrow"
          style={{ color: "#2563EB", letterSpacing: "0.16em" }}
        >
          Step 2 of 3
        </p>
        <h1
          className="mt-2"
          style={{
            color: "#141413",
            fontFamily: "var(--font-sans)",
            fontSize: "26px",
            fontWeight: 700,
            letterSpacing: "-0.014em",
          }}
        >
          Add your first property.
        </h1>
        <p
          className="mt-2"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "14.5px",
            lineHeight: 1.55,
          }}
        >
          This is the property you&apos;ll configure first. You can add more
          from the portal after signup, and each one rolls into the same
          monthly bill at your tier&apos;s additional-property rate.
        </p>
      </header>

      <div className="space-y-4">
        <Field
          label="Property name"
          required
          input={
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Telegraph Commons"
              maxLength={120}
              required
              className="w-full"
              style={inputStyle}
              autoFocus
            />
          }
        />

        <Field
          label="Street address"
          input={
            <input
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="2563 Telegraph Ave"
              maxLength={200}
              className="w-full"
              style={inputStyle}
            />
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field
            label="City"
            input={
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Berkeley"
                maxLength={80}
                className="w-full"
                style={inputStyle}
              />
            }
          />
          <Field
            label="State"
            input={
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="CA"
                maxLength={40}
                className="w-full"
                style={inputStyle}
              />
            }
          />
          <Field
            label="ZIP / Postal"
            input={
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="94704"
                maxLength={20}
                className="w-full"
                style={inputStyle}
              />
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Total units"
            input={
              <input
                type="number"
                min={1}
                max={10000}
                value={totalUnits}
                onChange={(e) => setTotalUnits(e.target.value)}
                placeholder="100"
                className="w-full"
                style={inputStyle}
              />
            }
          />
          <Field
            label="Year built"
            input={
              <input
                type="number"
                min={1700}
                max={2100}
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                placeholder="2018"
                className="w-full"
                style={inputStyle}
              />
            }
          />
        </div>
      </div>

      <p
        style={{
          color: "#88867f",
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          lineHeight: 1.5,
        }}
      >
        Only the name is required. You can fill the rest in later from
        property settings.
      </p>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => history.back()}
          className="inline-flex items-center gap-1.5 transition-colors"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={14} strokeWidth={2.5} aria-hidden="true" />
          Back
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "#2563EB",
            color: "#ffffff",
            padding: "10px 18px",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Continue
          <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "#faf9f5",
  border: "1px solid #e8e6dc",
  padding: "10px 12px",
  fontFamily: "var(--font-sans)",
  fontSize: "14px",
  color: "#141413",
  outline: "none",
  borderRadius: "8px",
};

function Field({
  label,
  input,
  required,
}: {
  label: string;
  input: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label
        className="block"
        style={{
          color: "#141413",
          fontFamily: "var(--font-sans)",
          fontSize: "12.5px",
          fontWeight: 600,
        }}
      >
        {label}
        {required ? (
          <span style={{ color: "#2563EB", marginLeft: "3px" }}>*</span>
        ) : null}
      </label>
      {input}
    </div>
  );
}
