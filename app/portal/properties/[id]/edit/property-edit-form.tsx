"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  PropertyType,
  CommercialSubtype,
  ResidentialSubtype,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PlacesAutocomplete,
  type ResolvedPlace,
} from "@/components/places-autocomplete";
import { updateProperty } from "@/lib/actions/properties";

export type PropertyEditInitial = {
  propertyId: string;
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
  googlePlaceId: string | null;
  latitude: number | null;
  longitude: number | null;
  yearBuilt: number | null;
  totalUnits: number | null;
  description: string | null;
  heroImageUrl: string | null;
  virtualTourUrl: string | null;
};

type FormState = {
  name: string;
  slug: string;
  propertyType: PropertyType;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  googlePlaceId: string;
  latitude: string;
  longitude: string;
  yearBuilt: string;
  totalUnits: string;
  description: string;
  heroImageUrl: string;
  virtualTourUrl: string;
};

function seed(initial: PropertyEditInitial): FormState {
  return {
    name: initial.name,
    slug: initial.slug,
    propertyType: initial.propertyType,
    addressLine1: initial.addressLine1 ?? "",
    addressLine2: initial.addressLine2 ?? "",
    city: initial.city ?? "",
    state: initial.state ?? "",
    postalCode: initial.postalCode ?? "",
    googlePlaceId: initial.googlePlaceId ?? "",
    latitude: initial.latitude == null ? "" : String(initial.latitude),
    longitude: initial.longitude == null ? "" : String(initial.longitude),
    yearBuilt: initial.yearBuilt == null ? "" : String(initial.yearBuilt),
    totalUnits: initial.totalUnits == null ? "" : String(initial.totalUnits),
    description: initial.description ?? "",
    heroImageUrl: initial.heroImageUrl ?? "",
    virtualTourUrl: initial.virtualTourUrl ?? "",
  };
}

export function PropertyEditForm({ initial }: { initial: PropertyEditInitial }) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(() => seed(initial));
  const [pending, setPending] = React.useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSelectPlace(place: ResolvedPlace) {
    setForm((f) => ({
      ...f,
      addressLine1: place.addressLine1 ?? f.addressLine1,
      city: place.city ?? "",
      state: place.state ?? "",
      postalCode: place.postalCode ?? "",
      googlePlaceId: place.placeId,
      latitude: place.latitude == null ? "" : String(place.latitude),
      longitude: place.longitude == null ? "" : String(place.longitude),
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const yearBuilt = form.yearBuilt ? Number(form.yearBuilt) : null;
      const totalUnits = form.totalUnits ? Number(form.totalUnits) : null;
      const latitude = form.latitude ? Number(form.latitude) : null;
      const longitude = form.longitude ? Number(form.longitude) : null;
      const result = await updateProperty({
        propertyId: initial.propertyId,
        name: form.name,
        slug: form.slug,
        propertyType: form.propertyType,
        residentialSubtype: initial.residentialSubtype,
        commercialSubtype: initial.commercialSubtype,
        addressLine1: form.addressLine1 || null,
        addressLine2: form.addressLine2 || null,
        city: form.city || null,
        state: form.state || null,
        postalCode: form.postalCode || null,
        googlePlaceId: form.googlePlaceId || null,
        latitude,
        longitude,
        yearBuilt,
        totalUnits,
        description: form.description || null,
        heroImageUrl: form.heroImageUrl || null,
        virtualTourUrl: form.virtualTourUrl || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved.");
      router.push(`/portal/properties/${initial.propertyId}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Basics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="name" label="Property name" required>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
            />
          </Field>
          <Field id="slug" label="Slug" hint="Lowercase letters, numbers, dashes.">
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
              required
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Address</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Start typing to use Google Places autocomplete. Selecting a result
            fills the rest of the fields and stores the place id for the
            reputation scanner.
          </p>
        </div>
        <Field id="addressLine1" label="Address">
          <PlacesAutocomplete
            id="addressLine1"
            value={form.addressLine1}
            onChange={(v) => update("addressLine1", v)}
            onSelect={handleSelectPlace}
            placeholder="Start typing a street address…"
          />
        </Field>
        <Field id="addressLine2" label="Address line 2" hint="Unit, suite, etc. (optional)">
          <Input
            id="addressLine2"
            value={form.addressLine2}
            onChange={(e) => update("addressLine2", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field id="city" label="City">
            <Input
              id="city"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
            />
          </Field>
          <Field id="state" label="State / region">
            <Input
              id="state"
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
            />
          </Field>
          <Field id="postalCode" label="ZIP / postal">
            <Input
              id="postalCode"
              value={form.postalCode}
              onChange={(e) => update("postalCode", e.target.value)}
            />
          </Field>
        </div>
        {form.googlePlaceId ? (
          <p className="text-[11px] text-muted-foreground">
            Google place id:{" "}
            <code className="font-mono text-[11px] text-foreground/80 break-all">
              {form.googlePlaceId}
            </code>
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Inventory</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="totalUnits" label="Total units">
            <Input
              id="totalUnits"
              type="number"
              min="0"
              value={form.totalUnits}
              onChange={(e) => update("totalUnits", e.target.value)}
            />
          </Field>
          <Field id="yearBuilt" label="Year built">
            <Input
              id="yearBuilt"
              type="number"
              min="1700"
              max="2100"
              value={form.yearBuilt}
              onChange={(e) => update("yearBuilt", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/portal/properties/${initial.propertyId}`)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      {children}
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
