"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ArrowLeft } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import type { OnboardingStep } from "@/lib/onboarding/steps";

// Wizard chrome: brand bar at the top, progress dots, centered card.
// Matches the platform palette (cream parchment + blue accent).

const STEPS: Array<{ id: OnboardingStep; label: string }> = [
  { id: "welcome", label: "Workspace" },
  { id: "features", label: "Features" },
  { id: "properties", label: "Properties" },
];

export function WizardChrome({
  step,
  children,
  onBack,
  backDisabled,
}: {
  step: OnboardingStep;
  children: React.ReactNode;
  /**
   * Norman feedback (2026-06-02): wizard had no step-back nav, browser
   * back dropped users on the landing page. The host wizard supplies an
   * onBack callback that POSTs /api/onboarding/wizard/back to decrement
   * the server-persisted step + router.refresh()es. Omitted on terminal
   * states (e.g. mid-submit) to lock the chrome.
   */
  onBack?: () => void;
  backDisabled?: boolean;
}) {
  const activeIdx = STEPS.findIndex((s) => s.id === step);
  // Welcome is the floor — there's nowhere to go back to without
  // dropping out of the wizard entirely (which would invalidate the
  // signup intent). Hide the Back button there.
  const canShowBack = activeIdx > 0 && !!onBack;

  return (
    <div
      style={{ backgroundColor: "#FFFFFF", minHeight: "100vh" }}
      className="flex flex-col"
    >
      {/* Top bar */}
      <header
        style={{
          borderBottom: "1px solid #E2E8F0",
          backgroundColor: "rgba(255, 255, 255,0.92)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2"
            style={{
              color: "#1E2A3A",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "-0.012em",
            }}
          >
            {BRAND_NAME}
          </Link>
          <div className="flex items-center gap-3">
            <span
              style={{
                color: "#88867f",
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              14-day free trial
            </span>
          </div>
        </div>
      </header>

      {/* Progress dots */}
      <div className="max-w-[1100px] mx-auto w-full px-4 md:px-8 pt-8 md:pt-10">
        <div className="flex items-center justify-center gap-3 md:gap-4">
          {STEPS.map((s, i) => {
            const isDone = i < activeIdx;
            const isActive = i === activeIdx;
            return (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center rounded-full"
                    style={{
                      width: 22,
                      height: 22,
                      backgroundColor: isDone
                        ? "#2563EB"
                        : isActive
                          ? "#1E2A3A"
                          : "#E2E8F0",
                      color: isDone || isActive ? "#ffffff" : "#88867f",
                      fontFamily: "var(--font-sans)",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {isDone ? <Check className="w-3 h-3" strokeWidth={1.5} /> : i + 1}
                  </span>
                  <span
                    style={{
                      color: isActive ? "#1E2A3A" : "#88867f",
                      fontFamily: "var(--font-mono)",
                      fontSize: "10.5px",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      fontWeight: isActive ? 600 : 500,
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 28,
                      height: 1,
                      backgroundColor: "#E2E8F0",
                    }}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <main className="flex-1 flex items-start md:items-center justify-center px-4 md:px-8 pt-10 pb-20">
        <div className="w-full max-w-[640px]">
          {canShowBack ? (
            <button
              type="button"
              onClick={onBack}
              disabled={backDisabled}
              className="inline-flex items-center gap-1.5 mb-3 px-2 py-1 -ml-2 rounded-md transition-colors hover:bg-[#F1F5F9] disabled:opacity-40 disabled:pointer-events-none"
              style={{
                color: "#475569",
                fontFamily: "var(--font-mono)",
                fontSize: "11.5px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
              aria-label="Go back to previous step"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
              Back
            </button>
          ) : null}
          <div
            className="relative rounded-2xl"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 2px rgba(30, 42, 58,0.03)",
              padding: "32px 28px 32px",
            }}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
