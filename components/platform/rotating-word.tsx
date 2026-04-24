"use client";

import React, { useEffect, useState } from "react";

type Props = {
  words: string[];
  color?: string;
  intervalMs?: number;
  italic?: boolean;
};

export function RotatingWord({
  words,
  color = "#2563EB",
  intervalMs = 2400,
  italic = true,
}: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (words.length <= 1) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % words.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [words.length, intervalMs]);

  const widest = words.reduce((a, b) => (b.length > a.length ? b : a), words[0] ?? "");
  const current = words[idx] ?? "";

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        verticalAlign: "baseline",
        color,
        fontStyle: italic ? "italic" : "normal",
        whiteSpace: "nowrap",
        lineHeight: "inherit",
      }}
    >
      <span style={{ visibility: "hidden" }} aria-hidden="true">
        {widest}
      </span>
      <span
        key={idx}
        style={{
          position: "absolute",
          inset: 0,
          display: "inline-flex",
          alignItems: "baseline",
          color,
          fontStyle: italic ? "italic" : "normal",
          animation: "rwIn 620ms cubic-bezier(.2,.7,.2,1) both",
          willChange: "opacity, transform",
        }}
      >
        {current}
      </span>
      <style jsx>{`
        @keyframes rwIn {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </span>
  );
}
