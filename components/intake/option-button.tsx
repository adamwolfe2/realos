"use client";

import React from "react";

export function OptionButton({
  selected,
  onClick,
  children,
  size = "md",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`text-left border font-mono uppercase tracking-wide transition-all ${
        size === "sm" ? "px-3 py-2 text-[11px]" : "px-4 py-3 text-xs"
      }`}
      style={{
        backgroundColor: selected ? "var(--blue, #2563eb)" : "var(--bg-white, #ffffff)",
        color: selected ? "white" : "var(--text-body, #0a0a0a)",
        borderColor: selected ? "var(--blue, #2563eb)" : "var(--border, #e5e7eb)",
        borderRadius: "4px",
      }}
    >
      {children}
    </button>
  );
}
