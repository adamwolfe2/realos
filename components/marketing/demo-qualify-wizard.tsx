"use client";

import * as React from "react";
import Cal from "@calcom/embed-react";
import { Check, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { MODULE_CATALOG } from "@/components/intake/constants";
import type { IntakeModules } from "@/components/intake/types";
import { parseCalSlug } from "./cal-demo-modal";

// ---------------------------------------------------------------------------
// DemoQualifyWizard — the /book-demo flow.
//
//   Step 1  Who you are: name, email, property website.
//   Step 2  What would move the needle: feature cards (multi-select from
//           the same MODULE_CATALOG the sales intake uses).
//   Step 3  Inline Cal.com embed — Norman's booking link
//           (NEXT_PUBLIC_CAL_BOOK_URL), prefilled with name + email.
//
// On Step 2 → 3 we POST /api/onboarding, which writes an IntakeSubmission
// (visible in /admin/intakes), fires the Slack ping, and emails the
// prospect — so the lead is captured with their feature interests even if
// they never complete the booking. Company name is derived from the
// website domain; the call is where details get filled in.
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3;

// "telegraph-commons.com" → "Telegraph Commons". Best-effort display name
// for the IntakeSubmission row; the admin queue needs SOMETHING readable
// and we deliberately keep the form at three fields.
function companyNameFromWebsite(raw: string): string {
  try {
    const host = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
      .hostname;
    const label = host.replace(/^www\./, "").split(".")[0] ?? host;
    const words = label.split(/[-_]+/).filter(Boolean);
    if (words.length === 0) return host;
    return words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return raw.trim() || "Unknown";
  }
}

function normalizeWebsiteUrl(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const candidate = t.startsWith("http") ? t : `https://${t}`;
  try {
    new URL(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}

export function DemoQualifyWizard() {
  const [step, setStep] = React.useState<Step>(1);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [selected, setSelected] = React.useState<Set<keyof IntakeModules>>(
    new Set(),
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const calSlug = parseCalSlug(process.env.NEXT_PUBLIC_CAL_BOOK_URL);

  const step1Valid =
    name.trim().length >= 2 &&
    /.+@.+\..+/.test(email.trim()) &&
    website.trim().length >= 4;

  function toggleModule(key: keyof IntakeModules) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function submitAndAdvance() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyNameFromWebsite(website),
          websiteUrl: normalizeWebsiteUrl(website) ?? "",
          propertyType: "RESIDENTIAL",
          primaryContactName: name.trim(),
          primaryContactEmail: email.trim().toLowerCase(),
          selectedModules: Array.from(selected),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not save your answers. Try again.");
        return;
      }
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 3: the booking ─────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="ls-page-fade">
        <StepHeader
          step={3}
          title="Pick a time"
          subtitle="15 minutes, focused on exactly what you picked."
        />
        {calSlug ? (
          <div
            className="overflow-hidden rounded-[6px] border"
            style={{ borderColor: "#E2E8F0", minHeight: 560 }}
          >
            <Cal
              calLink={calSlug}
              style={{ width: "100%", height: "100%", minHeight: 560 }}
              config={{
                layout: "month_view",
                name: name.trim(),
                email: email.trim().toLowerCase(),
              }}
            />
          </div>
        ) : (
          // Env var missing (preview builds) — never strand the prospect.
          <div
            className="rounded-[6px] border p-8 text-center"
            style={{ borderColor: "#E2E8F0" }}
          >
            <p className="text-[15px] font-semibold" style={{ color: "#1E2A3A" }}>
              Your answers are in.
            </p>
            <p className="mt-2 text-[13px]" style={{ color: "#64748B" }}>
              Scheduling is temporarily unavailable — we&apos;ll email you at{" "}
              <span className="font-medium">{email.trim()}</span> to set up
              the call.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Step 2: feature cards ───────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="ls-page-fade">
        <StepHeader
          step={2}
          title="What would move the needle most?"
          subtitle="Pick as many as you like — we'll focus the call on these."
        />
        <div className="ls-stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODULE_CATALOG.map((m) => {
            const active = selected.has(m.key);
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleModule(m.key)}
                aria-pressed={active}
                className="rounded-[4px] border p-4 text-left transition-all"
                style={{
                  borderColor: active ? "#2563EB" : "#E2E8F0",
                  backgroundColor: active ? "#EFF6FF" : "#FFFFFF",
                  boxShadow: active
                    ? "0 0 0 1px #2563EB inset"
                    : "none",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="text-[14px] font-semibold"
                    style={{ color: "#1E2A3A" }}
                  >
                    {m.label}
                  </span>
                  <span
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors"
                    style={{
                      borderColor: active ? "#2563EB" : "#CBD5E1",
                      backgroundColor: active ? "#2563EB" : "#FFFFFF",
                    }}
                  >
                    {active ? (
                      <Check className="h-3 w-3" style={{ color: "#FFFFFF" }} />
                    ) : null}
                  </span>
                </div>
                <p
                  className="mt-1.5 text-[12.5px] leading-relaxed"
                  style={{ color: "#64748B" }}
                >
                  {m.desc}
                </p>
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mt-3 text-[13px]" style={{ color: "#DC2626" }}>
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium"
            style={{ color: "#64748B" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <button
            type="button"
            onClick={submitAndAdvance}
            disabled={submitting || selected.size === 0}
            className="inline-flex items-center gap-2 rounded-[2px] px-6 py-3 text-[14px] font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#2563EB", color: "#FFFFFF" }}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Next — pick a time
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: contact + property ──────────────────────────────────────
  return (
    <div className="ls-page-fade">
      <StepHeader
        step={1}
        title="Tell us who you are"
        subtitle="Three fields, then two questions, then you pick a time."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step1Valid) setStep(2);
        }}
        className="grid grid-cols-1 gap-4"
      >
        <WizardField
          label="Your name"
          value={name}
          onChange={setName}
          placeholder="Jordan Smith"
          type="text"
          autoComplete="name"
        />
        <WizardField
          label="Work email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          type="email"
          autoComplete="email"
        />
        <WizardField
          label="Property website"
          value={website}
          onChange={setWebsite}
          placeholder="e.g. telegraphcommons.com"
          type="text"
          autoComplete="url"
        />
        <button
          type="submit"
          disabled={!step1Valid}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-[2px] px-6 py-3 text-[14px] font-semibold transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "#2563EB", color: "#FFFFFF" }}
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: Step;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-1.5">
        {[1, 2, 3].map((s) => (
          <span
            key={s}
            className="h-1 w-8 rounded-full transition-colors"
            style={{ backgroundColor: s <= step ? "#2563EB" : "#E2E8F0" }}
          />
        ))}
      </div>
      <h2
        className="text-[22px] font-semibold tracking-[-0.01em]"
        style={{ color: "#1E2A3A" }}
      >
        {title}
      </h2>
      <p className="mt-1 text-[13.5px]" style={{ color: "#64748B" }}>
        {subtitle}
      </p>
    </div>
  );
}

function WizardField({
  label,
  value,
  onChange,
  placeholder,
  type,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: string;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "#475569" }}
      >
        {label}
      </span>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={200}
        className="h-11 w-full rounded-[2px] border px-3 text-[14px] outline-none transition-colors focus:border-[#2563EB]"
        style={{
          borderColor: "#CBD5E1",
          color: "#1E2A3A",
          backgroundColor: "#FFFFFF",
        }}
      />
    </label>
  );
}
