"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createClientDirect } from "@/lib/actions/create-client";
import {
  PROPERTY_TYPES,
  RESIDENTIAL_SUBTYPES,
  COMMERCIAL_SUBTYPES,
  MODULE_CATALOG,
} from "@/components/intake/constants";

// ---------------------------------------------------------------------------
// NewClientForm — agency white-glove "create client from scratch" form.
// Posts to createClientDirect (server action) and routes to the new client's
// detail page on success. No IntakeSubmission required.
// ---------------------------------------------------------------------------

const TIERS = [
  { key: "", label: "No tier yet" },
  { key: "STARTER", label: "Starter" },
  { key: "GROWTH", label: "Growth" },
  { key: "SCALE", label: "Scale" },
  { key: "CUSTOM", label: "Custom" },
] as const;

const selectCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function NewClientForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const [companyName, setCompanyName] = React.useState("");
  const [shortName, setShortName] = React.useState("");
  const [propertyType, setPropertyType] = React.useState<string>("RESIDENTIAL");
  const [residentialSubtype, setResidentialSubtype] = React.useState("");
  const [commercialSubtype, setCommercialSubtype] = React.useState("");

  const [contactName, setContactName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [contactRole, setContactRole] = React.useState("");
  const [hqCity, setHqCity] = React.useState("");
  const [hqState, setHqState] = React.useState("");

  const [tier, setTier] = React.useState("");
  const [modules, setModules] = React.useState<Record<string, boolean>>({
    website: true,
    leadCapture: true,
  });

  const [propName, setPropName] = React.useState("");
  const [propCity, setPropCity] = React.useState("");
  const [propState, setPropState] = React.useState("");

  const [sendInvite, setSendInvite] = React.useState(true);

  const showResidential = propertyType === "RESIDENTIAL" || propertyType === "MIXED";
  const showCommercial = propertyType === "COMMERCIAL" || propertyType === "MIXED";

  function toggleModule(key: string) {
    setModules((m) => ({ ...m, [key]: !m[key] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);

    const selected = Object.entries(modules)
      .filter(([, v]) => v)
      .map(([k]) => k);

    try {
      const res = await createClientDirect({
        companyName,
        shortName,
        propertyType: propertyType as "RESIDENTIAL",
        residentialSubtype: showResidential && residentialSubtype
          ? (residentialSubtype as never)
          : null,
        commercialSubtype: showCommercial && commercialSubtype
          ? (commercialSubtype as never)
          : null,
        primaryContactName: contactName,
        primaryContactEmail: contactEmail,
        primaryContactPhone: contactPhone,
        primaryContactRole: contactRole,
        hqCity,
        hqState,
        modules: selected as never,
        subscriptionTier: tier ? (tier as never) : null,
        firstPropertyName: propName,
        firstPropertyCity: propCity,
        firstPropertyState: propState,
        sendInvite,
      });

      if (!res.ok) {
        toast.error(res.error);
        // If a duplicate org was found, jump the operator to it.
        if (res.orgId) {
          router.push(`/admin/clients/${res.orgId}`);
        }
        setPending(false);
        return;
      }

      if (res.warnings.length > 0) {
        // Org WAS created, but the invite/email leg had a problem — don't tell
        // the operator "invite sent" when it didn't.
        toast.warning(`${companyName} created`, {
          description: res.warnings.join(" "),
        });
      } else {
        toast.success(
          sendInvite
            ? `${companyName} created — invite sent to ${contactEmail}`
            : `${companyName} created`,
        );
      }
      router.push(`/admin/clients/${res.orgId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create client",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Company */}
      <fieldset className="ls-card p-5 space-y-4" disabled={pending}>
        <legend className="text-[14px] font-semibold tracking-tight px-1">
          Company
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" required>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Telegraph Commons LLC"
              required
            />
          </Field>
          <Field label="Short name" hint="Used in nav + URLs">
            <Input
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Telegraph"
            />
          </Field>
          <Field label="Property type" required>
            <select
              className={selectCls}
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          {showResidential ? (
            <Field label="Residential subtype">
              <select
                className={selectCls}
                value={residentialSubtype}
                onChange={(e) => setResidentialSubtype(e.target.value)}
              >
                <option value="">—</option>
                {RESIDENTIAL_SUBTYPES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {showCommercial ? (
            <Field label="Commercial subtype">
              <select
                className={selectCls}
                value={commercialSubtype}
                onChange={(e) => setCommercialSubtype(e.target.value)}
              >
                <option value="">—</option>
                {COMMERCIAL_SUBTYPES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
      </fieldset>

      {/* Primary contact */}
      <fieldset className="ls-card p-5 space-y-4" disabled={pending}>
        <legend className="text-[14px] font-semibold tracking-tight px-1">
          Primary contact
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Norman Gensinger"
              required
            />
          </Field>
          <Field label="Email" required hint="Receives the portal invite">
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="norman@example.com"
              required
            />
          </Field>
          <Field label="Phone">
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="(503) 555-0123"
            />
          </Field>
          <Field label="Role / title">
            <Input
              value={contactRole}
              onChange={(e) => setContactRole(e.target.value)}
              placeholder="Owner"
            />
          </Field>
          <Field label="HQ city">
            <Input value={hqCity} onChange={(e) => setHqCity(e.target.value)} />
          </Field>
          <Field label="HQ state">
            <Input
              value={hqState}
              onChange={(e) => setHqState(e.target.value)}
              placeholder="OR"
            />
          </Field>
        </div>
      </fieldset>

      {/* Modules */}
      <fieldset className="ls-card p-5 space-y-3" disabled={pending}>
        <legend className="text-[14px] font-semibold tracking-tight px-1">
          Modules
        </legend>
        <p className="text-[12px] text-muted-foreground -mt-1">
          Website + Lead Capture are always on (Core). Toggle the rest — you can
          change any of these later from the client detail page.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODULE_CATALOG.map((m) => {
            const core = m.priceHint === "Core";
            const checked = core ? true : !!modules[m.key];
            return (
              <label
                key={m.key}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                  checked
                    ? "border-primary/40 bg-primary/[0.04]"
                    : "border-input hover:bg-accent/40",
                  core && "opacity-80 cursor-default",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--color-primary)]"
                  checked={checked}
                  disabled={core}
                  onChange={() => toggleModule(m.key)}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{m.label}</span>
                    <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                      {m.priceHint}
                    </span>
                  </span>
                  <span className="block text-[11.5px] text-muted-foreground leading-snug mt-0.5">
                    {m.desc}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="pt-1">
          <Field label="Subscription tier" hint="Optional — set now or later">
            <select
              className={selectCls}
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              {TIERS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      {/* First property (optional) */}
      <fieldset className="ls-card p-5 space-y-4" disabled={pending}>
        <legend className="text-[14px] font-semibold tracking-tight px-1">
          First property <span className="text-muted-foreground font-normal">(optional)</span>
        </legend>
        <p className="text-[12px] text-muted-foreground -mt-1">
          Seed one property so the portal isn&apos;t empty on first login. Leave
          blank to add properties later (or sync from AppFolio).
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Property name">
            <Input
              value={propName}
              onChange={(e) => setPropName(e.target.value)}
              placeholder="Telegraph Commons"
            />
          </Field>
          <Field label="City">
            <Input value={propCity} onChange={(e) => setPropCity(e.target.value)} />
          </Field>
          <Field label="State">
            <Input
              value={propState}
              onChange={(e) => setPropState(e.target.value)}
              placeholder="OR"
            />
          </Field>
        </div>
      </fieldset>

      {/* Submit */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 accent-[var(--color-primary)]"
            checked={sendInvite}
            onChange={(e) => setSendInvite(e.target.checked)}
            disabled={pending}
          />
          Send portal invite to the primary contact now
        </label>
        <Button type="submit" disabled={pending} className="sm:w-auto">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
              Creating…
            </>
          ) : (
            <>
              <Building2 className="size-4" strokeWidth={1.5} />
              Create client
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
        {hint ? (
          <span className="ml-2 font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}
