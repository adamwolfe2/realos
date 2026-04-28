"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SettingsInitial = {
  name: string;
  shortName: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  primaryContactRole: string | null;
  hqAddressLine1: string | null;
  hqCity: string | null;
  hqState: string | null;
  hqPostalCode: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  brandFont: string | null;
};

type Editable = {
  [K in keyof SettingsInitial]: string;
};

function seed(initial: SettingsInitial): Editable {
  return Object.fromEntries(
    Object.entries(initial).map(([k, v]) => [k, v ?? ""])
  ) as Editable;
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<Editable>(() => seed(initial));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(key: keyof Editable, value: string) {
    setState((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload: Record<string, string | null> = {};
      (Object.keys(state) as Array<keyof Editable>).forEach((k) => {
        const v = state[k].trim();
        payload[k] = v === "" ? null : v;
      });
      const res = await fetch("/api/tenant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to save settings");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const primaryHex = HEX.test(state.primaryColor) ? state.primaryColor : null;
  const secondaryHex = HEX.test(state.secondaryColor) ? state.secondaryColor : null;
  const logoOk = /^https?:\/\//i.test(state.logoUrl);

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section
        icon={<Building2 className="size-4" aria-hidden="true" />}
        title="Company info"
        description="How leasing teams, agency operators, and account managers identify your portfolio."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Company name"
            required
            value={state.name}
            onChange={(v) => update("name", v)}
            maxLength={200}
          />
          <Field
            label="Short name"
            value={state.shortName}
            onChange={(v) => update("shortName", v)}
            maxLength={60}
            hint="Used in tight UI like the sidebar."
          />
          <Field
            label="Primary contact"
            value={state.primaryContactName}
            onChange={(v) => update("primaryContactName", v)}
            placeholder="Jane Doe"
          />
          <Field
            label="Contact email"
            type="email"
            value={state.primaryContactEmail}
            onChange={(v) => update("primaryContactEmail", v)}
            placeholder="jane@portfolio.com"
          />
          <Field
            label="Contact phone"
            value={state.primaryContactPhone}
            onChange={(v) => update("primaryContactPhone", v)}
            placeholder="510-555-0100"
          />
          <Field
            label="Contact role"
            value={state.primaryContactRole}
            onChange={(v) => update("primaryContactRole", v)}
            placeholder="VP of Operations"
          />
        </div>
      </Section>

      <Section
        icon={<MapPin className="size-4" aria-hidden="true" />}
        title="HQ address"
        description="Used on owner reports, invoices, and any operator-facing documents."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Address line 1"
            value={state.hqAddressLine1}
            onChange={(v) => update("hqAddressLine1", v)}
            className="md:col-span-2"
          />
          <Field
            label="City"
            value={state.hqCity}
            onChange={(v) => update("hqCity", v)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="State"
              value={state.hqState}
              onChange={(v) => update("hqState", v)}
              maxLength={4}
            />
            <Field
              label="Postal code"
              value={state.hqPostalCode}
              onChange={(v) => update("hqPostalCode", v)}
              maxLength={12}
            />
          </div>
        </div>
      </Section>

      <Section
        icon={<Palette className="size-4" aria-hidden="true" />}
        title="Brand"
        description="Drives logo, colors, and typography on your tenant site, emails, and reports."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
            <Field
              label="Logo URL"
              type="url"
              value={state.logoUrl}
              onChange={(v) => update("logoUrl", v)}
              placeholder="https://cdn.example.com/logo.svg"
            />
            <div className="flex items-center justify-center h-9 w-28 rounded-md border border-border bg-background overflow-hidden">
              {logoOk ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={state.logoUrl}
                  alt="Logo preview"
                  className="max-h-7 max-w-[7rem] object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              ) : (
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Preview
                </span>
              )}
            </div>
          </div>
          <Field
            label="Brand font"
            value={state.brandFont}
            onChange={(v) => update("brandFont", v)}
            placeholder="Inter, serif"
            hint="A CSS font-family stack. Loaded from Google Fonts when possible."
          />
          <div />
          <ColorField
            label="Primary color"
            value={state.primaryColor}
            onChange={(v) => update("primaryColor", v)}
            preview={primaryHex}
          />
          <ColorField
            label="Secondary color"
            value={state.secondaryColor}
            onChange={(v) => update("secondaryColor", v)}
            preview={secondaryHex}
          />
        </div>
      </Section>

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
            <Check className="size-3.5" aria-hidden="true" />
            Saved
          </span>
        ) : null}
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </div>
    </form>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-2.5">
          {icon ? (
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {icon}
            </span>
          ) : null}
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  maxLength,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  hint?: string;
  className?: string;
}) {
  const id = `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label
        htmlFor={id}
        className="text-[11px] tracking-widest uppercase font-medium text-muted-foreground"
      >
        {label}
        {required ? (
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
      />
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  preview,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  preview: string | null;
}) {
  const id = `c-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={id}
        className="text-[11px] tracking-widest uppercase font-medium text-muted-foreground"
      >
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <span
          className="size-9 shrink-0 rounded-md border border-border"
          style={{
            background: preview ?? "transparent",
            backgroundImage: preview
              ? undefined
              : "repeating-linear-gradient(45deg, transparent 0 6px, color-mix(in oklab, currentColor 8%, transparent) 6px 7px)",
          }}
          aria-hidden="true"
        />
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#111827"
          maxLength={9}
          pattern="^#[0-9a-fA-F]{3,8}$"
          className="font-mono"
        />
      </div>
    </div>
  );
}
