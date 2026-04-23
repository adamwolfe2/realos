"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <form onSubmit={submit} className="space-y-5 border rounded-md p-5">
      <h2 className="text-sm font-semibold">Company info</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TF label="Company name" value={state.name} onChange={(v) => update("name", v)} />
        <TF label="Short name" value={state.shortName} onChange={(v) => update("shortName", v)} />
        <TF label="Primary contact" value={state.primaryContactName} onChange={(v) => update("primaryContactName", v)} />
        <TF label="Contact email" value={state.primaryContactEmail} onChange={(v) => update("primaryContactEmail", v)} type="email" />
        <TF label="Contact phone" value={state.primaryContactPhone} onChange={(v) => update("primaryContactPhone", v)} />
        <TF label="Contact role" value={state.primaryContactRole} onChange={(v) => update("primaryContactRole", v)} />
      </div>

      <h2 className="text-sm font-semibold pt-4 border-t">HQ address</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TF label="Address line 1" value={state.hqAddressLine1} onChange={(v) => update("hqAddressLine1", v)} />
        <TF label="City" value={state.hqCity} onChange={(v) => update("hqCity", v)} />
        <TF label="State" value={state.hqState} onChange={(v) => update("hqState", v)} />
        <TF label="Postal code" value={state.hqPostalCode} onChange={(v) => update("hqPostalCode", v)} />
      </div>

      <h2 className="text-sm font-semibold pt-4 border-t">Brand</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TF label="Logo URL" value={state.logoUrl} onChange={(v) => update("logoUrl", v)} type="url" />
        <TF label="Brand font" value={state.brandFont} onChange={(v) => update("brandFont", v)} placeholder="Inter, serif" />
        <TF label="Primary color (hex)" value={state.primaryColor} onChange={(v) => update("primaryColor", v)} placeholder="#111827" />
        <TF label="Secondary color (hex)" value={state.secondaryColor} onChange={(v) => update("secondaryColor", v)} placeholder="#6b7280" />
      </div>

      <div className="flex items-center gap-3 pt-3 border-t">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {saved ? (
          <span className="text-xs text-emerald-700">Saved</span>
        ) : null}
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </div>
    </form>
  );
}

function TF({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs tracking-widest uppercase text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border rounded px-3 py-2 text-sm bg-background"
      />
    </label>
  );
}
