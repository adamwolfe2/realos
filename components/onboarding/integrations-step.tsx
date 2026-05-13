"use client";

import * as React from "react";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import {
  PMS_REGISTRY,
  type PmsDefinition,
} from "@/lib/integrations/pms/registry";

// Step 2 of the onboarding wizard. The user picks how their property
// data lives:
//
//   * Connect a live PMS (today: AppFolio) — we walk through the auth
//     fields and call /api/onboarding/wizard/integrations with the
//     `connect_pms` action.
//   * Express interest in a coming-soon PMS (Yardi, Buildium, Entrata,
//     RealPage) — recorded for ops; wizard still advances.
//   * Skip entirely and manage properties manually — wizard advances
//     to the manual property step.
//
// Layout is a single-column list of PMS cards. Selecting a card
// expands an inline form for the auth fields. The "Manual" card is
// special-cased at the bottom with a different visual treatment so
// it doesn't compete with the real connectors.

type IntegrationsSubmitBody =
  | { action: "skip" }
  | {
      action: "connect_pms";
      pmsId: string;
      credentials: Record<string, string>;
    }
  | { action: "express_interest"; pmsId: string };

export function IntegrationsStep({
  onSubmit,
  disabled,
}: {
  onSubmit: (body: IntegrationsSubmitBody) => void;
  disabled: boolean;
}) {
  const [selectedPmsId, setSelectedPmsId] = React.useState<string | null>(
    null,
  );
  const [creds, setCreds] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const livePms = PMS_REGISTRY.filter((p) => p.status === "live" && p.platform !== "MANUAL");
  const comingSoonPms = PMS_REGISTRY.filter(
    (p) => p.status === "coming_soon",
  );
  const manualPms = PMS_REGISTRY.find((p) => p.id === "manual")!;

  const selectedPms = selectedPmsId
    ? PMS_REGISTRY.find((p) => p.id === selectedPmsId)
    : null;

  const submitConnect = () => {
    if (!selectedPms) return;
    setError(null);
    if (selectedPms.id === "manual") {
      onSubmit({ action: "skip" });
      return;
    }
    if (selectedPms.status === "coming_soon") {
      onSubmit({ action: "express_interest", pmsId: selectedPms.id });
      return;
    }
    // Live PMS: validate required fields client-side.
    for (const field of selectedPms.authFields) {
      if (field.required && !creds[field.key]?.trim()) {
        setError(`${field.label} is required`);
        return;
      }
    }
    onSubmit({
      action: "connect_pms",
      pmsId: selectedPms.id,
      credentials: creds,
    });
  };

  return (
    <div className="space-y-7">
      <header>
        <p
          className="eyebrow"
          style={{ color: "#2563EB", letterSpacing: "0.16em" }}
        >
          Step 2 of 4
        </p>
        <h1
          className="mt-2"
          style={{
            color: "#141413",
            fontFamily: "var(--font-sans)",
            fontSize: "26px",
            fontWeight: 700,
            letterSpacing: "-0.014em",
          }}
        >
          Connect your property data.
        </h1>
        <p
          className="mt-2"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "14.5px",
            lineHeight: 1.55,
          }}
        >
          Start with your PMS so we can sync listings, residents, leases,
          renewals, and work orders live. Right after signup we&apos;ll walk
          you through connecting the rest — Google Analytics, Search
          Console, Google + Meta Ads, the Cursive pixel — from a single
          dashboard. The more data you connect, the more insights you
          get, but every source is optional and can be added later.
        </p>
      </header>

      {/* Live PMS cards */}
      <div className="space-y-2">
        <p
          style={{
            color: "#88867f",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Available now
        </p>
        {livePms.map((p) => (
          <PmsCard
            key={p.id}
            pms={p}
            selected={selectedPmsId === p.id}
            onSelect={() => {
              setSelectedPmsId(p.id);
              setCreds({});
              setError(null);
            }}
            creds={creds}
            onCredChange={(k, v) => setCreds((c) => ({ ...c, [k]: v }))}
          />
        ))}
      </div>

      {/* Coming soon PMS cards */}
      <div className="space-y-2">
        <p
          style={{
            color: "#88867f",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Coming soon — let us know you want it
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {comingSoonPms.map((p) => (
            <PmsCardCompact
              key={p.id}
              pms={p}
              selected={selectedPmsId === p.id}
              onSelect={() => {
                setSelectedPmsId(p.id);
                setCreds({});
                setError(null);
              }}
            />
          ))}
        </div>
      </div>

      {/* Manual entry option */}
      <div className="space-y-2">
        <p
          style={{
            color: "#88867f",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          No PMS yet, or want to start small
        </p>
        <button
          type="button"
          onClick={() => {
            setSelectedPmsId(manualPms.id);
            setCreds({});
            setError(null);
          }}
          className="w-full text-left rounded-xl transition-colors"
          style={{
            backgroundColor:
              selectedPmsId === manualPms.id
                ? "rgba(37,99,235,0.04)"
                : "#faf9f5",
            border:
              selectedPmsId === manualPms.id
                ? "1px solid #2563EB"
                : "1px solid #e8e6dc",
            padding: "12px 16px",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                {manualPms.name}
              </p>
              <p
                className="mt-1"
                style={{
                  color: "#5e5d59",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12.5px",
                  lineHeight: 1.5,
                }}
              >
                {manualPms.tagline}
              </p>
            </div>
            <SelectionDot active={selectedPmsId === manualPms.id} />
          </div>
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md text-sm"
          style={{
            backgroundColor: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.25)",
            color: "#7f1d1d",
            padding: "8px 12px",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => history.back()}
          className="inline-flex items-center gap-1.5 transition-colors"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={14} strokeWidth={2.5} aria-hidden="true" />
          Back
        </button>
        <button
          type="button"
          onClick={submitConnect}
          disabled={!selectedPmsId || disabled}
          className="inline-flex items-center gap-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "#2563EB",
            color: "#ffffff",
            padding: "10px 18px",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {selectedPms?.id === "manual"
            ? "Continue with manual entry"
            : selectedPms?.status === "coming_soon"
              ? "Notify me when ready"
              : "Connect and continue"}
          <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function PmsCard({
  pms,
  selected,
  onSelect,
  creds,
  onCredChange,
}: {
  pms: PmsDefinition;
  selected: boolean;
  onSelect: () => void;
  creds: Record<string, string>;
  onCredChange: (key: string, value: string) => void;
}) {
  return (
    <div
      className="rounded-xl transition-colors"
      style={{
        backgroundColor: selected ? "rgba(37,99,235,0.04)" : "#faf9f5",
        border: selected ? "1px solid #2563EB" : "1px solid #e8e6dc",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left"
        style={{ padding: "14px 16px" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <PmsMonogram pms={pms} size={40} />
            <div className="min-w-0">
              <p
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                {pms.name}
              </p>
              <p
                className="mt-1"
                style={{
                  color: "#5e5d59",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12.5px",
                  lineHeight: 1.5,
                }}
              >
                {pms.tagline}
              </p>
            </div>
          </div>
          <SelectionDot active={selected} />
        </div>
      </button>

      {selected && pms.authFields.length > 0 ? (
        <div
          className="px-4 pb-4 pt-1 space-y-3"
          style={{ borderTop: "1px solid rgba(37,99,235,0.10)" }}
        >
          {pms.authFields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label
                htmlFor={`pms-${pms.id}-${field.key}`}
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12.5px",
                  fontWeight: 600,
                }}
              >
                {field.label}
                {field.required ? (
                  <span style={{ color: "#2563EB", marginLeft: "3px" }}>
                    *
                  </span>
                ) : null}
              </label>
              {field.type === "subdomain" ? (
                <div
                  className="flex items-stretch overflow-hidden"
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e8e6dc",
                    borderRadius: "8px",
                  }}
                >
                  <input
                    id={`pms-${pms.id}-${field.key}`}
                    type="text"
                    value={creds[field.key] ?? ""}
                    onChange={(e) => onCredChange(field.key, e.target.value)}
                    placeholder={field.placeholder ?? ""}
                    className="flex-1 min-w-0"
                    style={{
                      padding: "9px 11px",
                      fontFamily: "var(--font-sans)",
                      fontSize: "13.5px",
                      color: "#141413",
                      outline: "none",
                      background: "transparent",
                    }}
                  />
                  <span
                    className="inline-flex items-center"
                    style={{
                      backgroundColor: "#f5f4ed",
                      color: "#88867f",
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      padding: "0 12px",
                      borderLeft: "1px solid #e8e6dc",
                    }}
                  >
                    .appfolio.com
                  </span>
                </div>
              ) : (
                <input
                  id={`pms-${pms.id}-${field.key}`}
                  type={field.type === "password" ? "password" : "text"}
                  value={creds[field.key] ?? ""}
                  onChange={(e) => onCredChange(field.key, e.target.value)}
                  placeholder={field.placeholder ?? ""}
                  className="w-full"
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e8e6dc",
                    padding: "9px 11px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13.5px",
                    color: "#141413",
                    outline: "none",
                    borderRadius: "8px",
                  }}
                />
              )}
              {field.helpText ? (
                <p
                  style={{
                    color: "#88867f",
                    fontFamily: "var(--font-sans)",
                    fontSize: "11.5px",
                    lineHeight: 1.45,
                  }}
                >
                  {field.helpText}
                </p>
              ) : null}
            </div>
          ))}
          {pms.contractNote ? (
            <p
              style={{
                color: "#5e5d59",
                fontFamily: "var(--font-sans)",
                fontSize: "11.5px",
                lineHeight: 1.45,
                paddingTop: "4px",
              }}
            >
              {pms.contractNote}
              {pms.helpUrl ? (
                <>
                  {" "}
                  <a
                    href={pms.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#2563EB",
                      textDecoration: "underline",
                      textUnderlineOffset: "2px",
                    }}
                  >
                    Learn more
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PmsCardCompact({
  pms,
  selected,
  onSelect,
}: {
  pms: PmsDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left rounded-xl transition-colors relative"
      style={{
        backgroundColor: selected ? "rgba(37,99,235,0.04)" : "#faf9f5",
        border: selected ? "1px solid #2563EB" : "1px solid #e8e6dc",
        padding: "12px 14px",
      }}
    >
      <span
        className="absolute"
        style={{
          top: 8,
          right: 10,
          backgroundColor: "rgba(20,20,19,0.06)",
          color: "#5e5d59",
          fontFamily: "var(--font-mono)",
          fontSize: "8.5px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 600,
          padding: "2px 6px",
          borderRadius: "10px",
        }}
      >
        Soon
      </span>
      <div className="flex items-start gap-2.5">
        <PmsMonogram pms={pms} size={32} />
        <div className="min-w-0 pr-10">
          <p
            style={{
              color: "#141413",
              fontFamily: "var(--font-sans)",
              fontSize: "13.5px",
              fontWeight: 600,
            }}
          >
            {pms.name}
          </p>
          <p
            className="mt-1"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "11.5px",
              lineHeight: 1.45,
            }}
          >
            {pms.tagline}
          </p>
        </div>
      </div>
      {selected ? (
        <span
          className="absolute"
          style={{ right: 10, bottom: 10 }}
        >
          <SelectionDot active />
        </span>
      ) : null}
    </button>
  );
}

// Logo monogram. Renders the brand color tile with a short text mark
// when a real SVG logo isn't available. Sized so it slots into both
// the wide live-PMS card and the compact coming-soon card.
function PmsMonogram({
  pms,
  size,
}: {
  pms: PmsDefinition;
  size: number;
}) {
  if (pms.logoSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pms.logoSrc}
        alt={`${pms.name} logo`}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          objectFit: "contain",
          backgroundColor: "#ffffff",
          border: "1px solid #e8e6dc",
          padding: 4,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: pms.brandColor,
        color: "#ffffff",
        fontFamily: "var(--font-sans)",
        fontSize: size <= 32 ? 11 : 13,
        letterSpacing: "-0.02em",
      }}
      aria-hidden="true"
    >
      {pms.monogram}
    </span>
  );
}

function SelectionDot({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 20,
        height: 20,
        border: active ? "2px solid #2563EB" : "1.5px solid #d6d3c8",
        backgroundColor: active ? "#2563EB" : "#ffffff",
      }}
      aria-hidden="true"
    >
      {active ? (
        <Check size={11} strokeWidth={3} style={{ color: "#ffffff" }} />
      ) : null}
    </span>
  );
}
