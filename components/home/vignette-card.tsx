"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// VignetteCard — a small floating "product moment" that overlaps the main
// artifact in a pillar composition (cool pass M3, motion pass sec 4). Real
// copy, its own shadow stack, a faint blue internal glow orb, an independent
// hover-lift, and a spring-in entrance keyed to tab activation.
// ---------------------------------------------------------------------------

export function VignetteCard({
  icon: Icon,
  title,
  meta,
  play,
  delay = 0.4,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  meta?: string;
  /** Re-key this to replay the entrance (e.g. per tab activation). */
  play: number;
  delay?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={play}
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.5, delay, ease: [0.2, 0.8, 0.3, 1] }
      }
      whileHover={reduce ? undefined : { y: -4 }}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #e6ebf5",
        borderRadius: 4,
        padding: "12px 14px",
        boxShadow:
          "0 1px 2px rgba(22,22,22,0.06), 0 12px 24px -10px rgba(22,22,22,0.18)",
        willChange: "transform",
      }}
    >
      {/* internal glow orb */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: -20,
          right: -20,
          width: 90,
          height: 90,
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(15,98,254,0.12), transparent 70%)",
        }}
      />
      <div className="relative flex items-start gap-2.5">
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 26,
            height: 26,
            borderRadius: 4,
            backgroundColor: "rgba(15,98,254,0.10)",
            color: "#0f62fe",
          }}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden />
        </span>
        <div className="min-w-0">
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              color: "#161616",
              lineHeight: 1.25,
            }}
          >
            {title}
          </p>
          {meta ? (
            <p
              className="mt-0.5"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "#5a647d",
                letterSpacing: "0.02em",
              }}
            >
              {meta}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </motion.div>
  );
}
