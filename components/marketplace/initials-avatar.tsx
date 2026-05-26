"use client";

import React from "react";

// ---------------------------------------------------------------------------
// LeadAvatar — two-mode avatar for marketplace leads
//
//   mode="blurred"  → renders a stock portrait under a heavy blur filter.
//                      Communicates "a real human is behind this card,
//                      identity locked until purchase." Used on browse
//                      and pre-purchase detail.
//   mode="revealed" → renders an InitialsAvatar (color from name hash).
//                      Used post-purchase. We never unblur the stock
//                      photo into a real face because that face isn't
//                      the actual lead — instead we surface the LinkedIn
//                      URL as the verification path to the buyer.
//
// InitialsAvatar — honest initials-only variant, exported separately for
// surfaces (seller dashboard, buyer dashboard) that don't want the
// blurred-photo affordance.
// ---------------------------------------------------------------------------

const PALETTE = [
  "#2563EB", // brand blue
  "#1E40AF", // deep blue
  "#5B8CE6", // sky
  "#7C3AED", // violet
  "#0EA5E9", // cyan
  "#0891B2", // teal
  "#475569", // slate
  "#334155", // dark slate
];

function seedColor(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function pickInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  displayName?: string | null,
): string {
  const a = (firstName ?? "").trim().charAt(0).toUpperCase();
  const b = (lastName ?? "").trim().charAt(0).toUpperCase();
  if (a && b) return a + b;
  if (a) return a;
  // Fallback when only displayName is available (e.g. "Marisol R.")
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    const first = parts[0]?.charAt(0).toUpperCase() ?? "";
    const last = parts[parts.length - 1]?.charAt(0).toUpperCase() ?? "";
    if (first && last) return first + last;
    if (first) return first;
  }
  return "??";
}

export function InitialsAvatar({
  firstName,
  lastName,
  displayName,
  seed,
  size = 36,
  className,
}: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  /** Override the color seed. Defaults to firstName+lastName. */
  seed?: string;
  size?: number;
  className?: string;
}) {
  const initials = pickInitials(firstName, lastName, displayName);
  const colorSeed =
    seed ?? (`${firstName ?? ""}${lastName ?? ""}${displayName ?? ""}` || initials);
  const bg = seedColor(colorSeed);

  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: bg,
        color: "#ffffff",
        fontFamily: "var(--font-sans)",
        fontSize: Math.round(size * 0.36),
        fontWeight: 600,
        letterSpacing: "-0.01em",
        boxShadow: `inset 0 -1px 0 rgba(0,0,0,0.10)`,
        userSelect: "none",
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// LeadAvatar — paywall-aware avatar
//
// blurred: stock portrait under filter: blur(N). The portrait is a
//   deterministic randomuser.me photo set at sync time (gender-matched
//   when the lead.gender field is populated). It is NEVER unblurred —
//   it exists purely to signal "real human behind the lock."
//
// revealed: InitialsAvatar (post-purchase). Buyer verifies the real face
//   via the LinkedIn URL surfaced in the contact panel.
// ---------------------------------------------------------------------------

export function LeadAvatar({
  photoUrl,
  firstName,
  lastName,
  displayName,
  seed,
  size = 36,
  mode,
  className,
}: {
  photoUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  seed?: string;
  size?: number;
  mode: "blurred" | "revealed";
  className?: string;
}) {
  if (mode === "revealed" || !photoUrl) {
    return (
      <InitialsAvatar
        firstName={firstName}
        lastName={lastName}
        displayName={displayName}
        seed={seed}
        size={size}
        className={className}
      />
    );
  }

  // Blur strength scales with avatar size so smaller cards still read as
  // "locked face" without a smear-of-pixels feel.
  const blurPx = Math.max(8, Math.round(size * 0.22));

  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 relative ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: "0 0 0 1px #E2E8F0",
        backgroundColor: "#F1F5F9",
      }}
      aria-hidden="true"
    >
      <img
        src={photoUrl}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          // Scale up slightly so the blur edge doesn't clip the circle.
          transform: "scale(1.15)",
          filter: `blur(${blurPx}px)`,
        }}
      />
      {/* Subtle inner ring + dim so the blurred portrait reads as a UI
          element, not a glitch. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
          backgroundColor: "rgba(30, 42, 58, 0.05)",
          pointerEvents: "none",
        }}
      />
    </span>
  );
}
