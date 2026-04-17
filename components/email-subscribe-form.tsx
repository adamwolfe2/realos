"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

interface Props {
  source?: string;
  tagline?: string;
}

export function EmailSubscribeForm({
  source = "blog",
  tagline = "Distribution insights, monthly.",
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === "loading" || status === "success") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      className="border p-6 sm:p-8"
      style={{ borderColor: "var(--border-strong)", backgroundColor: "var(--bg-white)" }}
    >
      <div className="max-w-xl mx-auto text-center">
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          Newsletter
        </div>
        <h3
          className="font-serif text-xl sm:text-2xl font-normal mb-2"
          style={{ color: "var(--text-headline)" }}
        >
          {tagline}
        </h3>
        <p
          className="font-mono text-xs mb-5"
          style={{ color: "var(--text-body)" }}
        >
          Practical guides for distribution operators. No fluff, no spam.
        </p>

        {status === "success" ? (
          <div
            className="flex items-center justify-center gap-2 font-mono text-sm font-semibold"
            style={{ color: "var(--blue)" }}
          >
            <Check className="w-4 h-4" />
            You&apos;re in. Talk soon.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-0">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 border font-mono text-sm px-4 py-3 outline-none focus:border-[var(--blue)] transition-colors"
              style={{
                borderColor: "var(--border-strong)",
                borderRight: "none",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-headline)",
              }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="flex items-center gap-2 font-mono text-xs font-semibold text-white px-5 py-3 transition-colors disabled:opacity-50"
              style={{ backgroundColor: "var(--blue)", flexShrink: 0 }}
            >
              {status === "loading" ? "..." : (
                <>Subscribe <ArrowRight className="w-3.5 h-3.5" /></>
              )}
            </button>
          </form>
        )}

        {status === "error" && (
          <p className="font-mono text-xs mt-2" style={{ color: 'var(--color-error)' }}>
            Something went wrong. Try again?
          </p>
        )}
      </div>
    </div>
  );
}
