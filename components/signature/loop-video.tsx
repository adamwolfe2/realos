"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { Reel } from "@/lib/signature/showcase";

// ---------------------------------------------------------------------------
// A silent reel that plays by itself while it is on screen and stops when it
// is not. Nothing downloads beyond the poster until it comes into view. Anyone
// can pause it (it runs longer than five seconds), and a visitor who asks
// their device for less motion gets the poster and a Play button instead.
// It loops on purpose: it is a recording of the product, not decoration
// (DESIGN.md notes the exception).
// ---------------------------------------------------------------------------

// play() is refused with AbortError whenever a pause lands while it is still loading (scrolling past, or a quick
// tap on Pause). That is not a failure; anything else is worth a line in the console.
function start(video: HTMLVideoElement) {
  video.play().catch((e: unknown) => {
    if (e instanceof DOMException && e.name === "AbortError") return;
    console.warn("reel did not start", e);
  });
}

export function LoopVideo({ reel, label }: { reel: Reel; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const stopped = useRef(false); // the visitor pressed Pause
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true; // React does not always write the attribute; browsers refuse to autoplay without it
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    stopped.current = calm.matches;
    let inView = false;
    const sync = () => (inView && !stopped.current ? start(video) : video.pause());
    // a third of the reel on screen starts it; less than that stops it
    const watch = new IntersectionObserver(([seen]) => {
      inView = seen.intersectionRatio >= 0.35;
      sync();
    }, { threshold: [0, 0.35, 1] });
    watch.observe(video);
    // the visitor can change the setting while the page is open
    const onCalm = () => {
      stopped.current = calm.matches;
      sync();
    };
    calm.addEventListener("change", onCalm);
    return () => {
      watch.disconnect();
      calm.removeEventListener("change", onCalm);
    };
  }, []);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      stopped.current = false;
      start(video);
    } else {
      stopped.current = true;
      video.pause();
    }
  };

  return (
    <div className="relative" style={{ aspectRatio: `${reel.w} / ${reel.h}`, backgroundColor: "#101010" }}>
      <video
        ref={ref}
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: "cover" }}
        poster={reel.poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={reel.srcSmall} type="video/mp4" media="(max-width: 700px)" />
        <source src={reel.src} type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={`${playing ? "Pause" : "Play"}: ${label}`}
        className="absolute flex items-center justify-center"
        style={{ right: 12, bottom: 12, width: 44, height: 44, borderRadius: 2, backgroundColor: "#FFFFFF", color: "#161616", border: "1px solid #d6d6d6" }}
      >
        {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
      </button>
    </div>
  );
}
