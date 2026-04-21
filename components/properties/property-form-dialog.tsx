"use client";

import { useState, useTransition } from "react";
import {
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
} from "@prisma/client";
import { createProperty, updateProperty } from "@/lib/actions/properties";

type EditableProperty = {
  id?: string;
  name: string;
  slug: string;
  propertyType: PropertyType;
  residentialSubtype: ResidentialSubtype | null;
  commercialSubtype: CommercialSubtype | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  description: string | null;
  heroImageUrl: string | null;
  virtualTourUrl: string | null;
  yearBuilt: number | null;
  totalUnits: number | null;
};

export function PropertyFormDialog({
  orgId,
  initial,
  trigger,
  onSaved,
}: {
  orgId?: string;
  initial?: EditableProperty;
  trigger?: React.ReactNode;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EditableProperty>(
    initial ?? {
      name: "",
      slug: "",
      propertyType: PropertyType.RESIDENTIAL,
      residentialSubtype: null,
      commercialSubtype: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      description: null,
      heroImageUrl: null,
      virtualTourUrl: null,
      yearBuilt: null,
      totalUnits: null,
    },
  );

  function set<K extends keyof EditableProperty>(key: K, value: EditableProperty[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const payload = {
        ...data,
        orgId,
        residentialSubtype:
          data.propertyType === PropertyType.RESIDENTIAL
            ? data.residentialSubtype
            : null,
        commercialSubtype:
          data.propertyType === PropertyType.COMMERCIAL
            ? data.commercialSubtype
            : null,
      };
      const res = data.id
        ? await updateProperty({ propertyId: data.id, ...payload })
        : await createProperty(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      onSaved?.();
      // Reset to initial when creating new (so the next open is fresh).
      if (!initial) {
        setData({
          name: "",
          slug: "",
          propertyType: PropertyType.RESIDENTIAL,
          residentialSubtype: null,
          commercialSubtype: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          state: null,
          postalCode: null,
          description: null,
          heroImageUrl: null,
          virtualTourUrl: null,
          yearBuilt: null,
          totalUnits: null,
        });
      }
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <button
            type="button"
            className="text-xs px-3 py-1.5 bg-foreground text-background rounded-md"
          >
            {initial ? "Edit property" : "Add property"}
          </button>
        )}
      </span>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="bg-card border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {initial ? `Edit ${initial.name}` : "Add property"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label="Name"
                  value={data.name}
                  onChange={(v) => {
                    set("name", v);
                    if (!initial && (!data.slug || data.slug === autoSlug(data.name))) {
                      set("slug", autoSlug(v));
                    }
                  }}
                  required
                />
                <Field
                  label="Slug"
                  value={data.slug}
                  onChange={(v) => set("slug", v)}
                  help="URL slug within the tenant site (lowercase, dashes)."
                  required
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <SelectField
                  label="Type"
                  value={data.propertyType}
                  onChange={(v) => set("propertyType", v as PropertyType)}
                  options={[
                    [PropertyType.RESIDENTIAL, "Residential"],
                    [PropertyType.COMMERCIAL, "Commercial"],
                    [PropertyType.MIXED, "Mixed-use"],
                  ]}
                />
                {data.propertyType === PropertyType.RESIDENTIAL ? (
                  <SelectField
                    label="Residential subtype"
                    value={data.residentialSubtype ?? ""}
                    onChange={(v) =>
                      set("residentialSubtype", (v || null) as ResidentialSubtype | null)
                    }
                    options={[
                      ["", "—"],
                      [ResidentialSubtype.STUDENT_HOUSING, "Student housing"],
                      [ResidentialSubtype.MULTIFAMILY, "Multifamily"],
                      [ResidentialSubtype.SENIOR_LIVING, "Senior living"],
                      [ResidentialSubtype.SINGLE_FAMILY_RENTAL, "Single-family rental"],
                      [ResidentialSubtype.CO_LIVING, "Co-living"],
                      [ResidentialSubtype.SHORT_TERM_RENTAL, "Short-term rental"],
                    ]}
                  />
                ) : data.propertyType === PropertyType.COMMERCIAL ? (
                  <SelectField
                    label="Commercial subtype"
                    value={data.commercialSubtype ?? ""}
                    onChange={(v) =>
                      set("commercialSubtype", (v || null) as CommercialSubtype | null)
                    }
                    options={[
                      ["", "—"],
                      [CommercialSubtype.OFFICE, "Office"],
                      [CommercialSubtype.RETAIL, "Retail"],
                      [CommercialSubtype.INDUSTRIAL, "Industrial"],
                      [CommercialSubtype.MIXED_USE, "Mixed-use"],
                      [CommercialSubtype.FLEX_SPACE, "Flex space"],
                      [CommercialSubtype.MEDICAL_OFFICE, "Medical office"],
                    ]}
                  />
                ) : (
                  <div />
                )}
                <NumberField
                  label="Total units"
                  value={data.totalUnits}
                  onChange={(v) => set("totalUnits", v)}
                  min={1}
                  max={10000}
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Address
                </legend>
                <Field
                  label="Street"
                  value={data.addressLine1 ?? ""}
                  onChange={(v) => set("addressLine1", v || null)}
                />
                <Field
                  label="Unit / Suite"
                  value={data.addressLine2 ?? ""}
                  onChange={(v) => set("addressLine2", v || null)}
                />
                <div className="grid grid-cols-3 gap-3">
                  <Field
                    label="City"
                    value={data.city ?? ""}
                    onChange={(v) => set("city", v || null)}
                  />
                  <Field
                    label="State"
                    value={data.state ?? ""}
                    onChange={(v) => set("state", v || null)}
                  />
                  <Field
                    label="ZIP"
                    value={data.postalCode ?? ""}
                    onChange={(v) => set("postalCode", v || null)}
                  />
                </div>
              </fieldset>

              <Field
                label="Hero image URL"
                value={data.heroImageUrl ?? ""}
                onChange={(v) => set("heroImageUrl", v || null)}
                type="url"
              />
              <Field
                label="Virtual tour URL"
                value={data.virtualTourUrl ?? ""}
                onChange={(v) => set("virtualTourUrl", v || null)}
                type="url"
              />
              <NumberField
                label="Year built"
                value={data.yearBuilt}
                onChange={(v) => set("yearBuilt", v)}
                min={1700}
                max={2100}
              />
              <TextArea
                label="Description"
                value={data.description ?? ""}
                onChange={(v) => set("description", v || null)}
                rows={4}
              />

              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
            </div>

            <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !data.name.trim() || !data.slug.trim()}
                className="text-xs px-3 py-1.5 bg-foreground text-background rounded-md disabled:opacity-40"
              >
                {pending
                  ? "Saving..."
                  : initial
                    ? "Save changes"
                    : "Create property"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  help,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  help?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm"
      />
      {help ? (
        <span className="text-[11px] text-muted-foreground">{help}</span>
      ) : null}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : parseInt(v, 10) || null);
        }}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm"
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm"
      />
    </label>
  );
}
