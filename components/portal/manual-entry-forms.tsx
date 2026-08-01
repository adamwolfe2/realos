"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createManualApplication,
  createManualResident,
  createManualWorkOrder,
  type ManualCreateResult,
} from "@/lib/actions/manual-records";

// ---------------------------------------------------------------------------
// Manual entry forms (P1-7/8/9) — Add resident / Log work order / Log
// application. Native inputs, no form lib: each form is a handful of fields
// posting to a server action. Property select is required everywhere.
// ---------------------------------------------------------------------------

type PropertyOption = { id: string; name: string };

const inputCls =
  "w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";
const labelCls = "block text-[12px] font-medium text-foreground mb-1";

function Field({
  label,
  children,
  optional,
}: {
  label: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  // Control is nested INSIDE the label so every input gets an accessible
  // name and label clicks focus the control — no id/htmlFor plumbing.
  return (
    <label className="block">
      <span className={labelCls}>
        {label}
        {optional ? (
          <span className="text-muted-foreground font-normal"> · optional</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function useManualSubmit(redirectTo: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(action: () => Promise<ManualCreateResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(redirectTo);
        router.refresh();
      } catch {
        setError("Something went wrong — please try again.");
      }
    });
  }

  return { pending, error, submit };
}

function FormShell({
  onSubmit,
  pending,
  error,
  submitLabel,
  children,
}: {
  onSubmit: (form: FormData) => void;
  pending: boolean;
  error: string | null;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={onSubmit}
      className="rounded-[2px] border border-border bg-card p-5 space-y-4 max-w-xl"
    >
      {children}
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function PropertySelect({ properties }: { properties: PropertyOption[] }) {
  return (
    <Field label="Property">
      <select name="propertyId" required className={inputCls} defaultValue="">
        <option value="" disabled>
          Select a property
        </option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

const str = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();

// --- Add resident ----------------------------------------------------------

export function AddResidentForm({
  properties,
}: {
  properties: PropertyOption[];
}) {
  const { pending, error, submit } = useManualSubmit("/portal/residents");
  return (
    <FormShell
      pending={pending}
      error={error}
      submitLabel="Add resident"
      onSubmit={(form) =>
        submit(() =>
          createManualResident({
            propertyId: str(form, "propertyId"),
            firstName: str(form, "firstName"),
            lastName: str(form, "lastName") || undefined,
            email: str(form, "email"),
            phone: str(form, "phone") || undefined,
            unitNumber: str(form, "unitNumber") || undefined,
            status: str(form, "status"),
            moveInDate: str(form, "moveInDate"),
            moveOutDate: str(form, "moveOutDate"),
            monthlyRent: str(form, "monthlyRent")
              ? Number(str(form, "monthlyRent"))
              : undefined,
          }),
        )
      }
    >
      <PropertySelect properties={properties} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name">
          <input name="firstName" required maxLength={120} className={inputCls} />
        </Field>
        <Field label="Last name" optional>
          <input name="lastName" maxLength={120} className={inputCls} />
        </Field>
        <Field label="Email" optional>
          <input name="email" type="email" className={inputCls} />
        </Field>
        <Field label="Phone" optional>
          <input name="phone" maxLength={40} className={inputCls} />
        </Field>
        <Field label="Unit" optional>
          <input name="unitNumber" maxLength={60} className={inputCls} />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue="ACTIVE" className={inputCls}>
            <option value="ACTIVE">Active</option>
            <option value="NOTICE_GIVEN">Notice given</option>
            <option value="PAST">Past</option>
          </select>
        </Field>
        <Field label="Move-in date" optional>
          <input name="moveInDate" type="date" className={inputCls} />
        </Field>
        <Field label="Move-out date" optional>
          <input name="moveOutDate" type="date" className={inputCls} />
        </Field>
        <Field label="Monthly rent ($)" optional>
          <input
            name="monthlyRent"
            type="number"
            min={0}
            step="0.01"
            className={inputCls}
          />
        </Field>
      </div>
    </FormShell>
  );
}

// --- Log work order --------------------------------------------------------

export function LogWorkOrderForm({
  properties,
}: {
  properties: PropertyOption[];
}) {
  const { pending, error, submit } = useManualSubmit("/portal/work-orders");
  return (
    <FormShell
      pending={pending}
      error={error}
      submitLabel="Log work order"
      onSubmit={(form) =>
        submit(() =>
          createManualWorkOrder({
            propertyId: str(form, "propertyId"),
            title: str(form, "title"),
            description: str(form, "description") || undefined,
            category: str(form, "category") || undefined,
            unitNumber: str(form, "unitNumber") || undefined,
            priority: str(form, "priority"),
            status: str(form, "status"),
            scheduledFor: str(form, "scheduledFor"),
          }),
        )
      }
    >
      <PropertySelect properties={properties} />
      <Field label="Title">
        <input
          name="title"
          required
          maxLength={200}
          placeholder="Leaking kitchen faucet"
          className={inputCls}
        />
      </Field>
      <Field label="Description" optional>
        <textarea name="description" rows={3} maxLength={4000} className={inputCls} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Category" optional>
          <input
            name="category"
            maxLength={80}
            placeholder="Plumbing, HVAC, Appliance..."
            className={inputCls}
          />
        </Field>
        <Field label="Unit" optional>
          <input name="unitNumber" maxLength={60} className={inputCls} />
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue="NORMAL" className={inputCls}>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue="NEW" className={inputCls}>
            <option value="NEW">New</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In progress</option>
          </select>
        </Field>
        <Field label="Scheduled for" optional>
          <input name="scheduledFor" type="date" className={inputCls} />
        </Field>
      </div>
    </FormShell>
  );
}

// --- Log application -------------------------------------------------------

export function LogApplicationForm({
  properties,
}: {
  properties: PropertyOption[];
}) {
  const { pending, error, submit } = useManualSubmit("/portal/applications");
  return (
    <FormShell
      pending={pending}
      error={error}
      submitLabel="Log application"
      onSubmit={(form) =>
        submit(() =>
          createManualApplication({
            propertyId: str(form, "propertyId"),
            firstName: str(form, "firstName"),
            lastName: str(form, "lastName") || undefined,
            email: str(form, "email"),
            phone: str(form, "phone") || undefined,
            unitName: str(form, "unitName") || undefined,
            status: str(form, "status"),
            desiredMoveIn: str(form, "desiredMoveIn"),
          }),
        )
      }
    >
      <PropertySelect properties={properties} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name">
          <input name="firstName" required maxLength={120} className={inputCls} />
        </Field>
        <Field label="Last name" optional>
          <input name="lastName" maxLength={120} className={inputCls} />
        </Field>
        <Field label="Email" optional>
          <input name="email" type="email" className={inputCls} />
        </Field>
        <Field label="Phone" optional>
          <input name="phone" maxLength={40} className={inputCls} />
        </Field>
        <Field label="Unit applied for" optional>
          <input name="unitName" maxLength={60} className={inputCls} />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue="SUBMITTED" className={inputCls}>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
          </select>
        </Field>
        <Field label="Desired move-in" optional>
          <input name="desiredMoveIn" type="date" className={inputCls} />
        </Field>
      </div>
    </FormShell>
  );
}
