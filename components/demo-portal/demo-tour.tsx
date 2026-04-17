"use client";

import { ArrowRight } from "lucide-react";

export function TourOverlay({
  step,
  total,
  title,
  description,
  onNext,
  onSkip,
  brandColor,
}: {
  step: number;
  total: number;
  title: string;
  description: string;
  onNext: () => void;
  onSkip: () => void;
  brandColor: string;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[420px] px-4 sm:px-0">
      <div className="text-cream p-5 shadow-2xl" style={{ backgroundColor: brandColor, border: "1px solid rgba(255,255,255,0.15)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-cream/40">
            Tour · {step + 1} of {total}
          </span>
          <button onClick={onSkip} className="font-mono text-[10px] text-cream/40 hover:text-cream transition-colors">
            Skip Tour
          </button>
        </div>
        <div className="font-serif text-lg mb-1">{title}</div>
        <p className="font-mono text-xs text-cream/60 leading-relaxed mb-4">{description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className="h-1 w-6"
                style={{ backgroundColor: i <= step ? "var(--color-cream)" : "rgba(249,247,244,0.15)" }}
              />
            ))}
          </div>
          <button
            onClick={onNext}
            className="font-mono text-xs font-semibold bg-cream text-ink px-4 py-2 flex items-center gap-1.5 hover:bg-white transition-colors"
          >
            {step < total - 1 ? "Next" : "Start Exploring"} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
