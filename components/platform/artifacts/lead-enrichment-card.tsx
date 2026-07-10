"use client";

import React, { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// LeadEnrichmentCard — the second hero artifact for /leads.
//
// Animates a single lead through three states the platform performs on every
// raw inquiry:
//
//   Stage 1 (RAW)        — just what the form / DM / portal gave us (email +
//                          first name).
//   Stage 2 (IDENTITY)   — verified phone, full name, location, age range
//                          appended from the identity layer.
//   Stage 3 (INTENT)     — behavioural intent overlay: active home buyer
//                          status, buying timeline, listings viewed in the
//                          last 7 days, composite intent score.
//
// The reader watches a lead get more valuable in real time. This is the
// "before vs after" of the platform without ever saying the words.
// ---------------------------------------------------------------------------

type Stage = "raw" | "identity" | "intent";

const ACCENT = "#0f62fe";
const INK = "#161616";
const MUTED = "#8d8d8d";
const SLATE = "#6f6f6f";
const BORDER = "#e0e0e0";
const PARCHMENT = "#f4f4f4";
const PHOTO = "https://randomuser.me/api/portraits/women/68.jpg";

const STAGE_DURATION_MS: Record<Stage, number> = {
  raw: 2200,
  identity: 2400,
  intent: 3600,
};

export function LeadEnrichmentCard() {
  const [stage, setStage] = useState<Stage>("raw");

  useEffect(() => {
    const order: Stage[] = ["raw", "identity", "intent"];
    const idx = order.indexOf(stage);
    const next = order[(idx + 1) % order.length];
    const t = setTimeout(() => setStage(next), STAGE_DURATION_MS[stage]);
    return () => clearTimeout(t);
  }, [stage]);

  const showIdentity = stage === "identity" || stage === "intent";
  const showIntent = stage === "intent";

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "2px",
        boxShadow: `0 0 0 1px ${BORDER}`,
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 md:px-6 py-3 sm:py-4"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 600,
          }}
        >
          Lead · LD-91428
        </span>
        <StageBadge stage={stage} />
      </div>

      {/* Avatar + identity */}
      <div className="px-5 md:px-6 pt-5 pb-4 flex items-center gap-4">
        <span
          className="inline-flex items-center justify-center flex-shrink-0 relative"
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            perspective: "400px",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              overflow: "hidden",
              transformStyle: "preserve-3d",
              transition: "transform 700ms cubic-bezier(.4,0,.2,1)",
              transform: showIdentity ? "rotateY(0deg)" : "rotateY(180deg)",
            }}
          >
            <img
              src={PHOTO}
              alt="Lead avatar"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "50%",
                position: "absolute",
                inset: 0,
                backfaceVisibility: "hidden",
              }}
            />
          </span>
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              backgroundColor: PARCHMENT,
              border: `1px dashed ${MUTED}`,
              color: MUTED,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: "20px",
              fontWeight: 600,
              opacity: showIdentity ? 0 : 1,
              transition: "opacity 250ms ease",
              pointerEvents: "none",
            }}
          >
            ?
          </span>
        </span>

        <div className="flex-1 min-w-0">
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "18px",
              color: INK,
              fontWeight: 500,
              lineHeight: 1.2,
            }}
          >
            {showIdentity ? "Marisol Reyes" : "Marisol R."}
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: SLATE,
              marginTop: "2px",
              transition: "all 400ms ease",
            }}
          >
            {showIdentity
              ? "34 · Brooklyn, NY 11215"
              : "Form submission · 9:14am"}
          </p>
        </div>
      </div>

      {/* Field rows that fade in as stages advance */}
      <div style={{ borderTop: `1px solid ${BORDER}` }}>
        <FieldRow
          label="Email"
          value="m.reyes@gmail.com"
          verified={false}
          revealed={true}
        />
        <FieldRow
          label="Phone"
          value="+1 (917) 555-0142"
          verified={showIdentity}
          revealed={showIdentity}
          masked={!showIdentity}
        />
        <FieldRow
          label="Address"
          value="Park Slope · Brooklyn, NY"
          verified={showIdentity}
          revealed={showIdentity}
          masked={!showIdentity}
        />
        <FieldRow
          label="Household"
          value="Renter · $145K HHI · 1 dependent"
          verified={showIdentity}
          revealed={showIdentity}
          masked={!showIdentity}
        />
      </div>

      {/* Intent overlay — fades in on stage 3 */}
      <div
        style={{
          borderTop: `1px solid ${BORDER}`,
          backgroundColor: PARCHMENT,
          padding: "16px 22px",
          opacity: showIntent ? 1 : 0,
          maxHeight: showIntent ? "240px" : "0px",
          transition: "opacity 500ms ease, max-height 500ms ease, padding 500ms ease",
          paddingTop: showIntent ? 16 : 0,
          paddingBottom: showIntent ? 16 : 0,
          overflow: "hidden",
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: ACCENT,
              fontWeight: 700,
            }}
          >
            Intent overlay
          </span>
          <ScoreChip value={92} />
        </div>

        <ul className="space-y-2">
          <IntentRow label="Buying timeline" value="0–30 days" strong />
          <IntentRow label="Active home buyer" value="Yes · since 14 days ago" />
          <IntentRow label="Listings viewed (7d)" value="23 properties" />
          <IntentRow label="Budget signal" value="$680K – $920K" />
          <IntentRow label="Search radius" value="Brooklyn · Park Slope · Gowanus" />
        </ul>
      </div>
    </div>
  );
}

function StageBadge({ stage }: { stage: Stage }) {
  const labels: Record<Stage, { text: string; tone: "neutral" | "blue" | "green" }> = {
    raw: { text: "Raw inquiry", tone: "neutral" },
    identity: { text: "Identity matched", tone: "blue" },
    intent: { text: "Scored · ready to route", tone: "green" },
  };
  const cur = labels[stage];
  const palette =
    cur.tone === "green"
      ? { bg: "rgba(36,161,72,0.12)", fg: "#24a148" }
      : cur.tone === "blue"
        ? { bg: "rgba(15,98,254,0.12)", fg: ACCENT }
        : { bg: "rgba(148,163,184,0.18)", fg: SLATE };

  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9.5px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: palette.fg,
        backgroundColor: palette.bg,
        padding: "3px 8px",
        borderRadius: "2px",
        fontWeight: 700,
        whiteSpace: "nowrap",
        transition: "all 400ms ease",
      }}
    >
      {cur.text}
    </span>
  );
}

function FieldRow({
  label,
  value,
  verified,
  revealed,
  masked = false,
}: {
  label: string;
  value: string;
  verified: boolean;
  revealed: boolean;
  masked?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-5 md:px-6 py-2.5"
      style={{
        borderBottom: `1px solid ${BORDER}`,
        transition: "background-color 400ms ease",
        backgroundColor: revealed && !masked ? "rgba(15,98,254,0.03)" : "transparent",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
          fontWeight: 600,
          minWidth: "78px",
        }}
      >
        {label}
      </span>
      <span
        className="flex-1 text-right truncate flex items-center justify-end gap-2"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13.5px",
          color: masked ? MUTED : INK,
          fontWeight: 500,
          transition: "color 400ms ease",
        }}
      >
        <span
          className="truncate"
          style={{
            fontFamily: masked ? "var(--font-mono)" : "var(--font-sans)",
            letterSpacing: masked ? "0.04em" : "normal",
          }}
        >
          {masked ? "— pending enrichment —" : value}
        </span>
        {verified && (
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: "rgba(36,161,72,0.14)",
              color: "#24a148",
            }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path
                d="M1.5 5L4 7.5L8.5 2.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </span>
    </div>
  );
}

function IntentRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "12.5px",
          color: SLATE,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: strong ? "var(--font-display)" : "var(--font-sans)",
          fontSize: strong ? "14px" : "13px",
          color: strong ? ACCENT : INK,
          fontWeight: strong ? 600 : 500,
        }}
      >
        {value}
      </span>
    </li>
  );
}

function ScoreChip({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        letterSpacing: "0.06em",
        color: "#fff",
        backgroundColor: ACCENT,
        padding: "3px 8px",
        borderRadius: "999px",
        fontWeight: 700,
      }}
    >
      <span style={{ opacity: 0.7 }}>SCORE</span>
      <span style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}>{value}</span>
    </span>
  );
}
