"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, MousePointerClick } from "lucide-react";
import { ProductFrame } from "@/components/home/product-frame";
import { SHOWCASE } from "@/lib/signature/showcase";

// ---------------------------------------------------------------------------
// The builds, live. Each one opens as a screenshot; the real site loads inside
// the frame only when the visitor asks for it (they are heavy, interactive
// pages). On a phone the button opens the build in its own tab instead: a
// desktop site inside a 360px frame shows nobody what it is.
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const BORDER = "#e0e0e0";
const ACCENT = "#0f62fe";

export function SignatureShowcase() {
  const [entryKey, setEntryKey] = useState(SHOWCASE[0].key);
  const [viewIndex, setViewIndex] = useState(0);
  const [live, setLive] = useState(false);
  const entry = SHOWCASE.find((e) => e.key === entryKey) ?? SHOWCASE[0];
  const view = entry.views[viewIndex] ?? entry.views[0];
  // the frame is 16:10; a screenshot much wider than that is shown whole instead of losing its sides
  const wide = view.posterW / view.posterH > 1.8;
  const address = view.url.replace(/^https:\/\//, "").replace(/\/$/, "");

  const pickEntry = (key: string) => {
    setEntryKey(key);
    setViewIndex(0);
    setLive(false);
  };

  return (
    <div>
      <div role="group" aria-label="Builds" className="grid gap-2 sm:grid-cols-2">
        {SHOWCASE.map((e) => {
          const on = e.key === entry.key;
          return (
            <button
              key={e.key}
              type="button"
              aria-pressed={on}
              onClick={() => pickEntry(e.key)}
              className="text-left transition-colors"
              style={{
                padding: "14px 16px",
                borderRadius: 2,
                border: `1px solid ${on ? INK : BORDER}`,
                backgroundColor: on ? INK : "#FFFFFF",
                color: on ? "#FFFFFF" : INK,
              }}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{e.name}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.75, whiteSpace: "nowrap" }}>{e.status}</span>
              </span>
              <span className="mt-1 block" style={{ fontSize: 14, opacity: 0.75 }}>{e.kind} · {e.place}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pages of this build">
          {entry.views.map((v, i) => {
            const on = i === viewIndex;
            return (
              <button
                key={v.url}
                type="button"
                aria-pressed={on}
                onClick={() => { setViewIndex(i); setLive(false); }}
                style={{
                  minHeight: 40,
                  padding: "0 14px",
                  borderRadius: 2,
                  fontSize: 14,
                  fontWeight: 500,
                  border: `1px solid ${on ? ACCENT : BORDER}`,
                  backgroundColor: on ? "#e8efff" : "#FFFFFF",
                  color: on ? "#0f43b8" : INK,
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        <a href={view.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 500, color: ACCENT, minHeight: 40 }}>
          Open full screen
          <ArrowUpRight size={16} aria-hidden />
        </a>
      </div>

      <ProductFrame url={address} className="mt-3">
        <div className="relative w-full" style={{ aspectRatio: "16 / 10", backgroundColor: "#101010" }}>
          {live ? (
            <iframe
              key={view.url}
              src={view.url}
              title={`${entry.name}: ${view.label}, live`}
              className="absolute inset-0 h-full w-full"
              style={{ border: 0 }}
              loading="lazy"
              allow="fullscreen; accelerometer; gyroscope"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <>
              <Image src={view.poster} alt={view.alt} fill sizes="(max-width: 1240px) 100vw, 1176px" style={wide ? { objectFit: "contain", backgroundColor: "#f4f3f1", padding: "3%" } : { objectFit: "cover", objectPosition: "top" }} priority={entry.key === SHOWCASE[0].key && viewIndex === 0} />
              <div className="absolute inset-0 flex items-end justify-center pb-6 md:pb-10" style={{ backgroundImage: "linear-gradient(180deg, rgba(16,16,16,0) 55%, rgba(16,16,16,0.55) 100%)" }}>
                {/* .btn-primary sets its own display, so the phone / desktop switch lives on wrappers */}
                <span className="hidden md:block">
                  <button type="button" onClick={() => setLive(true)} className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <MousePointerClick size={18} aria-hidden />
                    Explore it live
                  </button>
                </span>
                <span className="md:hidden">
                  <a href={view.url} target="_blank" rel="noopener" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    Open the live build
                    <ArrowUpRight size={18} aria-hidden />
                  </a>
                </span>
              </div>
            </>
          )}
        </div>
      </ProductFrame>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-start">
        <p style={{ color: INK, fontSize: 19, lineHeight: 1.45, maxWidth: 520 }}>{entry.line}</p>
        <dl className="grid grid-cols-3 gap-4">
          {entry.facts.map(([k, v]) => (
            <div key={k} className="flex flex-col-reverse justify-end" style={{ borderTop: `1px solid ${INK}`, paddingTop: 10 }}>
              <dt className="mt-1" style={{ fontSize: 13, color: MUTED }}>{k}</dt>
              <dd style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 2.2vw, 28px)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, color: INK }}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {entry.note ? <p className="mt-5" style={{ fontSize: 13, lineHeight: 1.5, color: MUTED, maxWidth: 760 }}>{entry.note}</p> : null}
    </div>
  );
}
