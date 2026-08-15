"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// AuditPaywall — wraps the post-TopLine sections (source breakdown,
// mentions, findings, narrative) and renders them BLURRED with an email
// gate modal floating over the top of the blurred region.
//
// Adam 2026-05-29 feedback: rather than hiding the full report behind a
// simple email form, "show all the reviews and metrics" but blurred so
// the prospect SEES the depth of the report and is motivated to enter
// their email to read it.
//
// Behavior:
//   * unlocked=true → renders children as-is, no wrapper.
//   * unlocked=false → wraps in a relative container:
//     - children are rendered with filter: blur(7px) + pointer-events:none
//       + user-select:none so the prospect can't read or interact, but
//       can scroll the page normally and see the breadth of the report.
//     - A position: sticky email modal floats at the top of the viewport
//       inside the blurred region. As the user scrolls down through the
//       blurred mentions / findings / narrative, the modal stays visible
//       so the unlock CTA is always one click away.
//
// On successful email capture (the EmailGate component already does this),
// router.refresh() re-reads the audit row (which now has audit.email set),
// the viewer renders with unlocked=true, and the blur lifts naturally.
// ---------------------------------------------------------------------------

interface AuditPaywallProps {
  unlocked: boolean;
  auditId: string;
  /** Number of public mentions surfaced — drives the modal subhead so
   *  the prospect sees a specific number ("18 mentions") rather than a
   *  generic "see more". */
  mentionCount?: number;
  /** Total finding count (quickWins + risks + opportunities) — same
   *  reason as mentionCount. Shows depth. */
  findingCount?: number;
  children: ReactNode;
}

export function AuditPaywall({
  unlocked,
  auditId,
  mentionCount = 0,
  findingCount = 0,
  children,
}: AuditPaywallProps) {
  const router = useRouter();
  // The unlock ceremony: on successful email capture the blur LIFTS in
  // place (600ms) while the modal fades away, and only then does
  // router.refresh() swap in the unlocked server tree — invisibly, since
  // the content underneath was the real content all along. Previously the
  // refresh happened immediately, so the blur teleported off with zero
  // reveal moment. Reduced motion: the global reduced-motion net zeroes
  // the transitions, so the reveal is instant there.
  const [revealing, setRevealing] = useState(false);
  const handleUnlocked = useCallback(() => {
    setRevealing(true);
    window.setTimeout(() => router.refresh(), 750);
  }, [router]);

  if (unlocked) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred content — full report renders here. pointer-events:none
          + user-select:none make sure no link is clickable and no text
          is copy-pasteable through the blur. Visual blur is heavy enough
          that text is unreadable. */}
      <div
        aria-hidden={revealing ? undefined : "true"}
        style={{
          filter: revealing ? "blur(0px)" : "blur(7px)",
          pointerEvents: "none",
          userSelect: "none",
          // Slight saturation drop keeps the blurred region feeling
          // visually quieter — less competing with the modal overlay.
          opacity: revealing ? 1 : 0.85,
          transition:
            "filter 600ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 600ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {children}
      </div>

      {/* Sticky email modal — anchored to the viewport so it stays
          visible as the prospect scrolls through the blurred content.
          Sized to feel like a real modal, not a banner. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <div className="sticky pointer-events-none" style={{ top: 96 }}>
          <div
            className="flex justify-center px-4"
            style={{
              opacity: revealing ? 0 : 1,
              transform: revealing ? "translateY(8px)" : "none",
              transition:
                "opacity 400ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            <PaywallModal
              auditId={auditId}
              mentionCount={mentionCount}
              findingCount={findingCount}
              onUnlocked={handleUnlocked}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaywallModal — compact email-capture card that floats over the blurred
// report. Title leans on the real numbers from the scan ("18 mentions",
// "12 quick wins") so the prospect understands what they're unlocking.
// ---------------------------------------------------------------------------
function PaywallModal({
  auditId,
  mentionCount,
  findingCount,
  onUnlocked,
}: {
  auditId: string;
  mentionCount: number;
  findingCount: number;
  /** Fires on successful capture — the parent runs the blur-lift reveal
   *  and then refreshes the route. */
  onUnlocked: () => void;
}) {
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
      // Parent lifts the blur, then refreshes; the server re-reads
      // ProspectAudit and renders unlocked=true.
      onUnlocked();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-2xl bg-white pointer-events-auto"
      style={{
        boxShadow:
          "0 24px 48px rgba(15, 23, 42, 0.22), 0 4px 12px rgba(15, 23, 42, 0.08), 0 0 0 1px #E5E7EB",
        padding: 24,
        maxWidth: 480,
        width: "100%",
      }}
    >
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em]"
        style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
      >
        Want the full report?
      </p>
      <h2
        className="mt-2"
        style={{
          color: "#1E2A3A",
          fontFamily: "var(--font-sans)",
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.018em",
          lineHeight: 1.2,
        }}
      >
        {buildHeadline(mentionCount, findingCount)}
      </h2>
      <p
        className="mt-2"
        style={{
          color: "#4B5563",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        Enter your email and we&apos;ll unlock every mention, every quick
        win, every risk on this page. We&apos;ll also send you a copy.
        No marketing spam.
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@yourcompany.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className="w-full rounded-md border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{
            borderColor: "#E5E7EB",
            color: "#1E2A3A",
            backgroundColor: "#FFFFFF",
          }}
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          aria-busy={busy}
          className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold text-white active:scale-[0.98] motion-reduce:active:scale-100 disabled:opacity-60"
          style={{
            backgroundColor: "#2563EB",
            padding: "10px 16px",
            transition:
              "background-color 0.15s ease, transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Unlocking the report…
            </>
          ) : (
            "Show me the full report"
          )}
        </button>
      </form>

      {error ? (
        <p
          className="mt-2 text-xs"
          style={{ color: "#B91C1C" }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <p
        className="mt-3 text-[11px]"
        style={{
          color: "#9CA3AF",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.06em",
          textAlign: "center",
        }}
      >
        One email · no spam · used only to send you this report
      </p>
    </div>
  );
}

// Headline picker — leans on the real counts when we have them so the
// prospect understands the volume of content being gated. Falls back
// to a generic line when the scan came up empty.
function buildHeadline(mentionCount: number, findingCount: number): string {
  if (mentionCount >= 5 && findingCount >= 3) {
    return `Read all ${mentionCount} mentions + ${findingCount} action items.`;
  }
  if (mentionCount >= 5) {
    return `Read all ${mentionCount} public mentions in full.`;
  }
  if (findingCount >= 3) {
    return `See all ${findingCount} risks, wins, and opportunities.`;
  }
  return "See every finding, every risk, every quick win.";
}
