"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Email capture gate that sits between the top-line score reveal and the
// full report on /audit/[token]. On success we call `router.refresh()` so
// the server-rendered page re-reads ProspectAudit and now shows the full
// findings block instead of the gate.

export function EmailGate({ auditId }: { auditId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/audit/${auditId}/capture-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data: { ok?: boolean; error?: string } = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not capture email");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-xl border bg-white p-6 sm:p-8"
      style={{ borderColor: "#E5E7EB" }}
    >
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em]"
        style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
      >
        Unlock the full report
      </p>
      <h2 className="text-2xl sm:text-3xl font-semibold mt-2" style={{ color: "#1E2A3A" }}>
        See every finding, every risk, every quick win.
      </h2>
      <p className="text-sm mt-2 max-w-xl" style={{ color: "#4B5563" }}>
        We&apos;ll keep this report at the link you&apos;re on now and email it to you
        so it&apos;s easy to share. No marketing spam.
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-col sm:flex-row gap-3 max-w-lg">
        <Input
          type="email"
          required
          autoComplete="email"
          placeholder="you@yourcompany.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 h-11 text-base"
        />
        <Button type="submit" size="lg" disabled={busy || !email.trim()}>
          {busy ? "Unlocking…" : "Show me the report"}
        </Button>
      </form>
      {error ? (
        <p className="text-sm mt-2" style={{ color: "#B91C1C" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
