"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, Mail, User } from "lucide-react";
import { computeLostLeads } from "@/lib/marketing/lost-leads-math";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// LostLeadsCalculator — the interactive core of /lost-leads.
//
// Two number inputs (visitors, leads) drive a pure client-side subtraction
// (lib/marketing/lost-leads-math.ts) — no grounded "95% anonymous" stat
// exists in PRODUCT.md, so the headline number is exactly what the
// prospect typed in, not an invented multiplier.
//
// "Send me the math" gate writes an IntakeSubmission via POST
// /api/onboarding (selectedModules: ["pixel"]) — same contract as the
// /build-a-chatbot keep-it gate.
// ---------------------------------------------------------------------------

const DEFAULT_VISITORS = 4000;
const DEFAULT_LEADS = 60;

export function LostLeadsCalculator() {
  const [visitors, setVisitors] = React.useState(DEFAULT_VISITORS);
  const [leads, setLeads] = React.useState(DEFAULT_LEADS);
  const { lostLeads, unnamedRate } = computeLostLeads(visitors, leads);

  return (
    <div id="calculator" className="scroll-mt-24">
      <div
        className="grid grid-cols-1 gap-0 overflow-hidden border md:grid-cols-2"
        style={{
          borderColor: "#e0e0e0",
          borderRadius: 6,
          backgroundColor: "#FFFFFF",
          boxShadow:
            "0 2px 4px rgba(15,23,42,.05), 0 16px 40px rgba(15,23,42,.09)",
        }}
      >
        {/* Inputs */}
        <div className="p-6 md:p-8">
          <p
            className="text-[11px] font-mono uppercase tracking-[0.16em]"
            style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
          >
            Your numbers
          </p>
          <div className="mt-5">
            <NumberField
              label="Monthly website visitors"
              value={visitors}
              onChange={setVisitors}
              min={0}
              max={1_000_000}
              step={100}
            />
          </div>
          <div className="mt-4">
            <NumberField
              label="Monthly leads captured"
              value={leads}
              onChange={setLeads}
              min={0}
              max={1_000_000}
              step={5}
            />
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: "#6f6f6f" }}>
            &quot;Leads&quot; = anyone who filled out a form, called, or
            texted. Everyone else who visited and left is the number on the
            right.
          </p>
        </div>

        {/* Output */}
        <div
          className="flex flex-col justify-center p-6 md:p-8"
          style={{ backgroundColor: "#f7f9fe", borderTop: "1px solid #e0e0e0" }}
        >
          <p className="text-[13px]" style={{ color: "#525252" }}>
            Renters who visited and left unnamed, every month
          </p>
          <p
            className="mt-2 tabular-nums"
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: "clamp(40px, 6vw, 56px)",
              letterSpacing: "-0.02em",
              color: "#161616",
              lineHeight: 1,
            }}
          >
            ~{lostLeads.toLocaleString()}
          </p>
          <p className="mt-2 text-[13px]" style={{ color: "#6f6f6f" }}>
            That&apos;s{" "}
            <span className="font-semibold" style={{ color: "#161616" }}>
              {Math.round(unnamedRate)}%
            </span>{" "}
            of your traffic leaving with no name and no email attached.
          </p>
        </div>
      </div>

      <div className="mt-8 max-w-[520px]">
        <SendMathGate visitors={visitors} leads={leads} lostLeads={lostLeads} />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "#525252" }}
      >
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-12 w-full border px-3 text-[18px] font-semibold tabular-nums outline-none transition-colors focus:border-[#0f62fe]"
        style={{
          borderColor: "#c6c6c6",
          borderRadius: 2,
          color: "#161616",
          backgroundColor: "#FFFFFF",
          fontFamily: "var(--font-mono)",
        }}
      />
    </label>
  );
}

// ── "Send me the math" gate: name + email → IntakeSubmission ──────────────

function SendMathGate({
  visitors,
  leads,
  lostLeads,
}: {
  visitors: number;
  leads: number;
  lostLeads: number;
}) {
  const [name, setName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const valid =
    name.trim().length >= 2 &&
    company.trim().length >= 2 &&
    /.+@.+\..+/.test(email.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company.trim(),
          propertyType: "RESIDENTIAL",
          primaryContactName: name.trim(),
          primaryContactEmail: email.trim().toLowerCase(),
          selectedModules: ["pixel"],
          biggestPainPoint: `Lost-leads calculator: ~${lostLeads} unnamed/mo (${visitors} visitors, ${leads} leads)`,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save that. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div
        className="border p-6"
        style={{ borderColor: "#e0e0e0", borderRadius: 6, backgroundColor: "#FFFFFF" }}
      >
        <CheckCircle2 className="h-5 w-5" style={{ color: "#24a148" }} aria-hidden />
        <h3 className="mt-2.5 text-[17px] font-semibold" style={{ color: "#161616" }}>
          Sent. Check your inbox.
        </h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "#525252" }}>
          We emailed the math to {email.trim()}. Want to see the actual names
          behind those visitors, not just the count? That&apos;s the pixel,
          live on your site in a 15-minute call.
        </p>
        <BookDemoLink
          className="mt-4 inline-flex w-full items-center justify-center px-5 py-3 text-[14px] font-semibold text-white"
          style={{ backgroundColor: "#0f62fe", borderRadius: 2 }}
          ariaLabel="Book a 15-minute call to see the pixel live"
        >
          Book a 15-min call
        </BookDemoLink>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border p-6"
      style={{ borderColor: "#e0e0e0", borderRadius: 6, backgroundColor: "#FFFFFF" }}
    >
      <p className="text-[15px] font-semibold" style={{ color: "#161616" }}>
        Send me this math
      </p>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "#6f6f6f" }}>
        We&apos;ll email you this number plus what it costs at your average
        lease value.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#161616" }}>
            <User className="h-3.5 w-3.5" style={{ color: "#6f6f6f" }} aria-hidden />
            Your name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            className="h-11 w-full border px-3 text-[14px] outline-none transition-colors focus:border-[#0f62fe]"
            style={{ borderColor: "#c6c6c6", borderRadius: 2, color: "#161616" }}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold" style={{ color: "#161616" }}>
            Property or company
          </span>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            required
            className="h-11 w-full border px-3 text-[14px] outline-none transition-colors focus:border-[#0f62fe]"
            style={{ borderColor: "#c6c6c6", borderRadius: 2, color: "#161616" }}
          />
        </label>
      </div>
      <label className="mt-2.5 block">
        <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#161616" }}>
          <Mail className="h-3.5 w-3.5" style={{ color: "#6f6f6f" }} aria-hidden />
          Work email
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="h-11 w-full border px-3 text-[14px] outline-none transition-colors focus:border-[#0f62fe]"
          style={{ borderColor: "#c6c6c6", borderRadius: 2, color: "#161616" }}
        />
      </label>
      <button
        type="submit"
        disabled={busy || !valid}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-[14px] font-semibold text-white transition-all disabled:opacity-50"
        style={{ backgroundColor: "#0f62fe", borderRadius: 2 }}
      >
        {busy ? "Sending…" : "Email me the math"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
      {error ? (
        <p className="mt-2 text-[12px]" style={{ color: "#da1e28" }} role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-center text-[12px]" style={{ color: "#6f6f6f" }}>
        Free · no account needed
      </p>
    </form>
  );
}
