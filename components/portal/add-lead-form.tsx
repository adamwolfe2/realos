"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createManualLead } from "@/lib/actions/manual-leads";
import {
  Field,
  FormShell,
  PropertySelect,
  inputCls,
  type PropertyOption,
} from "@/components/portal/manual-entry-forms";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export function AddLeadForm({ properties }: { properties: PropertyOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  function onSubmit(form: FormData) {
    setError(null);
    setExistingId(null);
    startTransition(async () => {
      try {
        const res = await createManualLead({
          propertyId: str(form, "propertyId"),
          firstName: str(form, "firstName"),
          lastName: str(form, "lastName"),
          email: str(form, "email"),
          phone: str(form, "phone"),
          source: str(form, "source"),
          sourceDetail: str(form, "sourceDetail"),
          notes: str(form, "notes"),
        });
        if (!res.ok) {
          setError(res.error);
          setExistingId(res.leadId ?? null);
          return;
        }
        router.push(`/portal/leads/${res.id}`);
        router.refresh();
      } catch {
        setError("Something went wrong, please try again.");
      }
    });
  }

  return (
    <FormShell onSubmit={onSubmit} pending={pending} error={error} submitLabel="Add lead">
      <PropertySelect properties={properties} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name">
          <input name="firstName" required maxLength={120} className={inputCls} />
        </Field>
        <Field label="Last name" optional>
          <input name="lastName" maxLength={120} className={inputCls} />
        </Field>
        <Field label="Email" optional>
          <input name="email" type="email" maxLength={320} className={inputCls} />
        </Field>
        <Field label="Phone" optional>
          <input name="phone" type="tel" maxLength={40} className={inputCls} />
        </Field>
      </div>
      <p className="text-[12px] text-muted-foreground -mt-2">Add an email or a phone number.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Source">
          <select name="source" required defaultValue="MANUAL" className={inputCls}>
            <option value="MANUAL">Walk-in / phone</option>
            <option value="REFERRAL">Referral</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Source detail" optional>
          <input
            name="sourceDetail"
            maxLength={200}
            placeholder="e.g. Apartments.com"
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Notes" optional>
        <textarea name="notes" rows={3} maxLength={4000} className={inputCls} />
      </Field>
      {existingId ? (
        <Link
          href={`/portal/leads/${existingId}`}
          className="inline-block text-[12px] font-medium text-primary hover:underline"
        >
          Open the existing lead
        </Link>
      ) : null}
    </FormShell>
  );
}
