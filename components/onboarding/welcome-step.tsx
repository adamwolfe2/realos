"use client";

import * as React from "react";
import {
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
} from "@prisma/client";
import { ArrowRight } from "lucide-react";

// Step 1 of the onboarding wizard. Collects the workspace's display
// name + property type focus. Subtype is shown conditionally based on
// the chosen type.

type Initial = {
  name: string;
  propertyType: PropertyType;
  residentialSubtype: ResidentialSubtype | null;
  commercialSubtype: CommercialSubtype | null;
};

const RESIDENTIAL_SUBTYPES: Array<{ value: ResidentialSubtype; label: string }> =
  [
    { value: "STUDENT_HOUSING", label: "Student housing" },
    { value: "MULTIFAMILY", label: "Multifamily" },
    { value: "SENIOR_LIVING", label: "Senior living" },
    { value: "SINGLE_FAMILY_RENTAL", label: "Single-family rental" },
    { value: "CO_LIVING", label: "Co-living" },
    { value: "SHORT_TERM_RENTAL", label: "Short-term rental" },
  ];

const COMMERCIAL_SUBTYPES: Array<{ value: CommercialSubtype; label: string }> =
  [
    { value: "OFFICE", label: "Office" },
    { value: "RETAIL", label: "Retail" },
    { value: "INDUSTRIAL", label: "Industrial" },
    { value: "MIXED_USE", label: "Mixed use" },
  ];

const TYPE_OPTIONS: Array<{
  value: PropertyType;
  label: string;
  blurb: string;
}> = [
  {
    value: "RESIDENTIAL",
    label: "Residential",
    blurb: "Apartments, student housing, single-family, senior living.",
  },
  {
    value: "COMMERCIAL",
    label: "Commercial",
    blurb: "Office, retail, industrial.",
  },
  {
    value: "MIXED",
    label: "Mixed",
    blurb: "Portfolios with both residential and commercial.",
  },
];

export function WelcomeStep({
  initial,
  onSubmit,
  disabled,
}: {
  initial: Initial;
  onSubmit: (body: {
    name: string;
    propertyType: PropertyType;
    residentialSubtype: ResidentialSubtype | null;
    commercialSubtype: CommercialSubtype | null;
  }) => void;
  disabled: boolean;
}) {
  const [name, setName] = React.useState(initial.name || "");
  const [propertyType, setPropertyType] = React.useState<PropertyType>(
    initial.propertyType ?? "RESIDENTIAL",
  );
  const [residentialSubtype, setResidentialSubtype] =
    React.useState<ResidentialSubtype | null>(
      initial.residentialSubtype ?? null,
    );
  const [commercialSubtype, setCommercialSubtype] =
    React.useState<CommercialSubtype | null>(
      initial.commercialSubtype ?? null,
    );

  const showResidential =
    propertyType === "RESIDENTIAL" || propertyType === "MIXED";
  const showCommercial =
    propertyType === "COMMERCIAL" || propertyType === "MIXED";

  const canSubmit = name.trim().length > 1 && !disabled;

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      propertyType,
      residentialSubtype: showResidential ? residentialSubtype : null,
      commercialSubtype: showCommercial ? commercialSubtype : null,
    });
  };

  return (
    <form onSubmit={handle} className="space-y-7">
      <header>
        <p
          className="eyebrow"
          style={{ color: "#2563EB", letterSpacing: "0.16em" }}
        >
          Step 1 of 3
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
          Welcome. Let&apos;s set up your workspace.
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
          Your workspace is where every property lives. Name it something
          you&apos;ll recognize. You can change it later from settings.
        </p>
      </header>

      <div className="space-y-2">
        <label
          htmlFor="workspace-name"
          className="block"
          style={{
            color: "#141413",
            fontFamily: "var(--font-sans)",
            fontSize: "13.5px",
            fontWeight: 600,
          }}
        >
          Workspace name
        </label>
        <input
          id="workspace-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="SG Real Estate"
          maxLength={120}
          className="w-full rounded-lg"
          style={{
            backgroundColor: "#faf9f5",
            border: "1px solid #e8e6dc",
            padding: "12px 14px",
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            color: "#141413",
            outline: "none",
          }}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <p
          style={{
            color: "#141413",
            fontFamily: "var(--font-sans)",
            fontSize: "13.5px",
            fontWeight: 600,
          }}
        >
          What kind of properties do you manage?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const active = propertyType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPropertyType(opt.value)}
                className="rounded-lg text-left transition-colors"
                style={{
                  border: active ? "1px solid #2563EB" : "1px solid #e8e6dc",
                  backgroundColor: active
                    ? "rgba(37,99,235,0.06)"
                    : "#faf9f5",
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    color: active ? "#2563EB" : "#141413",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  {opt.label}
                </div>
                <div
                  className="mt-1"
                  style={{
                    color: "#5e5d59",
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    lineHeight: 1.45,
                  }}
                >
                  {opt.blurb}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showResidential ? (
        <div className="space-y-2">
          <p
            style={{
              color: "#141413",
              fontFamily: "var(--font-sans)",
              fontSize: "13.5px",
              fontWeight: 600,
            }}
          >
            Residential subtype
          </p>
          <div className="flex flex-wrap gap-1.5">
            {RESIDENTIAL_SUBTYPES.map((s) => {
              const active = residentialSubtype === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setResidentialSubtype(s.value)}
                  className="rounded-full transition-colors"
                  style={{
                    border: active
                      ? "1px solid #2563EB"
                      : "1px solid #e8e6dc",
                    backgroundColor: active
                      ? "rgba(37,99,235,0.08)"
                      : "#ffffff",
                    color: active ? "#2563EB" : "#5e5d59",
                    padding: "6px 12px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "12.5px",
                    fontWeight: 500,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showCommercial ? (
        <div className="space-y-2">
          <p
            style={{
              color: "#141413",
              fontFamily: "var(--font-sans)",
              fontSize: "13.5px",
              fontWeight: 600,
            }}
          >
            Commercial subtype
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COMMERCIAL_SUBTYPES.map((s) => {
              const active = commercialSubtype === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setCommercialSubtype(s.value)}
                  className="rounded-full transition-colors"
                  style={{
                    border: active
                      ? "1px solid #2563EB"
                      : "1px solid #e8e6dc",
                    backgroundColor: active
                      ? "rgba(37,99,235,0.08)"
                      : "#ffffff",
                    color: active ? "#2563EB" : "#5e5d59",
                    padding: "6px 12px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "12.5px",
                    fontWeight: 500,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-end pt-2">
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
