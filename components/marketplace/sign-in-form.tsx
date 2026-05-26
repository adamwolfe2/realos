"use client";

import React, { useState } from "react";

// Magic-link sign-in form. Submits to /api/marketplace/auth/request and
// shows a "check your inbox" state on success.

export function SignInForm({ next }: { next: string | null }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.error === "invalid_email"
            ? "Please enter a valid email."
            : data?.error === "send_failed"
              ? "Could not send the email. Try again in a moment."
              : "Could not send the link. Try again in a moment.",
        );
        return;
      }
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div
        className="p-5 text-center"
        style={{
          backgroundColor: "#F1F5F9",
          borderRadius: "12px",
        }}
      >
        <p
          style={{
            color: "#2563EB",
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Check your inbox
        </p>
        <p
          className="mt-2"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            fontWeight: 500,
          }}
        >
          We just sent a sign-in link to{" "}
          <span style={{ fontWeight: 600 }}>{email}</span>.
        </p>
        <p
          className="mt-1"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          The link expires in 30 minutes. Didn't get it?{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            style={{ color: "#2563EB", fontWeight: 600 }}
          >
            Send another
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <label
        className="block"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#94A3B8",
          fontWeight: 600,
        }}
      >
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="mt-1.5 w-full"
          style={{
            padding: "10px 14px",
            border: "1px solid #E2E8F0",
            borderRadius: "10px",
            fontFamily: "var(--font-sans)",
            fontSize: "14.5px",
            color: "#1E2A3A",
            backgroundColor: "white",
            letterSpacing: "normal",
            textTransform: "none",
          }}
        />
      </label>

      <button
        type="submit"
        disabled={submitting || !email}
        className="w-full"
        style={{
          padding: "11px 18px",
          borderRadius: "10px",
          backgroundColor: "#2563EB",
          color: "#fff",
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          fontWeight: 600,
          border: "none",
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting || !email ? 0.6 : 1,
          transition: "opacity 180ms ease",
        }}
      >
        {submitting ? "Sending…" : "Send sign-in link"}
      </button>

      {error && (
        <p
          style={{
            color: "#B91C1C",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            marginTop: "8px",
          }}
        >
          {error}
        </p>
      )}
    </form>
  );
}
