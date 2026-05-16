"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Check, Crown, ArrowRight } from "lucide-react";
import { WEBSITE_BUILDS, type WebsiteBuildDefinition } from "@/lib/billing/catalog";

// ---------------------------------------------------------------------------
// WebsiteBuildCard
//
// Done-for-you marketing site offer. Two side-by-side tiers with
// pronounced visual differentiation:
//
//   STANDARD  — light slate card, blue button, basic feature list
//                ("good enough" tier for solo properties)
//   PREMIUM   — dark slate panel with cobalt + amber accents, gold crown
//                badge, "Recommended for portfolios" ribbon, fuller
//                feature list, bundled bonus value, inverted button
//                (the tier the agency wants operators to pick)
//
// Previous version had both tiers in identical light cards with identical
// blue buttons — nothing said "pick Premium". The user flagged this:
// "These website deals need to be more separated and it needs to stand
// out for the premium one. How do we make it look and feel more premium
// with a better offer?"
//
// Premium is now a distinct visual artifact, with a fuller offer in
// catalog.ts (9 bullets vs 6, plus a bundled $297 of Reputation Pro)
// so the price gap reads as proportional to the value gap.
// ---------------------------------------------------------------------------

export function WebsiteBuildCard() {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const handle = async (buildId: "standard" | "premium") => {
    if (pendingId) return;
    setPendingId(buildId);
    try {
      const res = await fetch("/api/billing/website-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) {
        toast.error(
          json?.error ??
            `Couldn't start checkout (HTTP ${res.status}). Try again in a minute.`,
        );
        setPendingId(null);
        return;
      }
      window.location.assign(json.url as string);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Network error. Try again shortly.",
      );
      setPendingId(null);
    }
  };

  const standard = WEBSITE_BUILDS.find((b) => b.id === "standard")!;
  const premium = WEBSITE_BUILDS.find((b) => b.id === "premium")!;

  return (
    <section
      className="rounded-xl p-5 md:p-6 space-y-5"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #E2E8F0",
      }}
    >
      <div>
        <div
          className="inline-flex items-center gap-2 mb-1.5"
          style={{
            color: "#2563EB",
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <Sparkles size={12} strokeWidth={2.5} aria-hidden="true" />
          Done-for-you
        </div>
        <h2 className="text-sm font-semibold">Need a custom marketing site?</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
          Our team builds custom property marketing sites with your
          AppFolio listings, chatbot, and pixel installed out of the box.
          One-time fee, paid up front. A kickoff call follows checkout.
        </p>
      </div>

      {/* Two-column grid. Premium gets slightly more horizontal weight
          (1.1fr vs 1fr) on desktop so it visually anchors the row. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-4 lg:gap-5">
        <StandardCard
          build={standard}
          submitting={pendingId === "standard"}
          disabled={!!pendingId}
          onCheckout={() => handle("standard")}
        />
        <PremiumCard
          build={premium}
          submitting={pendingId === "premium"}
          disabled={!!pendingId}
          onCheckout={() => handle("premium")}
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Already have a website? Skip this — install the chatbot and
        pixel from your portal integrations to use LeaseStack on your
        existing site at no extra cost.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// StandardCard — clean, light, "good enough" treatment.
// ---------------------------------------------------------------------------
function StandardCard({
  build,
  submitting,
  disabled,
  onCheckout,
}: {
  build: WebsiteBuildDefinition;
  submitting: boolean;
  disabled: boolean;
  onCheckout: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-5 flex flex-col"
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-base font-semibold text-foreground">{build.uiLabel}</h3>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums text-foreground">
            ${Math.round(build.unitAmountCents / 100).toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">one-time</div>
        </div>
      </div>
      <p className="text-[11.5px] text-muted-foreground mb-4">
        {build.tagline}
      </p>
      <ul className="space-y-2 mb-5 flex-1">
        {build.bullets.map((line) => (
          <li
            key={line}
            className="flex items-start gap-2 text-[12.5px] text-foreground/85 leading-snug"
          >
            <Check
              className="h-3 w-3 mt-0.5 shrink-0 text-primary"
              strokeWidth={3}
              aria-hidden="true"
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10.5px] text-muted-foreground">
          Delivered in {build.deliveryWindow}
        </p>
      </div>
      <button
        type="button"
        onClick={onCheckout}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-1.5 rounded-md text-[12.5px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-progress"
        style={{
          backgroundColor: "#ffffff",
          color: "#1E2A3A",
          padding: "10px 14px",
          border: "1px solid #1E2A3A",
        }}
      >
        {submitting ? (
          <>
            <Loader2
              className="animate-spin"
              size={13}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            Starting checkout…
          </>
        ) : (
          <>
            Get the {build.uiLabel.toLowerCase()}
            <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PremiumCard — dark slate, cobalt + amber accents, recommended ribbon,
// inverted CTA. Visually anchors the row.
// ---------------------------------------------------------------------------
function PremiumCard({
  build,
  submitting,
  disabled,
  onCheckout,
}: {
  build: WebsiteBuildDefinition;
  submitting: boolean;
  disabled: boolean;
  onCheckout: () => void;
}) {
  return (
    <div
      className="relative rounded-xl p-5 flex flex-col overflow-hidden"
      style={{
        backgroundColor: "#1E2A3A",
        border: "1px solid #1E2A3A",
        // Subtle radial cobalt glow in the top-right corner so the card
        // reads as a piece of polished UI, not a flat dark rectangle.
        backgroundImage:
          "radial-gradient(circle at 100% 0%, rgba(37,99,235,0.22) 0%, rgba(37,99,235,0) 60%)",
      }}
    >
      {/* Recommended ribbon — amber so it pops against the slate without
          competing with the cobalt accents below. */}
      <div
        className="absolute top-0 right-0"
        style={{
          backgroundColor: "#F59E0B",
          color: "#1E2A3A",
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 700,
          padding: "5px 12px",
          borderBottomLeftRadius: 4,
        }}
      >
        <Crown
          size={10}
          strokeWidth={2.5}
          aria-hidden="true"
          style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 4 }}
        />
        Recommended
      </div>

      <div className="flex items-baseline justify-between gap-2 mb-1 mt-3">
        <h3
          className="text-base font-semibold"
          style={{ color: "#FFFFFF" }}
        >
          {build.uiLabel}
        </h3>
        <div className="text-right">
          <div
            className="text-2xl font-bold tabular-nums"
            style={{
              color: "#FFFFFF",
              letterSpacing: "-0.02em",
            }}
          >
            ${Math.round(build.unitAmountCents / 100).toLocaleString()}
          </div>
          <div
            className="text-[10px]"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            one-time
          </div>
        </div>
      </div>
      <p
        className="text-[11.5px] mb-4"
        style={{ color: "rgba(255,255,255,0.7)" }}
      >
        {build.tagline}
      </p>

      <ul className="space-y-2 mb-4 flex-1">
        {build.bullets.map((line, i) => {
          const isInherited = i === 0;
          return (
            <li
              key={line}
              className="flex items-start gap-2 text-[12.5px] leading-snug"
              style={{
                color: isInherited
                  ? "rgba(255,255,255,0.55)"
                  : "rgba(255,255,255,0.92)",
              }}
            >
              <Check
                className="h-3 w-3 mt-0.5 shrink-0"
                strokeWidth={3}
                style={{ color: "#60A5FA" }}
                aria-hidden="true"
              />
              <span>{line}</span>
            </li>
          );
        })}
      </ul>

      {/* Bonus-value line — only renders when the catalog defines one. */}
      {build.bonusValue ? (
        <div
          className="flex items-start gap-2 rounded-md mb-4"
          style={{
            backgroundColor: "rgba(245,158,11,0.10)",
            border: "1px solid rgba(245,158,11,0.25)",
            padding: "8px 10px",
          }}
        >
          <Sparkles
            size={12}
            strokeWidth={2.5}
            aria-hidden="true"
            style={{ color: "#F59E0B", marginTop: 1 }}
          />
          <p
            className="text-[11.5px] leading-snug"
            style={{ color: "#FBBF24", fontWeight: 600 }}
          >
            {build.bonusValue}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 mb-3">
        <p
          className="text-[10.5px]"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Delivered in {build.deliveryWindow}
        </p>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-progress hover:opacity-95"
        style={{
          backgroundColor: "#FFFFFF",
          color: "#1E2A3A",
          padding: "11px 14px",
        }}
      >
        {submitting ? (
          <>
            <Loader2
              className="animate-spin"
              size={13}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            Starting checkout…
          </>
        ) : (
          <>
            Get the {build.uiLabel.toLowerCase()}
            <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}
