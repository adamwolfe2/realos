"use client";

import { useState } from "react";

export function ApplyForm({
  orgId,
  propertyId,
  unitTypes,
  context,
}: {
  orgId: string;
  propertyId?: string;
  unitTypes: string[];
  context: "apply" | "contact";
}) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      orgId,
      propertyId,
      source: "FORM",
      sourceDetail: context === "apply" ? "apply_page" : "contact_page",
      firstName: str(fd.get("firstName")),
      lastName: str(fd.get("lastName")),
      email: str(fd.get("email")),
      phone: str(fd.get("phone")),
      preferredUnitType: str(fd.get("preferredUnitType")),
      desiredMoveIn: str(fd.get("desiredMoveIn")),
      budgetMax: str(fd.get("budgetMax")),
      notes: str(fd.get("notes")),
    };
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Submit failed (${res.status})`);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="border rounded-md p-6 text-center">
        <h2 className="font-serif text-2xl font-bold mb-2">
          Thanks, we'll be in touch.
        </h2>
        <p className="opacity-70">
          Check your email for confirmation and next steps. We respond within
          one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input name="firstName" label="First name" required />
        <Input name="lastName" label="Last name" required />
        <Input name="email" label="Email" type="email" required />
        <Input name="phone" label="Phone" type="tel" />
      </div>
      {context === "apply" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs tracking-widest uppercase opacity-70">
              Preferred unit type
            </span>
            <select
              name="preferredUnitType"
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">No preference</option>
              {unitTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input name="desiredMoveIn" label="Desired move-in" type="date" />
            <Input
              name="budgetMax"
              label="Max monthly budget ($)"
              type="number"
            />
          </div>
        </>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          Anything else?
        </span>
        <textarea
          name="notes"
          rows={4}
          className="border rounded px-3 py-2 text-sm"
          placeholder="Questions, special requests, move-in timing."
        />
      </label>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 text-sm font-semibold rounded disabled:opacity-40"
        style={{ backgroundColor: "var(--tenant-primary)", color: "white" }}
      >
        {submitting
          ? "Sending…"
          : context === "apply"
          ? "Submit application"
          : "Send message"}
      </button>
    </form>
  );
}

function Input({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs tracking-widest uppercase opacity-70">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        className="border rounded px-3 py-2 text-sm"
      />
    </label>
  );
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
