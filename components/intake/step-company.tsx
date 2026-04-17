"use client";

import { IntakeField } from "./field";
import { OptionButton } from "./option-button";
import {
  PROPERTY_TYPES,
  RESIDENTIAL_SUBTYPES,
  COMMERCIAL_SUBTYPES,
} from "./constants";
import type {
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
  Step1Data,
} from "./types";

export function StepCompany({
  data,
  onChange,
  attempted,
}: {
  data: Step1Data;
  onChange: (patch: Partial<Step1Data>) => void;
  attempted: boolean;
}) {
  const missing = (field: keyof Step1Data) =>
    attempted && !String(data[field] ?? "").trim();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <IntakeField
          label="Company name"
          value={data.companyName}
          onChange={(v) => onChange({ companyName: v })}
          required
          className={
            "flex flex-col gap-1.5 " + (missing("companyName") ? "is-invalid" : "")
          }
        />
        <IntakeField
          label="Short name, used as URL slug"
          value={data.shortName}
          onChange={(v) => onChange({ shortName: v })}
          placeholder="e.g. sg-realestate"
        />
      </div>

      <IntakeField
        label="Current website URL"
        value={data.websiteUrl}
        onChange={(v) => onChange({ websiteUrl: v })}
        placeholder="https://yourcompany.com"
        type="url"
      />

      <div>
        <p className="text-xs tracking-widest uppercase opacity-70 mb-2">
          Property type
          <span aria-hidden="true" className="ml-0.5">*</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          {PROPERTY_TYPES.map((p) => (
            <OptionButton
              key={p.key}
              selected={data.propertyType === p.key}
              onClick={() =>
                onChange({
                  propertyType: p.key as PropertyType,
                  residentialSubtype: undefined,
                  commercialSubtype: undefined,
                })
              }
            >
              {p.label}
            </OptionButton>
          ))}
        </div>
      </div>

      {(data.propertyType === "RESIDENTIAL" ||
        data.propertyType === "MIXED") && (
        <div>
          <p className="text-xs tracking-widest uppercase opacity-70 mb-2">
            Residential focus
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {RESIDENTIAL_SUBTYPES.map((sub) => (
              <OptionButton
                key={sub.key}
                size="sm"
                selected={data.residentialSubtype === sub.key}
                onClick={() =>
                  onChange({
                    residentialSubtype: sub.key as ResidentialSubtype,
                  })
                }
              >
                {sub.label}
              </OptionButton>
            ))}
          </div>
        </div>
      )}

      {(data.propertyType === "COMMERCIAL" ||
        data.propertyType === "MIXED") && (
        <div>
          <p className="text-xs tracking-widest uppercase opacity-70 mb-2">
            Commercial focus
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {COMMERCIAL_SUBTYPES.map((sub) => (
              <OptionButton
                key={sub.key}
                size="sm"
                selected={data.commercialSubtype === sub.key}
                onClick={() =>
                  onChange({
                    commercialSubtype: sub.key as CommercialSubtype,
                  })
                }
              >
                {sub.label}
              </OptionButton>
            ))}
          </div>
        </div>
      )}

      <div className="pt-6 border-t">
        <h3 className="text-sm font-medium mb-4">Primary contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <IntakeField
            label="Full name"
            value={data.primaryContactName}
            onChange={(v) => onChange({ primaryContactName: v })}
            required
            className={
              "flex flex-col gap-1.5 " +
              (missing("primaryContactName") ? "is-invalid" : "")
            }
          />
          <IntakeField
            label="Role"
            value={data.primaryContactRole}
            onChange={(v) => onChange({ primaryContactRole: v })}
            placeholder="VP of Operations"
          />
          <IntakeField
            label="Email"
            type="email"
            value={data.primaryContactEmail}
            onChange={(v) => onChange({ primaryContactEmail: v })}
            required
            className={
              "flex flex-col gap-1.5 " +
              (missing("primaryContactEmail") ? "is-invalid" : "")
            }
          />
          <IntakeField
            label="Phone"
            type="tel"
            value={data.primaryContactPhone}
            onChange={(v) => onChange({ primaryContactPhone: v })}
            inputMode="tel"
          />
          <IntakeField
            label="HQ city"
            value={data.hqCity}
            onChange={(v) => onChange({ hqCity: v })}
          />
          <IntakeField
            label="HQ state"
            value={data.hqState}
            onChange={(v) => onChange({ hqState: v })}
            placeholder="CA"
          />
        </div>
      </div>
    </div>
  );
}
