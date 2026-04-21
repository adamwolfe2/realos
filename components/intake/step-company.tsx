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

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStep1(data: Step1Data): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.companyName.trim()) {
    errors.companyName = "Company name is required";
  }
  if (!data.primaryContactName.trim()) {
    errors.primaryContactName = "Full name is required";
  }
  if (!data.primaryContactEmail.trim()) {
    errors.primaryContactEmail = "Email is required";
  } else if (!EMAIL_RE.test(data.primaryContactEmail.trim())) {
    errors.primaryContactEmail = "Enter a valid email address";
  }
  if (data.primaryContactPhone.trim() && data.primaryContactPhone.replace(/\D/g, "").length < 7) {
    errors.primaryContactPhone = "Enter a valid phone number";
  }
  if (!data.primaryContactPhone.trim()) {
    errors.primaryContactPhone = "Phone is required";
  }
  if (!data.propertyType) {
    errors.propertyType = "Select a property type";
  }

  return errors;
}

export function StepCompany({
  data,
  onChange,
  attempted,
}: {
  data: Step1Data;
  onChange: (patch: Partial<Step1Data>) => void;
  attempted: boolean;
}) {
  const errors = attempted ? validateStep1(data) : {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <IntakeField
          label="Company name"
          value={data.companyName}
          onChange={(v) => onChange({ companyName: v })}
          required
          error={errors.companyName}
        />
        <IntakeField
          label="Short name / URL slug"
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
        {errors.propertyType ? (
          <p className="text-[11px] text-destructive mt-1.5">{errors.propertyType}</p>
        ) : null}
      </div>

      {(data.propertyType === "RESIDENTIAL" ||
        data.propertyType === "MIXED") && (
        <div>
          <p className="text-xs tracking-widest uppercase opacity-70 mb-2">
            Residential focus
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <IntakeField
            label="Full name"
            value={data.primaryContactName}
            onChange={(v) => onChange({ primaryContactName: v })}
            required
            error={errors.primaryContactName}
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
            error={errors.primaryContactEmail}
          />
          <IntakeField
            label="Phone"
            type="tel"
            value={data.primaryContactPhone}
            onChange={(v) => onChange({ primaryContactPhone: v })}
            inputMode="tel"
            required
            error={errors.primaryContactPhone}
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
