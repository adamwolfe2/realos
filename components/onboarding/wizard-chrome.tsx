"use client";

import * as React from "react";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import type { OnboardingStep } from "@/lib/onboarding/steps";

// Wizard chrome: brand bar at the top, progress dots, centered card.
// Matches the platform palette (cream parchment + blue accent).

const STEPS: Array<{ id: OnboardingStep; label: string }> = [
  { id: "welcome", label: "Workspace" },
  { id: "integrations", label: "Connect" },
  { id: "property", label: "Property" },
  { id: "plan", label: "Plan" },
];

export function WizardChrome({
  step,
  children,
}: {
  step: OnboardingStep;
  children: React.ReactNode;
}) {
  const activeIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div
      style={{ backgroundColor: "#f5f4ed", minHeight: "100vh" }}
      className="flex flex-col"
    >
      {/* Top bar */}
      <header
        style={{
          borderBottom: "1px solid #e8e6dc",
          backgroundColor: "rgba(245,244,237,0.92)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2"
            style={{
              color: "#141413",
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
                          ? "#141413"
                          : "#e8e6dc",
                      color: isDone || isActive ? "#ffffff" : "#88867f",
                      fontFamily: "var(--font-sans)",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {isDone ? "✓" : i + 1}
                  </span>
                  <span
                    style={{
                      color: isActive ? "#141413" : "#88867f",
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
                      backgroundColor: "#e8e6dc",
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
        <div
          className="relative w-full max-w-[640px] rounded-2xl"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e8e6dc",
            boxShadow: "0 1px 2px rgba(20,20,19,0.03)",
            padding: "32px 28px 32px",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
