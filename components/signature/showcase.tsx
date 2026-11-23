"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowUpRight, MousePointerClick, X } from "lucide-react";
import { SHOWCASE, type ShowcaseEntry } from "@/lib/signature/showcase";
import { LoopVideo } from "./loop-video";

// ---------------------------------------------------------------------------
// The builds, as a gallery. Each card shows the build moving (its reel, where
// it has one) with its facts. "Explore it live" opens the working site
// full-screen over the page; it loads only then, and is torn down on close.
// On a phone the button opens the build in its own tab: a desktop site inside
// a 360px frame shows nobody what it is. A new entry in SHOWCASE is a new card.
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const BORDER = "#e0e0e0";

export function SignatureShowcase() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<{ entry: ShowcaseEntry; view: number } | null>(null);

  const explore = (entry: ShowcaseEntry) => {
    setOpen({ entry, view: 0 });
    dialog.current?.showModal();
  };
  const view = open ? open.entry.views[open.view] : null;

  return (
    <>
      <ul className={`grid gap-x-6 gap-y-12 md:grid-cols-2 ${SHOWCASE.length > 2 ? "xl:grid-cols-3" : ""}`}>
        {SHOWCASE.map((e, i) => (
          <li key={e.key} className="flex flex-col">
            <div style={{ border: `1px solid #d6d6d6`, borderRadius: 2, overflow: "hidden", boxShadow: "0 1px 2px rgba(22,22,22,0.06), 0 24px 48px -20px rgba(22,22,22,0.22)" }}>
              {e.reel ? (
                <LoopVideo reel={e.reel} label={`${e.name}: a recording of the build in use`} />
              ) : (
                <div className="relative" style={{ aspectRatio: "1280 / 750", backgroundColor: "#101010" }}>
                  <Image src={e.views[0].poster} alt={e.views[0].alt} fill sizes="(max-width: 768px) 100vw, 600px" style={{ objectFit: "cover", objectPosition: "top" }} priority={i < 2} />
                </div>
              )}
            </div>
            <div className="mt-5 flex items-baseline justify-between gap-4">
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.2vw, 30px)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.12, color: INK }}>{e.name}</h3>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f43b8", backgroundColor: "#e8efff", padding: "4px 8px", borderRadius: 2, whiteSpace: "nowrap" }}>{e.status}</span>
            </div>
            <p className="mt-1" style={{ fontSize: 15, color: MUTED }}>{e.kind} · {e.place}</p>
            <p className="mt-3" style={{ fontSize: 17, lineHeight: 1.45, color: INK, maxWidth: 520 }}>{e.line}</p>
            <dl className="mt-5 grid grid-cols-3 gap-4">
              {e.facts.map(([k, v]) => (
                <div key={k} className="flex flex-col-reverse justify-end" style={{ borderTop: `1px solid ${INK}`, paddingTop: 10 }}>
                  <dt className="mt-1" style={{ fontSize: 13, lineHeight: 1.35, color: MUTED }}>{k}</dt>
                  <dd style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.4vw, 32px)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.05, color: INK }}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {/* .btn-primary sets its own display, so the phone / desktop switch lives on wrappers */}
              <span className="hidden md:block">
                <button type="button" onClick={() => explore(e)} className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <MousePointerClick size={18} aria-hidden />
                  Explore it live
                </button>
              </span>
              <span className="md:hidden">
                <a href={e.views[0].url} target="_blank" rel="noopener" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  Open the live build
                  <ArrowUpRight size={18} aria-hidden />
                </a>
              </span>
              <span className="hidden md:block">
                <a href={e.views[0].url} target="_blank" rel="noopener" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  Open in a new tab
                  <ArrowUpRight size={16} aria-hidden />
                </a>
              </span>
            </div>
            {e.note ? <p className="mt-4" style={{ fontSize: 13, lineHeight: 1.5, color: MUTED, maxWidth: 560 }}>{e.note}</p> : null}
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        onClose={() => setOpen(null)}
        aria-label={open ? `${open.entry.name}, live` : "Live build"}
        className="backdrop:bg-black/70"
        style={{ width: "min(1500px, 96vw)", height: "92vh", maxWidth: "none", maxHeight: "none", margin: "auto", padding: 0, border: "1px solid #d6d6d6", borderRadius: 2, overflow: "hidden", backgroundColor: "#fff" }}
      >
        {open && view ? (
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: "#f7f7f7" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: INK }}>{open.entry.name}</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pages of this build">
                {open.entry.views.map((v, i) => {
                  const on = i === open.view;
                  return (
                    <button key={v.url} type="button" aria-pressed={on} onClick={() => setOpen({ entry: open.entry, view: i })}
                      style={{ minHeight: 36, padding: "0 12px", borderRadius: 2, fontSize: 14, fontWeight: 500, border: `1px solid ${on ? "#0f62fe" : BORDER}`, backgroundColor: on ? "#e8efff" : "#fff", color: on ? "#0f43b8" : INK }}>
                      {v.label}
                    </button>
                  );
                })}
              </div>
              <a href={view.url} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 500, color: "#0f62fe", minHeight: 36 }}>
                Open in a new tab
                <ArrowUpRight size={16} aria-hidden />
              </a>
              <button type="button" onClick={() => dialog.current?.close()} aria-label="Close the live build" className="inline-flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 2, border: `1px solid ${BORDER}`, backgroundColor: "#fff", color: INK }}>
                <X size={18} aria-hidden />
              </button>
            </div>
            <iframe
              key={view.url}
              src={view.url}
              title={`${open.entry.name}: ${view.label}, live`}
              className="w-full flex-1"
              style={{ border: 0, backgroundColor: "#101010" }}
              allow="fullscreen; accelerometer; gyroscope"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        ) : null}
      </dialog>
    </>
  );
}
